# Edit in Canva — Fully Editable Thumbnail Layers

## What changed (branch `feature/canva-integration`)

Clicking **Edit in Canva** on a thumbnail concept now tries to convert the
generated thumbnail into a **fully editable Canva design** using Canva's
Magic Layers image-to-design import API:

```
POST https://api.canva.com/rest/v1/image-to-design-imports
{ "image": { "asset_id": "<uploaded asset>" }, "title": "..." }
```

Every element Canva detects in the image (text, shapes, graphics, background
pieces) becomes a **separate editable layer** — the user can select, move,
restyle, or delete each part in the Canva editor, then click
**Sync from Canva** to pull the finished PNG back into the app.

## Why this was needed

The previous flow used `POST /rest/v1/designs` with `asset_id`. Per Canva's
docs, an asset passed that way is *"placed in the design as a single flat
image, which the user can move, resize, or replace, but not edit as separate
elements."* That is why the image opened in Canva but its parts could not be
edited.

## Flow

1. Thumbnail image is uploaded to the user's Canva account as an asset
   (unchanged).
2. **Editable-layers import** is attempted first
   (`createEditableDesignFromImage` in `src/lib/canva/client.ts`).
3. If the import succeeds → `method: 'editable-layers'` is returned and the
   Canva editor opens with separate layers.
4. If the user's Canva team lacks the Magic Layers capability (403) or the
   AI credit allowance is exhausted (429 `credit_quota_exceeded`), the route
   **falls back** to the previous flat single-image design and returns
   `method: 'flat-image'` plus a `notice` explaining why.

The frontend (`handleEditInCanva` in
`src/components/export/launch-kit/launch-kit-context.tsx`) shows a toast
matching whichever mode was used.

Passing `editableLayers: false` in the request body skips the import and
goes straight to the flat design (no AI credits consumed).

## Requirements for editable layers

- The Canva team must have the **Magic Layers** permission, which grants the
  `image_to_design_imports` capability. Without it the API returns 403 and
  the app falls back to the flat design.
- Each conversion consumes the user's **AI credit allowance**. Polling the
  job status does not consume credits.
- No new OAuth scopes are needed: `design:content:write` (already requested
  during Canva authorization) covers this endpoint.
- PNG/JPEG-style graphics convert best — the API is designed for flat,
  non-photographic images like posters, flyers, banners, and social graphics.
  Purely photographic backgrounds may split into less useful layers.

## Preview-API caveats

The image-to-design import API is currently a **preview API**:

- Canva may ship unannounced breaking changes without a new API version.
- Public integrations that use preview APIs will not pass Canva's app review
  process.

## Files touched

- `src/lib/canva/client.ts` — `createEditableDesignFromImage`,
  `CanvaCapabilityError`, `CanvaCreditQuotaError`
- `src/app/api/integrations/canva/create-design/route.ts` — import-first with
  flat-design fallback
- `src/components/export/launch-kit/launch-kit-context.tsx` — toast messaging
  per `method`
