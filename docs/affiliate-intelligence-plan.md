# Affiliate Intelligence, Store and Link in Bio: Implementation Plan

Written 13 Nov 2026 on `feat/channel-doctor-views-check`. Three parts:

1. **Affiliate Intelligence** in rendoza.com (`/affiliate`): Amazon product search through Canopy, the best 10 shown, up to 5 selected, Google Flow prompts for a product-review Short, SEO packaging, and "Add to bio" on every card.
2. **Store** in rendoza.com (`/store`): the creator's handle, keys and products, kept in a **separate Supabase project** (the store DB).
3. **Link in bio**: a separate Next.js app in `~/Projects/rendoza-bio`, served at `bio.rendoza.com/@handle`. It is modelled on Detail Dose's `/picks` page. The user deploys it.

---

## 0. Decisions

| Topic | Decision |
|---|---|
| Products shown / selected | 10 shown, up to 5 selected |
| Video | 40s: 5 products × one 8s clip. Fewer products give a shorter video (8s each). |
| Voiceover | About 200 wpm, so about 26 words per 8s clip (allowed range 20–28) |
| Product images in the video | The creator uploads their own product photos in Flow. The prompts reference them. |
| Prompt style | Like Next Shorts: one Agent Instruction, then one paste for images and one for clips (`clip-1: [Product name]`). Product-review friendly. |
| Credits | Charged on every Canopy search, and for the video prompts and the SEO pack. Admin sets the prices. |
| Plans | Every plan except Trial |
| Handle | Unique. One per user. Can't be edited for now, so no redirects are needed. |
| Product identity | ASIN. If the ASIN is already in the creator's store, only the new tags are added. |
| Tags | Many per product. Searchable. One tag per video makes the video's bio link. |
| Categories | Not hard-coded. The creator types one per product, or leaves it empty. The bio page shows only the categories in use. |
| Images | The Canopy image URL is used as is (not re-uploaded). A manual product takes an image URL, or an upload to the creator's own ImageKit. |
| Marketplace | amazon.com (US) for now |
| Prices | Never shown on the bio page. Canopy data isn't Amazon's official API, and Associates rules require prices from it. |

---

## 1. Architecture

```
rendoza.com (video-engine)                       Store DB (new Supabase project)        bio.rendoza.com (rendoza-bio)
 /affiliate  ── search ──> Canopy REST            stores, store_secrets,                 /@handle  (read-only, anon key + RLS)
 /store      ── server routes (service key) ───> catalog, store_products  <──────────   search ?q=, tag, category
             ── revalidate webhook ───────────────────────────────────────────────────> /api/revalidate
```

- Users sign in only on rendoza.com (its Supabase auth). The store DB has no users of its own.
- Every write to the store DB goes through rendoza.com server routes with the store service key, after checking that the store belongs to the signed-in user (`stores.owner_user_id = user.id`).
- The bio app only reads. Its anon key sees only what the RLS policies allow (public store fields, shown products).

---

## 2. Store DB (new Supabase project)

Migrations live in `rendoza-bio/supabase/migrations/` (the bio repo is the DB's home). They are applied to the store project.

### 2.1 Tables

```sql
create extension if not exists citext;

create table stores (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null unique,                 -- rendoza.com user id; one store per user
  handle           citext not null unique
                     check (handle ~ '^[a-z0-9][a-z0-9_.]{2,29}$'),
  display_name     text not null check (char_length(display_name) between 1 and 60),
  bio              text check (char_length(bio) <= 300),
  avatar_url       text,
  amazon_tag       text check (amazon_tag ~ '^[A-Za-z0-9-]{3,40}-\d{2}$'),  -- e.g. mychannel-20
  imagekit_url_endpoint text,                            -- https://ik.imagekit.io/<id>
  imagekit_public_key   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Never readable by the bio app: no RLS policy at all (service role only).
create table store_secrets (
  store_id                 uuid primary key references stores(id) on delete cascade,
  imagekit_private_key_enc text                          -- encrypted in rendoza (src/lib/youtube/crypto.ts)
);

-- One row per Amazon product for the whole system (shared facts, refreshed once for everyone).
create table catalog (
  asin        text primary key check (asin ~ '^[A-Z0-9]{10}$'),
  name        text not null,
  image_url   text,
  images      text[] not null default '{}',              -- all image URLs from Canopy, for the picker
  source      text not null check (source in ('canopy', 'manual')),
  fetched_at  timestamptz not null default now()
);

-- The creator's own copy: their title, image, category, tags and order.
create table store_products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  asin        text not null references catalog(asin),
  name        text not null check (char_length(name) between 1 and 200),
  image_url   text,
  blurb       text check (char_length(blurb) <= 160),
  category    text check (char_length(category) <= 40),  -- free text or null
  tags        text[] not null default '{}',              -- lower-case slugs
  show        boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  search      tsvector generated always as (
                to_tsvector('simple', name || ' ' || coalesce(category, '') || ' ' || coalesce(blurb, '') || ' ' || array_to_string(tags, ' '))
              ) stored,
  unique (store_id, asin)
);
create index store_products_search on store_products using gin (search);
create index store_products_tags   on store_products using gin (tags);
create index store_products_order  on store_products (store_id, sort_order, created_at desc);
```

Reserved handles (`admin`, `api`, `www`, `bio`, `rendoza`, `store`, `help`, `login`, …) are refused in the rendoza route that creates the store.

### 2.2 Add or merge (no conflicts)

Two creators can add the same ASIN at the same moment: each gets their own `store_products` row, and the shared `catalog` row is written once.

```sql
insert into catalog (asin, name, image_url, images, source) values ($1, $2, $3, $4, 'canopy')
on conflict (asin) do update set images = excluded.images, fetched_at = now()   -- refresh only
  where catalog.source = 'canopy';

insert into store_products (store_id, asin, name, image_url, category, tags, blurb)
values ($store, $asin, $name, $image, $category, $tags, $blurb)
on conflict (store_id, asin) do update
  set tags = (select array(select distinct unnest(store_products.tags || excluded.tags))),
      updated_at = now();
```

This lives in one RPC, `add_store_product(...)`, which is called with the service key, so the two steps run in one transaction.

### 2.3 RLS (what the bio app's anon key can read)

- `stores`: no direct select. A view `public_stores` exposes `handle, display_name, bio, avatar_url, amazon_tag` and is granted to `anon`.
- `store_products`: `select` for `anon` where `show = true`.
- `catalog`: `select` for `anon`.
- `store_secrets`: RLS on, no policies.
- Writes: none for `anon`. The service role bypasses RLS.

### 2.4 Search RPC (used by the bio app)

`search_store(handle text, q text, cat text)`:
1. Finds the store by handle.
2. If `q` is exactly a tag slug that exists on a shown product (a video link: `?q=car-gadgets-1113`), it returns only those products.
3. Otherwise it matches full text on `search` (prefix match on each word), filtered by `cat`.
4. Results are ordered by `sort_order` and then `created_at desc`. At most 200 are returned.

---

## 3. rendoza.com (video-engine)

### 3.1 Environment and clients

| Variable | Use |
|---|---|
| `CANOPY_API_KEY` | Canopy REST (`API-KEY` header), server only |
| `STORE_SUPABASE_URL`, `STORE_SUPABASE_SERVICE_ROLE_KEY` | Store DB, server only |
| `BIO_REVALIDATE_URL`, `BIO_REVALIDATE_SECRET` | Tells the bio app a store changed |

- `src/lib/store/db.ts`: a service client for the store DB, imported only by server code.
- `src/lib/store/revalidate.ts`: a fire-and-forget POST to the bio app. A failure is logged and never blocks the save.

### 3.2 Admin settings and access (main DB migration)

New columns in `channel_doctor_settings` (in the `supabase/migrations/2026111x_affiliate.sql` style):

- `affiliate_enabled` (default false)
- `affiliate_allowed_plans` (default `{STARTER,CREATOR,STUDIO}`)
- `affiliate_search_credit_cost` (per Canopy search)
- `affiliate_video_credit_cost` (video prompts, including Canopy product-detail calls for the selected products)
- `affiliate_seo_credit_cost`
- `affiliate_searches_per_user_day` (abuse limit, through `consumeQuota`)

Code changes:
- In `settings.ts`: add `AffiliateSettings` and parse/save it. `getUserAccess` gets `hasAffiliateAccess`, which is the admin or (enabled and the tier is allowed).
- In `stream-analysis.ts`: add `'affiliate'` to `feature`, so charging, refunds and the per-user guard are the same as Create.
- In the admin page: an "Affiliate Intelligence" section, in the same form as Create.

### 3.3 Canopy client: `src/lib/affiliate/canopy.ts`

- `searchProducts(term, { minPrice, maxPrice, sort })` calls `GET /api/amazon/search?searchTerm&domain=US&limit=40`. Each result is normalised to `{ asin, title, imageUrl, price, rating, ratingsTotal, isPrime, sponsored, coupon }`.
- `productDetails(asin)` calls `GET /api/amazon/product`. It returns `{ title, brand, images[], featureBullets[], rating, ratingsTotal }` (the exact field names are checked against the OpenAPI spec at `rest.canopyapi.co/api/v1/openapi.json`).
- Timeouts are 20s. Errors are mapped to `UserFacingError`, so the credits are refunded.

### 3.4 Picking the best 10: `src/lib/affiliate/rank.ts` (pure, tested)

1. Drop sponsored results and results with no image.
2. Keep products with a rating of at least 4.0 and at least 100 ratings. If fewer than 10 are left, relax to 3.8 and 30.
3. Score = 0.6 × rating normalised to 0–1 over 3.5–5, plus 0.4 × log10(ratings) normalised to 0–1 over 1–5, plus small bonuses for Prime (+0.03) and a coupon (+0.02).
4. Show the top 10. Each card gives its reasons, e.g. "4.7★ from 12,400 ratings · Prime".

### 3.5 Video prompts: `src/lib/affiliate/video/`

This reuses Next Shorts where it fits: `models.ts`, `pacing.ts`, `complexity.ts`, the flow-text style and the scoring. The structure differs:

- One clip per product, **8s each** (Veo 3.1 Lite 8s, or Omni at 8s). 5 products give 40s.
- **Assets:** `IMAGE P1…P5` are the creator's own product photos, which they upload in Flow. For every clip, Flow first makes a **start image** from that photo: the product in a real setting, held or in use. Then it makes the video.
- **Clip schema** (from the LLM, then validated):
  - `productName`
  - `hook` (clip 1 only: the first 2s)
  - `startImage` (the image prompt, built on `IMAGE Pn`)
  - `shot`: subject, one action, camera, lighting, composition, speed
  - `voiceover`: 20–28 words, with the product name once, one main benefit and one feature from its bullets
  - `onScreenText` (≤4 words, added in editing)
- **Validation:**
  - at most 5 clips, each 8s, total = 8 × clips
  - voiceover word range
  - the product name is in the voiceover
  - no price, "best ever", "#1" or other claims not in the bullets
  - one action and no camera conflict (from the complexity analyzer)
  - a fast-pace hook
- **Output: three copy blocks**
  1. **Agent Instructions** (once per project):
     - product-review tone: show the product clearly, real use, honest benefits, no exaggeration
     - fast pace
     - "for each clip, make the start image from the product photo first, then the 8s video"
     - keep the product's shape, colors, buttons and labels exactly as in the photo
     - no text in the video
     - generate right away, don't wait for confirmation
  2. **Images** (one paste): `IMAGE P1 (your photo of <Product 1>)`, then each clip's start-image prompt in order.
  3. **Clips** (one paste):
     ```
     clip-1: [Product name]
     START IMAGE: …
     SHOT: …
     VOICEOVER (≈26 words): "…"
     clip-2: [Product name]
     …
     ```
  4. Editing steps: the order, the on-screen text, the voiceover read at about 200 wpm, and the "altered or synthetic content" label.

### 3.6 SEO packaging: `src/lib/affiliate/seo.ts`

One LLM call, validated:
- 3–4 titles (≤60 characters, no hashtags, no time or price claims; the `titleProblems` check from Next Shorts)
- a thumbnail concept and image prompt (the products laid out, ≤4 words of text)
- a description: a hook line, the products by name, "Links: bio.rendoza.com/@handle?q=<video-tag>", and the disclosure "As an Amazon Associate I earn from qualifying purchases."
- keywords (YouTube tags, ≤500 characters)
- 3 hashtags

**Video tag:** a slug made from the search and the date (e.g. `car-gadgets-1113`). It is added to every product the creator adds to the bio from this video, so the link shows exactly these products.

### 3.7 API routes

| Route | What | Credits |
|---|---|---|
| `POST /api/affiliate/search` | Canopy search, then the top 10 with reasons | search cost; daily limit |
| `POST /api/affiliate/video` | details for the selected ≤5, then clip prompts | video cost |
| `POST /api/affiliate/seo` | SEO pack for the selected products | SEO cost |
| `GET /api/affiliate/product/:asin` | details and images for the Add-to-bio modal (cached in `catalog`) | free; limited per day |
| `GET/POST /api/store` | read, or create the store (handle check, reserved words) | — |
| `PATCH /api/store` | display name, bio, avatar, Amazon tag, ImageKit keys | — |
| `GET /api/store/handle?h=` | is the handle free? | — |
| `GET /api/store/products?q=&tag=&cat=` | the creator's products | — |
| `POST /api/store/products` | add or merge (the RPC from 2.2) | — |
| `PATCH/DELETE /api/store/products/:id` | edit, hide, reorder, delete | — |
| `POST /api/store/imagekit-auth` | an upload signature from the creator's own ImageKit key | — |

Every store route checks the owner. Every write calls revalidate.

### 3.8 UI

- **Sidebar:** "Affiliate Intelligence" and "Store".
- **`/affiliate`:**
  - a search bar (keyword, optional price range), showing "N credits"
  - a grid of 10 cards: image, title, rating, ratings, Prime, the score reasons, a select checkbox ("3 of 5 selected"), and **Add to bio**
  - "Make video prompts" → the pack view: the Agent Instructions, Images and Clips copy blocks, the editing steps, "Write SEO pack" and the SEO results with copy buttons
  - the last search and pack stay in localStorage, like Next Shorts, with a "Clear" button
- **Add-to-bio modal:**
  - With no store yet, step 1 is "Create your handle" (live availability check), then it continues.
  - An **image picker** with the product's Amazon images (from `/api/affiliate/product/:asin`); the first is selected by default.
  - A **title** (pre-filled, editable).
  - A **category**: pick one of the store's categories, type a new one, or leave it empty.
  - **Tags**: chips, pre-filled with the video tag when a pack exists; add or remove.
  - An optional short blurb, and a show/hide toggle.
  - If the ASIN is already in the store, the modal says "Already in your store: new tags will be added" and saves only the tags.
- **`/store`:**
  - **Products:** search, filter by tag and by category, a list (image, title, category, tags, shown), inline edit, hide, delete, reorder (up/down), and a "View bio page" link.
  - **Add product:** ASIN (required, 10 characters), title, image (a URL, or upload to ImageKit when keys are set), category, tags, blurb. If the ASIN exists, the tags are merged.
  - **Settings:** the handle (set once and shown read-only after; "can't be changed yet"), display name, bio, avatar URL, Amazon store ID (`xxx-20`), and the ImageKit URL endpoint, public key and private key (stored encrypted, never shown again).

---

## 4. Link in bio: `~/Projects/rendoza-bio`

Next.js (the same major version as Detail Dose), Tailwind 4, TypeScript.

- **Routes:**
  - The middleware rewrites `/@handle` to `/u/[handle]`. Unknown handles get a 404 with a link to rendoza.com.
  - `app/u/[handle]/page.tsx` ports Detail Dose `/picks`: a header (avatar, name, bio, disclosure), `SearchControls` (`?q=`, category chips built from the store's own categories), the grid of `ProductCard`s, skeletons and an empty state.
  - Cards link to `https://www.amazon.com/dp/<ASIN>?tag=<amazon_tag>` with `rel="sponsored nofollow noopener"`. No prices are shown.
- **Data:**
  - It reads `public_stores` and `search_store()` with the anon key.
  - Results are cached per handle with `cacheTag('store:<handle>')`.
  - `POST /api/revalidate` (secret header) calls `revalidateTag`.
- **Images:**
  - Plain `<img>` with `loading="lazy"`, since Amazon and ImageKit URLs are served as they are.
  - Or `next/image` with `remotePatterns` for `m.media-amazon.com` and `ik.imagekit.io`.
- **SEO:** `noindex, follow`, like Detail Dose.
- **Environment:** `STORE_SUPABASE_URL`, `STORE_SUPABASE_ANON_KEY`, `REVALIDATE_SECRET`.
- **Deploy:** by the user. The app is set up for Vercel; `bio.rendoza.com` points to it.

---

## 5. Phases

| Phase | Deliverable | Tests |
|---|---|---|
| **1. Store DB** | Migrations (tables, RLS, view, `add_store_product`, `search_store`) in rendoza-bio; the store client and settings in rendoza | SQL: the merge keeps tags unique, the same ASIN works in two stores, anon can't read secrets or hidden products |
| **2. Store panel** | `/api/store*` routes and the `/store` page (handle, settings, manual add, list/search/tags, ImageKit upload) | owner checks (404 for another user's product), handle rules, ASIN and Amazon-tag validation |
| **3. Bio app** | `rendoza-bio`: the `/@handle` page, search/tags/categories, revalidate | search by tag vs words, unknown handle, an empty store |
| **4. Search** | the Canopy client, ranking, `/affiliate` search and select, the Add-to-bio modal | ranking (sponsored dropped, relaxation), max 5 selected, credits charged and refunded |
| **5. Video + SEO** | the clip prompts (two-step + images), the validator, the SEO pack, the video tag | 8s/clip, 20–28 words, the name in the voiceover, no price claims, the title rules |
| **6. Admin and polish** | admin settings section, sidebar, daily limits; a real run on a product category | — |

Each phase ends with `tsc` clean and tests passing. Nothing is committed without the user's go-ahead.

---

## 6. Risks and limits

- **Amazon Associates rules:** product images and data come from Canopy, not Amazon's official API. The bio page shows no prices and hotlinks Amazon's own image URLs. The creator is responsible for their Associates account. The UI repeats the disclosure.
- **Image URLs can change:** the catalog refresh (on the next search or detail call) updates `catalog.images`. A broken image falls back to a placeholder on the bio page.
- **Canopy cost and limits:** about $0.01 per call (from third-party listings, to be confirmed). Searches are charged; product details are counted in the daily limit.
- **AI video of real products:** the creator's photos keep the product accurate, but the video is still AI-made. The editing steps include YouTube's "altered or synthetic content" label.
- **Cross-database ownership:** the store DB can't check rendoza users with a foreign key. Ownership is enforced in rendoza's routes, and the bio app can't write at all.
