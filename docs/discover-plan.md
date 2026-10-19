# Discover — Phase 2 Implementation Plan

This plan implements [youtube-growth-2.md](youtube-growth-2.md) (Phase 2: Discover). It is based on an inspection of this repository and of YouTube's API policy and quota pages on 19 Oct 2026. It builds on the Channel Doctor work described in [youtube-doctor-plan.md](youtube-doctor-plan.md). Branch: `feature/youtube-doctor`; Phase 2 work goes on a new `feature/discover` branch.

Feature name: **Discover**, route `/discover`, with a new sidebar item under Channel Doctor.

The question Phase 2 answers: *"Given what works on my channel and what is happening in my market, what should my next video be?"*

## Status (19 Oct 2026)

Milestones D1–D8 are implemented on `feature/discover`. Typecheck, 132 tests and the production build pass. Real-channel runs were checked for discovery, research, topics, opportunities and AI angles in English and Bangla.

**Changes from this plan made during implementation:**
- The title-match threshold is 0.57 and the topic clustering threshold is 0.5 (bge-m3), both calibrated on real channels.
- Channel and series suffixes are stripped from titles before topic matching.
- A "Compilation" format was added.
- Live streams and premieres are excluded from research.
- Competitor reasons in discovery are deterministic: no model call is needed.
- Low-confidence advice always starts with "Early signal" (enforced in code).
- YouTube Kit Studio now uses the official API (the user's own key, or their connected channel within the shared search budget). The HTML scraper is gone.
- Admins can use Discover while it is switched off for users.

**Before public launch:**
1. Submit the YouTube API audit / quota-extension form, with the "Analytics & Reporting" use case for derived metrics.
2. Switch Discover on in Admin → Channel Doctor once approved.
3. Walk through Discover in the browser on desktop and mobile.
4. Set the Vercel env vars (as for Channel Doctor). Confirm that `maxDuration` 300 is allowed on the hosting plan.
5. Optional: add a beta-tester list in admin, so that chosen accounts can use Discover before launch.

---

## 0. Two findings that shape the whole plan

### 0.1 `search.list` allows only 100 calls per day for the whole app

Since YouTube's quota change, `search.list` has its **own bucket: 100 calls/day per Google Cloud project**. Each call costs 1 unit. The other 10,000 units/day are shared by every other endpoint ([quota costs](https://developers.google.com/youtube/v3/determine_quota_cost)). The limit is shared by **all users**.

Consequences:
- Search is reserved for the *discovery* step only (3 calls per run at most). It is never used for research, refreshes or page loads.
- Competitors can also be added **without search**: paste a channel URL, an `@handle` or a video URL. This costs 1 unit from the 10k bucket.
- A **global daily search budget**, counted in the database, stops the app from burning the shared bucket. When it runs out, the user sees a clear message and the "add by URL" path keeps working.
- Applying for a quota extension through the API Compliance Audit is a launch task (see 0.2).

Research itself is cheap. Ten competitors with 50 recent uploads each cost about 10 `channels`, 10 `playlistItems` and 10 `videos` calls, roughly 30 units. That is about 0.3% of the daily 10k.

### 0.2 Derived metrics need YouTube's permission

The Developer Policies, **III.E.4.h** ([policy](https://developers.google.com/youtube/terms/developer-policies)), forbid using API Data "to create new or derived data or metrics". Relative performance (5.9×), outlier flags, opportunity scores and channel comparisons are all derived metrics.

Since June 2026 there is an exception ([derived metrics policy](https://developers.google.com/youtube/terms/derived-metrics-policy)). Audited developers with an analytics use case may create custom scores, ratios, competitor comparisons and leaderboards. To qualify, they must:
- accept the policy amendment and choose **"Analytics & Reporting"** (Section 5) in the quota extension / audit form;
- keep derived metrics visibly separate from YouTube metrics.

III.E.2 (aggregation across content owners) is relevant too. The derived-metrics policy explicitly lists competitor comparisons as allowed for approved apps.

**Plan:** build everything behind the admin `discover_enabled` flag and the plan gate. Before public launch, submit the audit form. One application covers both the search quota increase and the derived-metrics use case. Every derived number in the UI carries the label *"Calculated by Rendoza — not a YouTube metric"*.

### 0.3 Existing scraper must not be reused, and should be retired

`src/lib/youtube-search.ts` (used by `/api/search-competitors` → YouTube Kit Studio) falls back to **scraping youtube.com HTML (`ytInitialData`)**. It also accepts a `youtubeApiKey` from the request body. Scraping breaks YouTube's Terms of Service, and a reviewer can find it during the API audit. Discover will not use this module. Recommendation: switch YouTube Kit Studio onto the new public research client (section 4.2) and delete the scraper before submitting the audit.

---

## 1. Decisions at a glance

| Topic | Decision |
|---|---|
| Public data access | Use the **user's existing OAuth token** (`youtube.readonly` can read public data). No API key and no new scopes, so Google verification is unaffected. Same `googleJson` wrapper as Phase 1. |
| Search budget | Global daily counter in Postgres (Pacific-time day) plus a per-user daily discovery limit, both set by the admin. |
| Saved data | **Only** the competitor watchlist (channel IDs, optional label, group, active flag, date added) and quota counters. No titles, stats, thumbnails, search results or reports in the DB. |
| Research results | Computed in one streaming request (NDJSON stages, the same pattern as Phase 1). The browser keeps them in **`sessionStorage`** and they are cleared on sign-out. |
| Numbers | Every median, ratio, outlier, count, score and confidence value is **deterministic TypeScript**. |
| Topic clustering | **Embeddings** (DeepInfra `BAAI/bge-m3`, which is multilingual so Bangla and English titles land in the same space). Clustering is deterministic, and the LLM only *names* clusters and assigns formats. |
| Text AI | Existing `callLLM` with the admin model list. It handles cluster labels, competitor-type reasons, formats it can't classify by rule, opportunity explanations and original angles. Output is zod-validated, and ids and numbers are sanitized. |
| Vision AI | Existing `describeThumbnail` (Phase 1). Used only on outlier competitor thumbnails, capped by the admin. Nothing claims visual analysis when the model wasn't run. |
| Phase 1 input | The research run **recomputes the deterministic Phase 1 engine on the server** (`fetchChannelDataset` + `analyzeChannel`, no AI). It does not trust a report the browser sends. |
| Credits | Reuse the Phase 1 charge-up-front / refund-on-failure flow. The admin sets prices for discovery, research and opportunity deep-dive. |
| Admin | New "Discover" section on the existing Admin → Channel Doctor page (on/off, plans, credit costs, limits, weights, embedding model). |
| Phase 3 | A versioned `Opportunity` object (zod schema). The "Create video brief" button hands it to a placeholder page through `sessionStorage`. |

---

## 2. What we reuse from Phase 1 (no duplicates)

| Need | Reuse | Change |
|---|---|---|
| Google HTTP, retries, error kinds | `google-fetch.ts` | none |
| Token refresh / reauth | `connection-service.getValidAccessToken` | none |
| Uploads → video metadata | `data-client.fetchUploadIds`, `fetchVideoDetails`, `parseIsoDuration` | generalize `fetchVideoDetails` to also return `channelId`, `categoryId`, `description` (opt-in `parts`) |
| Channel metadata | `data-client.fetchMyChannels` | add `fetchChannelsById(ids)`, `fetchChannelByHandle(handle)` (same mapper) |
| Concurrency, partial failure | `fetcher.mapLimit`, `settle` | none |
| Stats helpers | `analysis/stats.ts` (`median`, `confidenceFromSample`, `minConfidence`, `round`) | add `mad`, `robustZ`, `quantile` |
| Title features | `analysis/titles.ts` | extend with Bangla-aware mechanisms (section 6.4) |
| Your own channel analysis | `fetchChannelDataset`, `analyzeChannel` (`DeterministicReport`: video labels, bottlenecks, strengths) | none |
| LLM | `llm-providers.callLLM`, `parseJsonObject` | add `embed(texts, models)` next to it (same key, same provider) |
| Thumbnail vision | `analysis/thumbnails.describeThumbnail`, `isAllowedThumbnailUrl` | none |
| Stream + credits + guard | `stream-analysis.streamAnalysis`, `run-guard.acquireRun` | make generic over stage type and cost source (refactor; Phase 1 call sites unchanged) |
| Settings + plan gate | `settings.ts` (`getChannelDoctorSettings`, `getUserAccess`, `validateDeepInfraModel`) | add `discover*` fields; `validateDeepInfraModel` gets an `'embedding'` kind |
| Auth helpers | `route-auth.requireUser/requireAdmin`; `middleware.ts` | add `/discover` to private routes |
| Client stream + storage | `use-diagnosis.useAnalysisStream`, `progress-steps`, `channel-doctor-storage` | storage keys for discover; clear on sign-out (already clears all reports by prefix) |
| UI pieces | `ConfidenceBadge`, `EvidenceBadge`, `WhyWeThinkThis`, `LimitationsCard`, `VideoTable`, `TrafficBars`, recharts setup | reuse as-is |

---

## 3. Database (one migration: `20261020_discover.sql`)

### 3.1 `discover_competitors`: the watchlist (user configuration only)

```sql
create table public.discover_competitors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  channel_id    text not null check (channel_id ~ '^UC[\w-]{22}$'),
  label         text check (char_length(label) <= 60),
  grouping      text not null default 'direct' check (grouping in ('direct','adjacent','format')),
  active        boolean not null default true,
  added_at      timestamptz not null default now(),
  unique (user_id, channel_id)
);
alter table public.discover_competitors enable row level security;
create policy "own rows" on public.discover_competitors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- There are no title, thumbnail or subscriber columns. These are fetched fresh on every view, as III.E.4 requires.
- `grouping` is the **user's** choice. It is pre-filled from our suggestion when they save.
- The limit on active competitors (admin setting, default 10) is enforced in the route.
- Deleting the YouTube connection or the account cascades. The disconnect dialog also deletes the watchlist and says so.

### 3.2 `youtube_quota_usage`: shared budget counters (no YouTube data)

```sql
create table public.youtube_quota_usage (
  day     date not null,          -- America/Los_Angeles date (YouTube resets at PT midnight)
  bucket  text not null,          -- 'search' | 'search:user:<uuid>'
  used    integer not null default 0,
  primary key (day, bucket)
);
-- RLS on, no policies: service role only.
create function public.consume_youtube_quota(p_bucket text, p_amount int, p_limit int)
returns boolean ...  -- atomic: insert … on conflict do update set used = used + p_amount where used + p_amount <= p_limit
```

A pg_cron job deletes rows older than 7 days. The migration includes that job, so no manual DELETE is needed.

### 3.3 Settings: new columns on `channel_doctor_settings`

| Column | Default | Meaning |
|---|---|---|
| `discover_enabled` | `false` | Off until the audit is approved; admins can test it. |
| `discover_allowed_plans` | `{CREATOR,STUDIO}` | Plan gate. |
| `discovery_credit_cost` | 5 | Find competitors (uses search). |
| `research_credit_cost` | 15 | Full market research and opportunities. |
| `opportunity_credit_cost` | 3 | Deep-dive on one opportunity (more AI and thumbnails). |
| `max_competitors` | 10 | Active watchlist size. |
| `videos_per_competitor` | 50 | Uploads fetched per competitor (used for the baseline). |
| `search_calls_per_discovery` | 3 | |
| `search_daily_global_limit` | 80 | Leaves 20 of the 100 for admin testing and other features. |
| `discovery_runs_per_user_day` | 2 | |
| `embedding_models` | `{BAAI/bge-m3, Qwen/Qwen3-Embedding-0.6B}` | Checked on DeepInfra (type `embeddings`). |
| `opportunity_weights` | jsonb, section 7.2 | Validated: each weight 0–100, sum must be 100. |
| `max_competitor_thumbnails` | 10 | Vision calls per research run. |

### 3.4 Never saved

Search results, competitor titles, descriptions, stats, thumbnails, clusters, embeddings, prompts, AI responses, opportunities and reports. Error logs contain only `GoogleApiError.reason` codes and counts, never titles or queries. The user's search phrases are not logged either.

---

## 4. Server architecture

```
src/lib/youtube/
  public-client.ts          # YouTubePublicResearchService: search, channelsById/handle, resolveChannelInput
  quota-budget.ts           # consume_youtube_quota RPC wrapper, PT day
  discover/
    types.ts                # CompetitorCandidate, CompetitorProfile, MarketVideo, TopicCluster, Gap, Opportunity…
    settings.ts             # discover fields + zod (or extend ../settings.ts)
    watchlist.ts            # CRUD, user-scoped, limit checks
    discovery.ts            # CompetitorDiscoveryService
    research.ts             # orchestrator: the pipeline in section 5, emits stages
    competitor-analysis.ts  # baselines, outliers, upload cadence, format mix (pure)
    outliers.ts             # OutlierDetectionService (pure)
    embeddings.ts           # embed() + cosine + agglomerative clustering (pure except embed)
    topics.ts               # TopicClusteringService: normalize → embed → cluster → AI labels
    formats.ts              # rule-based format + AI fallback
    packaging.ts            # title mechanisms (pure) + optional thumbnail vision
    gaps.ts                 # ContentGapService (pure)
    scoring.ts              # OpportunityScoringService + confidence (pure)
    momentum.ts             # durable / momentum / one-off (pure)
    ai/
      schemas.ts            # zod for every AI output
      interpret.ts          # OpportunityAIService: explanations + angles
      originality.ts        # copy guard (section 8.3)
    opportunity.ts          # Opportunity object builder + schema (Phase 3 contract)
    __tests__/fixtures.ts   # clearly synthetic fixtures, test-only
```

All modules marked "pure" take plain data in and return plain data out. They make no network calls and are tested directly.

### 4.1 API routes (following the existing `/api/youtube/*` style)

| Route | Method | Purpose | Cost |
|---|---|---|---|
| `/api/youtube/discover/config` | GET | access, prices, limits, today's remaining search budget | – |
| `/api/youtube/discover/competitors` | GET | watchlist with **fresh** public channel info (1 unit per 50) | – |
| `/api/youtube/discover/competitors` | POST | add by `channelId` / URL / `@handle` / video URL (zod; resolves through the API) | – |
| `/api/youtube/discover/competitors/[channelId]` | PATCH, DELETE | label, group, active; remove | – |
| `/api/youtube/discover/discovery` | POST (stream) | find candidate competitors (uses search budget) | `discovery_credit_cost` |
| `/api/youtube/discover/research` | POST (stream) | full pipeline → opportunities | `research_credit_cost` |
| `/api/youtube/discover/opportunity` | POST (stream) | deep-dive on one opportunity: body is the opportunity's evidence video IDs only, and the server **re-fetches** them | `opportunity_credit_cost` |
| `/api/admin/channel-doctor` | GET, PUT | extended with discover fields | – |

Every route uses `requireUser`, zod input validation and the plan gate. The run guard allows one stream per user and has an hourly cap. Competitor IDs come from the user's own watchlist rows, so a user can't make the server research an arbitrary list of channels. Discovery queries are limited to 3 phrases of 80 characters each.

### 4.2 Public research client (`public-client.ts`)

- `searchVideos({ q, publishedAfter, regionCode, relevanceLanguage, maxResults: 50 })` calls `search.list type=video`, with only `fields=items(id/videoId,snippet/channelId)`. It **consumes the search budget before calling**. If YouTube then returns a quota error, the budget is not refunded, because the call was spent.
- `fetchChannelsById(ids)` calls `channels.list` in batches of 50, with snippet, statistics and contentDetails (the uploads playlist).
- `resolveChannelInput(text)` accepts:
  - `UC…` IDs and `/channel/UC…` URLs (no API call);
  - `@handle` URLs, via `channels.list forHandle` (1 unit);
  - `watch?v=` / `youtu.be` / `/shorts/` URLs, via `videos.list` → channelId (1 unit).
- Missing statistics (hidden subscriber count, likes turned off) become `null`, never 0, the same as Phase 1.

---

## 5. Research pipeline (one streaming request)

| Stage (shown to user) | Work | Data API units (10 competitors) |
|---|---|---|
| `your_channel`: "Reading your channel" | `fetchChannelDataset` + `analyzeChannel` (Phase 1, no AI). Also builds public-view baselines for *your* uploads, so comparisons use the same yardstick. | ~4 (+ Analytics API) |
| `competitors`: "Researching 8 channels" | `channels.list` (fresh), uploads playlist IDs | ~1 |
| `videos`: "Collecting 412 recent videos" | `playlistItems` (≤50) + `videos.list` per competitor, `mapLimit(4)`; partial failure → that channel marked unavailable | ~20 |
| `outliers`: "Comparing each video with its channel's usual" | section 6.1 | 0 |
| `topics`: "Grouping videos into topics" | normalize → embed (yours + theirs) → cluster → AI labels | 0 |
| `formats`: "Spotting formats and title styles" | rules + AI fallback | 0 |
| `gaps`: "Finding gaps against your channel" | section 7.1 | 0 |
| `scoring`: "Scoring opportunities" | section 7.2 | 0 |
| `angles`: "Writing original angles" | AI interpretation + originality guard | 0 |

The counts in stage labels are real. They are sent with the stage event (`{ stage, count }`). Typical run: about 30 Data API units, 0 search calls, about 5 embedding calls, 2–3 LLM calls, under 90 seconds. `maxDuration = 300`, the same as diagnosis.

Discovery (separate, cheaper run): `your_channel` (identity + top titles) → `queries` → `search` ("Searching YouTube: 3 phrases") → `candidates` ("Checking 37 channels") → `classify`.

---

## 6. Deterministic analysis

### 6.1 Baselines and outliers (`outliers.ts`)

Public data has only **lifetime** views. Comparing videos of different ages is the main trap:

- **Format split:** Shorts and long-form get separate baselines. The public API has no Shorts flag, so duration ≤ 180 s counts as *likely Short*. The flag is shown as an estimate.
- **Too new:** videos younger than 7 days are excluded from baselines and outliers and shown as "too new to judge". The threshold is configurable.
- **Baseline:** the median views of that channel's same-format uploads, aged 7–365 days, from the fetched uploads (up to 50). It is not limited to the 30/90-day window, so the sample is not tiny. The 30/90-day switch controls which videos are *candidates* for outliers and momentum.
- **Relative performance:** `views / baseline`, shown as "5.9×".
- **Robust check:** `z = (ln views − median ln views) / (1.4826 · MAD(ln views))`. A video is an outlier if `ratio ≥ 2` **and** `z ≥ 2`. Both thresholds live in `RULES.discover`.
- **Sample size → confidence:** n ≥ 12 high, 6–11 medium, below 6 the channel gets *"Insufficient sample size"* and none of its videos become outliers.
- **Degenerate cases:** baseline 0 or null, missing view counts (dropped and counted in limitations) or MAD = 0 (falls back to the ratio only, at medium confidence at most).
- **Output per outlier:** `{ views, baseline, ratio, sampleSize, confidence, ageDays, format }`, exactly the fields the PRD asks for.

The same functions run on the user's own uploads, using public views, so "You vs Competitor" compares like with like.

### 6.2 Competitor profile (`competitor-analysis.ts`)

Each profile includes:
- uploads in the last 30/90 days and the median gap between uploads;
- the Shorts/long split;
- the median views for each format;
- the outlier rate (outliers ÷ eligible videos);
- top clusters and top formats (filled in after topics run).

Subscriber count is shown but **never used** in scoring.

### 6.3 Topics (`topics.ts`, `embeddings.ts`)

1. **Normalize** each title: lowercase, remove emoji and hashtags, collapse year tokens (`2026` → `<year>`), strip filler ("best", "top", "সেরা", "official", "#shorts"), and use the first 300 characters of the description only when the title has fewer than 4 words.
2. **Embed** your titles and competitor titles with `bge-m3` in batches of 64.
3. **Cluster** with average-link agglomerative clustering on cosine similarity, threshold `RULES.discover.clusterSimilarity` (start at 0.72 and tune on fixtures). This is deterministic for a given input. Rules:
   - A cluster needs at least 3 videos from at least 2 channels; your channel counts as a channel.
   - Videos that don't fit any cluster go into "other" and are not forced into a topic.
4. **Label:** for each cluster the LLM receives up to 8 representative titles (closest to the centroid) and returns `{ clusterId, label, audienceProblem?, isProblemOriented }`. It can't merge, split or invent clusters: the zod schema only accepts the cluster IDs we sent.

This is how "Best car vacuum", "Best vacuum for car" and "Top car vacuums" end up in one cluster through embeddings, without over-clustering, because the threshold is tested against unrelated pairs.

### 6.4 Formats and packaging (`formats.ts`, `packaging.ts`)

**Rule-based first.** The rules cover English and Bangla patterns:
- comparison: `vs`, `বনাম`, `compared`;
- review: `review`, `রিভিউ`;
- tutorial: `how to`, `কিভাবে`;
- ranking or list: a leading number, `top N`;
- experiment: `I tested`, `I tried`;
- before/after;
- myth: `myth`, `really work`;
- news: `update`, `new`.

**The LLM handles only what the rules leave unclassified.** It returns `{ videoId, primary, secondary?, confidence }`. If it can't classify a title, the format stays unclassified instead of being forced into a category.

**Title mechanisms** are deterministic flags:
- comparison, number/list, question, how, why;
- "I tested", "before you buy";
- strong claim (superlatives), contrarian ("stop", "don't", "wrong"), transformation (before/after, "from X to Y").

**Thumbnails:** only the outlier thumbnails of each cluster (admin cap) go through `describeThumbnail`, and only if a vision model is configured and succeeds. The UI says "Thumbnail patterns: from N of M thumbnails". If no vision model ran, it says "not analyzed", never an inferred pattern.

### 6.5 Momentum (`momentum.ts`)

Each cluster gets one momentum label, based on its competitor videos:

| Label | Rule (all thresholds in `RULES.discover.momentum`) |
|---|---|
| **One-off spike** | exactly 1 outlier, from 1 channel |
| **Recent momentum** | ≥2 channels published in the last 30 days, and the 30-day share of the cluster's videos is ≥ 1.5× what an even spread over 90 days would give, and there is ≥1 recent outlier |
| **Durable demand** | present in ≥3 of the last 6 months across channels, with a median ratio ≥ 1 |
| **No clear signal** | anything else |

These labels feed the score and the confidence differently: a one-off spike caps confidence at Low.

---

## 7. Gaps, scoring and confidence

### 7.1 Gap engine (`gaps.ts`)

For each cluster we compute:
- `yourVideos`: how many of your videos are in the cluster (cosine to the centroid ≥ threshold), plus their Phase 1 labels (outperformer, typical or underperformer);
- `theirChannels`, `theirVideos`, `theirOutliers` and `theirRecent` (last 30 days);
- `formatsWorking`: the formats of the cluster's outliers;
- `yourFormats` and `mechanismsWorking` vs `yourMechanisms`.

| Gap | Rule | Evidence wording |
|---|---|---|
| A: Coverage | `yourVideos ≤ 1` and `theirOutliers ≥ 2` from ≥2 channels | "Under-covered on your channel in the analyzed sample" |
| B: Audience problem | the cluster is `isProblemOriented` (AI) and ≥3 channels cover it, while you have ≤1 video | Marked **AI-assisted**, so its confidence is at most Medium |
| C: Format | `yourVideos ≥ 2`, but none of them use a format that appears in ≥50% of the cluster's outliers | "Your videos on this topic use X; the outliers use Y" |
| D: Packaging | your videos in the cluster are underperformers (Phase 1) or have low CTR (Reach data, if any), and the outliers share ≥1 mechanism you never use | "Their stronger videos use comparisons; yours don't" |
| E: Emerging | momentum = Recent momentum and `theirVideos ≤ RULES.discover.lowSaturation` | "Emerging signal: requires validation" |

The UI never says "untapped" or "no competition". The approved wording is listed in section 11.

### 7.2 Opportunity score (`scoring.ts`): an internal decision-support score, 0–100

Each dimension is 0–100. The weights are admin-configurable, and the defaults are documented in `rules-config.ts`:

| Dimension | Default weight | How it is calculated |
|---|---|---|
| Channel fit | 25 | Cosine of the cluster centroid to the centroid of *your outperformers* (or all your videos if you have fewer than 3 outperformers), mapped 0.3→0 and 0.8→100. Plus 10 if your best-performing format matches. |
| Competitor performance | 20 | Median outlier ratio in the cluster, on a log scale: 1× → 0, 2× → 50, 8×+ → 100 |
| Momentum | 15 | Recent 90, Durable 70, One-off 30, None 10 |
| Content gap | 15 | The strongest gap type present: A 90, E 80, C 70, D 60, B 50, no gap 0 |
| Competition (inverted) | 10 | 100 minus a saturation index built from the number of channels and recent videos in the cluster, and how strong the incumbents are (their share of total views) |
| Production fit | 10 | Lookup from format to difficulty for *this* app's video engine (see below) |
| Phase 1 adjustment | 5 | See section 9 |

**Missing signals:** a dimension that can't be computed (for example, no Reach data for D) is dropped. The remaining weights are renormalized, and the card shows *"Scored on 5 of 7 signals"*.

**Production difficulty** is a lookup from format to Low, Medium or High. It reflects what the existing faceless video engine (script → scenes → voice) can make:
- Low: explainers, lists, documentary, news;
- Medium: tutorials, comparisons that need stock or product imagery;
- High: hands-on experiments, challenges, reactions.

The lookup is in config, so it can be tuned.

### 7.3 Confidence (separate from the score)

Confidence is computed separately from the score and never averaged into it. It is the **minimum** of:
1. **Sample:** the number of outlier videos and channels behind the opportunity. Fewer than 2 channels: Low. 2–3 channels: Medium. 4 or more channels with 3 or more outliers: High.
2. **Data completeness:** Low if 30% or more of the expected fields were missing or competitors were unavailable.
3. **Signal agreement:** gap, momentum and fit must all point the same way, or confidence drops one level.
4. **Recency:** Low if every supporting video is more than 90 days old (for momentum claims only).
5. **Classification reliability:** cluster cohesion (mean cosine to the centroid) below 0.6 caps confidence at Medium. Anything that relies on an AI-only gap (B) is capped at Medium.

Each opportunity shows *why* its confidence is what it is ("Medium — only 2 channels support this").

---

## 8. AI interpretation (`ai/interpret.ts`)

### 8.1 What the model receives

A compact JSON summary. It never sees raw API responses.
- **Your channel:** name, language, the top 5 cluster labels with counts, the best formats and the Phase 1 primary bottleneck in one line.
- **Up to 8 scored opportunities**, each with:
  - its cluster label;
  - up to 5 evidence items already worded as facts (with IDs);
  - up to 5 competitor outlier titles (needed for the angle task);
  - formats, gap types, scores and confidence.

The model never receives emails, tokens or analytics beyond what the summary contains.

### 8.2 What the model returns (zod)

```ts
{ opportunities: [{ id, headline (≤90), whyNow (≤240), recommendedAngle (≤100),
  angleRationale (≤200), audience (≤80), problem (≤120), suggestedFormat: enum,
  evidenceIds: string[] }] }
```

Sanitization (the same approach as Phase 1's `sanitize`):
- Unknown opportunity IDs or evidence IDs are dropped.
- **Any number in `whyNow` that isn't in the opportunity's evidence is rejected.** A regex compares each numeral against the allowed set.
- The format must be one of the enum values.
- Fields the schema doesn't define are stripped.
- One retry runs with the validation error appended. After that, the deterministic fallback is used: label plus evidence, with an angle template that reads *"Your take on …"* and is marked as not AI-written.

### 8.3 Originality guard (`ai/originality.ts`)

Each `recommendedAngle` is compared to **every** competitor title in its cluster:
- normalized token Jaccard ≥ 0.6, **or**
- embedding cosine ≥ 0.9, **or**
- a shared run of more than 5 identical words.

On a match, the angle is regenerated once with "too close to: …". If it still matches, it is replaced by the fallback. A unit test covers the PRD's exact example ("Best Portable Carpet Cleaner 2026").

### 8.4 Model jobs

| Job | Model (admin list) | Calls per research run |
|---|---|---|
| Embeddings | `BAAI/bge-m3` → `Qwen/Qwen3-Embedding-0.6B` | 3–8 (batches of 64) |
| Cluster labels + formats the rules missed | text list (DeepSeek V4 Flash → Nemotron) | 1–2 |
| Explanations + angles | text list | 1 (+1 retry max) |
| Competitor-type reasons (discovery) | text list | 1 |
| Thumbnails (deep-dive / outliers) | vision list (Qwen3-VL → Gemma 3) | ≤ `max_competitor_thumbnails` |

**Measured 19 Oct 2026** (cosine similarity, real DeepInfra calls):

| Model | Same meaning (EN–EN) | Same meaning (EN–Bangla) | Unrelated | Time |
|---|---|---|---|---|
| `BAAI/bge-m3` | 0.94 | 0.86 | 0.32 | 1.5 s |
| `Qwen/Qwen3-Embedding-0.6B` | 0.86 | 0.57 | 0.39 | 9.5 s |

`bge-m3` is the clear primary. Qwen pairs English and Bangla titles poorly, so it is only an emergency fallback. The clustering threshold is therefore stored **per model** in `RULES.discover`, and a run that falls back caps confidence at Medium.

`embed()` sits next to `callLLM` in `llm-providers.ts`. It calls DeepInfra's OpenAI-compatible embeddings endpoint, uses the same key, falls back across models and has a timeout. This is not a second AI integration.

---

## 9. Phase 1 integration

The research run recomputes `analyzeChannel` and uses it in three ways:

- **Channel fit uses your outperformers,** not all your videos, so we recommend more of what already works.
- **Bottleneck → adjustment (the 5-weight dimension, plus filters):**

| Phase 1 finding | Effect |
|---|---|
| `retention` primary | Prefer formats whose average % viewed on *your* channel is ≥ your median. Opportunities that need a new, unproven format get −50 on this dimension, and the explanation says "fix retention first: this recommendation reuses your strongest format". |
| `packaging` primary | Boost opportunities with gap D (packaging), where the topic is proven and packaging is the lever. |
| `topic` primary | Boost gap A/E opportunities whose fit is above median: new topics, still close to the audience. |
| `consistency` primary | Boost Low-difficulty opportunities. |
| strengths | The strong format is carried into `suggestedFormat` when it fits the cluster. |

- **Not enough of your own data** (Phase 1 `minVideosForDiagnosis` not met): fit falls back to topic similarity only, and confidence is capped at Medium. The UI says so.

---

## 10. Discovery: finding competitors

1. **Query suggestions (free, no search):** the LLM proposes 3 search phrases from your top 10 titles and your cluster labels, in your channel's language. The **user can edit or replace them** before running. The search region and language come from your channel's `snippet.country` and `defaultLanguage`.
2. **Search (≤3 calls):** `search.list type=video`, `publishedAfter` = 90 days ago, `maxResults=50`. Searching videos instead of channels finds channels that *currently make* this content.
3. **Dedupe** channel IDs, remove your own channel and the channels already on your watchlist, and keep the top 30 by how often they appeared across the three phrases.
4. **Fetch** those channels (1 unit) and their 15 latest uploads (≈30 + 30 units). Drop channels with no upload in the last 90 days.
5. **Relevance (deterministic):** cosine between the candidate's recent titles and your channel's titles, plus how often it appeared across queries. High, Medium or Low thresholds are in `RULES`.
6. **Classification:**
   - **Direct:** high topic similarity *and* a similar format mix (Shorts/long ratio and top formats).
   - **Adjacent:** medium topic similarity.
   - **Format competitor:** low topic similarity but ≥2 of your top formats or mechanisms in common. Search rarely surfaces these, so the UI also invites the user to paste channels they like.
   - The LLM writes 2–3 reason bullets **from the computed signals only** ("Same core topic: 8 of 15 recent titles match your topics").
7. The user ticks which candidates to save. Nothing is saved automatically.

---

## 11. UI (`/discover`)

Phase 1 taught us that users want the answer first, in large readable text. The PRD's 5 tabs therefore become **3 tabs plus a detail page**. Content gaps are not a separate place: they are a property of each opportunity, with a filter.

```
Discover
  [ Next videos ]   [ Market ]   [ Competitors ]
```

| Screen | What it shows |
|---|---|
| **First run** (no competitors) | One card: "Find your competitors" (search, shows today's remaining budget) **or** "Paste channels you already watch". It explains in one line that we only read public data. |
| **Next videos** (default) | "What should I make next?" The ranked list. Each card shows: rank, recommended angle (big), topic, score with the "internal score" label, confidence badge, 1-line why-now, format and difficulty chips, and gap-type chips. "See evidence" leads to the detail page. Filter by gap type. |
| **Market** | Answers "What's happening in my market?" with three sections: emerging topics (momentum labels), strongest outliers (video, views, baseline, ×, sample, confidence; links to YouTube), and popular formats/mechanisms. |
| **Competitors** | Grouped Direct, Adjacent and Format. Each row shows fresh name and avatar, relevance, uploads in 30 days, median views, outlier rate and the "Insufficient sample" state. Actions: add (search or paste), remove, change group, label. Checking 2–3 rows opens **Compare**: You vs A vs B, with upload rate, median views by format, outlier rate, top formats and top topics. Everything is computed by the same public-data method, and vanity totals are excluded. |
| **Opportunity detail** `/discover/opportunity/[id]` | Overview, Evidence (each item with source, metric, period and calculation), Market (competitor outliers), Your channel (your videos in the cluster and the Phase 1 link), Gap, Recommended angle, Format, Difficulty, Confidence and why. CTA: **Create video brief**. |
| **Brief placeholder** `/discover/brief` | Reads the Opportunity from `sessionStorage` and shows the fields Phase 3 will consume. It says "Script and video creation are coming next" and does not fake generation. |

Additional UI rules:
- **Progress:** reuse `ProgressSteps` with the real stages and counts from section 5.
- **Errors:** each `GoogleApiError` kind and domain error maps to an actionable message. Examples:
  - quota: "YouTube's daily search limit for our app is used up. You can still add competitors by pasting their channel link, or try again after <reset time>." The reset time is computed from Pacific midnight, so it shows 1 PM Bangladesh time during US daylight saving time and 2 PM outside it.
  - too few competitors: "Add at least 2 competitors with 6+ recent videos."
  - one competitor failed: shown as partial results, not a total failure.
- **Labels:** every derived number carries a small "ⓘ Calculated by Rendoza" tooltip. YouTube numbers are labelled "From YouTube".
- **Words we never use:** viral, guaranteed, hack, exploit, untapped, no competition.
- **Storage:** results go to `sessionStorage` under `cd:discover:{userId}:{channelId}:{window}`. The watchlist comes from the DB, fresh, on page load. Page loads never trigger research: research runs only when the user clicks **Run research**.

---

## 12. Phase 3 contract (`opportunity.ts`)

```ts
export const opportunitySchema = z.object({
  version: z.literal(1),
  id: z.string(),                     // stable hash of cluster centroid titles + window
  topic: z.string(), problem: z.string().nullable(), audience: z.string().nullable(),
  recommendedAngle: z.string(), angleSource: z.enum(['ai', 'fallback']),
  recommendedFormat: formatEnum, secondaryFormat: formatEnum.nullable(),
  gapTypes: z.array(z.enum(['coverage','audience_problem','format','packaging','emerging'])),
  scores: z.object({ total, channelFit, competitorPerformance, momentum, contentGap, competition, productionFit, phase1 }),
  signalsUsed: z.number(), momentum: momentumEnum,
  confidence: confidenceEnum, confidenceReasons: z.array(z.string()),
  productionDifficulty: z.enum(['low','medium','high']),
  evidence: z.array(evidenceSchema),            // reuses Phase 1 Evidence (id, statement, source, metric, period, calculation)
  competitorSignals: z.array(z.object({ videoId, channelId, ratio, views, baseline, sampleSize })),
  yourVideoIds: z.array(z.string()),
  window: z.enum(['30d','90d']), generatedAt: z.string(),
});
```

**Note for Phase 3:** if briefs are ever saved to the DB, save the user-authored brief fields (topic, angle, format, problem, audience). Do not save `competitorSignals` or titles. Those are Non-Authorized Data with a 30-day limit.

---

## 13. Privacy, security and quota checklist

- [ ] The DB holds only the watchlist (IDs) and quota counters. A test checks that no research route writes to any other table.
- [ ] RLS on `discover_competitors`. A user-scoping test confirms user B can't read or modify user A's rows.
- [ ] No titles, queries or AI text in logs. A test spies on `console.*` during a mocked run.
- [ ] Search budget is consumed atomically before each call. A test covers the global limit, the per-user limit and the PT day roll-over.
- [ ] Competitor IDs used in research come from the DB rows, not the request body.
- [ ] Inputs are validated with zod: URLs, handles, query length, window enum, and the opportunity deep-dive IDs (≤20, regex-checked).
- [ ] Derived metrics are labelled in the UI.
- [ ] Disconnecting deletes the watchlist, and the dialog text is updated.
- [ ] Privacy page section 4 adds Discover: public data of other channels is processed in memory, competitor channel IDs are saved, and the user can delete them. Terms are unchanged.
- [ ] The scraper in `youtube-search.ts` is retired before the audit.
- [ ] Audit / quota-extension form submitted with the "Analytics & Reporting" use case.

---

## 14. Tests (vitest, all network mocked, synthetic fixtures only)

| Area | Cases |
|---|---|
| Discovery | Valid search → candidates; pagination of uploads; dedupe across queries and against your channel and watchlist; relevance thresholds; budget exhausted → clear error, no API call; `resolveChannelInput` for every URL form and invalid input |
| Outliers | normal set; small sample (<6 → insufficient); extreme outlier (MAD path); MAD = 0; missing views; too-new videos; Shorts/long split |
| Topics | similar titles cluster (with a mocked embedding fixture); unrelated titles stay separate; empty input; AI label output with unknown cluster IDs → dropped |
| Gaps | user covered topic (no A); user missing topic (A); competitor-only single channel (no gap: fewer than 2 channels); insufficient evidence; format gap; packaging gap |
| Scoring | expected weighting on a hand-computed case; missing signals → renormalized and `signalsUsed`; confidence min-rule; one-off spike caps confidence; Phase 1 retention adjustment |
| Originality | exact copy rejected; near copy rejected; genuinely different angle passes |
| AI | valid output; invalid JSON → retry → fallback; missing fields; extra fields stripped; invented number rejected; unknown evidence IDs dropped |
| API | 401 without session on every route; plan gate 403; quota error → refund + message; DeepInfra down → fallback report, no charge lost; watchlist limit |
| Privacy | no DB writes beyond allowed tables; logs clean; user scoping |

---

## 15. Milestones

| # | Scope | Done when |
|---|---|---|
| **D1** Foundation | Migration (watchlist, quota table + RPC, settings columns); `public-client.ts`, `quota-budget.ts`; generic `streamAnalysis`; `embed()`; admin "Discover" section (incl. embedding model check and weights editor) | Typecheck + unit tests; Phase 1 still passes |
| **D2** Competitors | Watchlist CRUD and add-by-URL; discovery stream; Competitors tab and first-run screen | A real channel can find and save competitors |
| **D3** Research core | Fetch pipeline, baselines, outliers, competitor profiles, Compare view | Outlier tests pass; real-channel run under 60 s |
| **D4** Topics & formats | Embeddings, clustering, labels, format rules and AI fallback, mechanisms | Clustering fixtures pass; clusters reviewed on 2 real niches (English + Bangla) |
| **D5** Gaps & scoring | Gap engine, momentum, scoring, confidence, Phase 1 adjustments | Scoring tests pass with hand-checked numbers |
| **D6** AI interpretation | Explanations, angles, originality guard, fallback | AI tests pass; no copied angles on real runs |
| **D7** UI | Next videos, Market, Opportunity detail, Brief placeholder; error and empty states | Browser walk-through on desktop and mobile |
| **D8** Hardening | Thumbnail patterns (deep-dive), privacy page, scraper retirement, privacy, quota and security review, lint, typecheck, tests, production build | Checklist in §13 complete |

Rough size: D1–D3 are about 1.5× the size of Phase 1 M1–M3. D4–D6 are the novel parts.

---

## 16. Risks

| Risk | Mitigation |
|---|---|
| Search quota (100/day, all users) | Paste-a-channel path, budget table, discovery as a rare action, audit for an increase |
| Derived-metric policy / audit rejection | Feature flag, explicit labels, apply early, keep Phase 1 independent |
| Lifetime-views bias in outliers | Age floor, same-format baselines, robust z, conservative confidence |
| Shorts detection without an API flag | Duration heuristic shown as an estimate; separate baselines reduce the harm |
| Clustering quality (Bangla/English mix, short titles) | Multilingual embeddings, threshold tuned on real fixtures, "other" bucket, cohesion feeds confidence |
| LLM inventing numbers or copying titles | Number check, evidence-ID check, originality guard, deterministic fallback |
| Long run time on Vercel | `maxDuration 300`, `mapLimit`, partial results per competitor |
| `sessionStorage` size | Results store only the fields the UI uses (no descriptions), about 200 KB for 10 competitors |

---

## 17. Decisions (confirmed 19 Oct 2026)

1. **Output language:** angles and explanations follow the channel's main language (a Bangla channel gets Bangla). The user can switch it with a toggle.
2. **Prices and access are admin-controlled.** All credit costs, the plans that may use Discover, and every limit live in Admin → Channel Doctor → Discover. Nothing is hard-coded. The UI and the routes read the current values on every request. The values in §3.3 are only the defaults the migration seeds.
3. **Scraper:** retired in D8, before the audit is submitted.
4. **Audit:** submit the YouTube API audit / quota-extension form once D3 works.
