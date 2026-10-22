# Channel Doctor — Phase 1 Architecture Plan

Implementation plan for [youtube-growth.md](youtube-growth.md) (Phase 1: YouTube Channel Diagnosis), based on an inspection of this repository on 19 Oct 2026. Branch: `feature/youtube-doctor`.

Feature name: **Channel Doctor**, route `/youtube-doctor`.

---

## 1. Decisions at a glance

| Topic | Decision |
|---|---|
| App sign-in | Reuse Supabase Auth (already Google sign-in). No new auth system. |
| YouTube authorization | A **separate** Google OAuth web-server flow with its own client, scopes `youtube.readonly` + `yt-analytics.readonly`. Not Supabase's Google provider (it does not keep provider refresh tokens reliably, and the channel's Google account can differ from the sign-in account). |
| Token storage | One new table `youtube_connections`. Tokens encrypted in the app with AES-256-GCM; key in env, not in the database. |
| Audit data | Never written to the database. One streaming request does fetch → calculate → AI → respond, and everything lives in that request's memory. The browser keeps the finished report in **`sessionStorage`** (this tab, this device) so a refresh does not lose it. |
| Progress | Real stages, streamed from the server as NDJSON events from the same request. |
| Text AI | Existing `callLLM` in `src/lib/llm-providers.ts`, with the model list chosen in the **admin panel** (default DeepSeek V4 Flash, then Nemotron Lightning). |
| Thumbnail AI | A vision model on DeepInfra chosen in the **admin panel** (default `Qwen/Qwen3-VL-30B-A3B-Instruct`, fallback `google/gemma-3-27b-it`). |
| Admin control | New admin page **Admin → Channel Doctor** controls on/off, credit prices, which plans can use it, AI models and usage limits. Stored in one settings row (section 5). |
| Validation | Add `zod` for request params and AI output. |
| Charts | Add `recharts` (line + bar charts with real axes and tooltips). |
| Tests | Add `vitest`; all YouTube and DeepInfra calls mocked. |
| Billing | Charge credits per analysis, refund on failure, same pattern as the Launch Kit. Prices set by the admin (see section 11). |

---

## 2. What the repository has today

| Area | Finding | Reuse for Channel Doctor |
|---|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript | Same |
| Routing | Pages in `src/app/(private)/…` (session-guarded layout), API in `src/app/api/…/route.ts` | `src/app/(private)/youtube-doctor`, `src/app/api/youtube/…` |
| Auth | Supabase Auth with Google sign-in; `src/middleware.ts` protects every `/api/*` route by default; server routes call `createClient()` from `src/lib/supabase/server.ts` then `auth.getUser()` | Same session check in every new route |
| Database | Supabase Postgres, SQL migrations in `supabase/migrations/` (+ appended to `supabase/schema.sql`), RLS everywhere. Extensions: `pgcrypto`, `supabase_vault`, `pg_cron` | One new table + migration |
| Service-role access | `src/lib/supabase-service.ts` returns a service-role client on the server | Used for the token table only |
| OAuth precedent | Canva integration: `src/app/api/integrations/canva/{auth,callback}` with state cookie and PKCE. Tokens are kept in HTTP-only cookies, not the DB | Copy the state/cookie/return-to pattern; store tokens in the DB instead (needed for refresh across devices) |
| YouTube today | `src/lib/youtube-search.ts` (public search + HTML parser for competitors) | Not used. Phase 1 needs authorized data only |
| LLM | `src/lib/llm-providers.ts` → `callLLM()` with model fallback, JSON parsing, `accept()` hook | Reuse for the diagnosis report |
| Credits | `deductCreditsRemote()` + refund on error in `src/app/api/generate-packaging/route.ts` | Same pattern |
| Plan tier | `effectiveTier()` / `profileEffectiveTier()` in `src/lib/input-limits.ts` | Plan gating if wanted |
| UI | Tailwind, dark app theme (`bg-bg-surface`, `card`, `btn-primary`, `input`), `lucide-react`, `react-hot-toast` via `src/lib/toast.ts` | Same components and tokens |
| Navigation | `src/components/sidebar.tsx` `NAV_ITEMS` | Add "Channel Doctor" |
| Long requests | Routes set `export const maxDuration = 120` | Diagnosis route needs 120–300 s |
| Missing | No test runner, no validation library, no chart library, no ESLint config file (ESLint 10 finds none), no `YOUTUBE_*` or Google OAuth env vars | Added by this plan |

---

## 3. Integration risks

1. **Impressions and CTR come only from the Reporting API (confirmed).** The on-demand Analytics API (`reports.query`) does not offer them; developers report a 400 "Unknown identifier" when asking for them. Google added them to the bulk **Reporting API** on 15 Jan 2026 as the `channel_reach_basic_a1` report (dimensions `date, channel_id, video_id`; metrics `video_thumbnail_impressions`, `video_thumbnail_impressions_ctr`). A reporting job must exist first: the first files arrive within about 48 hours, and a new job backfills the 30 days before it was created. Data for days before that is never generated. So the job is created **the moment a channel connects** (section 6), and until the first files arrive CTR shows "Available from <date>". The packaging rules run only when CTR exists. Never replace CTR with views.
2. **Google OAuth verification.** YouTube scopes are sensitive scopes. While the consent screen is in *Testing*, only listed test users can connect, and their refresh tokens expire after 7 days. Public launch needs Google's app verification (privacy policy, demo video, scope justification). Plan 2–6 weeks.
3. **Brand accounts.** A creator often owns the channel through a Brand Account. Google's account chooser handles this at consent time; `channels.list?mine=true` then returns that channel. If it returns zero channels, ask the user to reconnect and pick the channel's account. Never guess.
4. **Function duration.** A full diagnosis (about 20 API calls + 1 vision batch + 1 LLM call) should take 20–60 s. Keep `maxDuration = 300` and confirm the hosting plan allows it.
5. **Retention is one request per video.** The retention report accepts a single video per query, so the channel diagnosis only pulls retention for a capped set (8 videos). The video page pulls it for one video.
6. **Middleware and the OAuth callback.** `/api/*` requires a session. The callback is a top-level GET from Google, so the Supabase session cookie (SameSite=Lax) is sent and this works. Keep the callback under `/api/youtube/oauth/callback`.
7. **Data sent to DeepInfra.** Titles, thumbnails and aggregate metrics leave our servers for inference. The privacy text must say this plainly and must not promise anything about DeepInfra's own retention.

---

## 4. Architecture

```
Browser (/youtube-doctor)
   │  POST /api/youtube/diagnosis {range: "28d"}        ← NDJSON stream
   ▼
Route handler (session check, credits)
   │
   ├─ connection-service ── youtube_connections (encrypted tokens) ── token refresh
   ├─ data-client      ── YouTube Data API v3  (channel, uploads playlist, videos)
   ├─ analytics-client ── YouTube Analytics API (daily, per-video, traffic, retention)
   │
   ├─ normalize   → typed ChannelDataset (in memory)
   ├─ metrics     → totals, period comparison, baselines
   ├─ videos      → relative performance per video
   ├─ retention   → anomalies for capped video set
   ├─ titles      → deterministic title features
   ├─ thumbnails  → vision model (DeepInfra), structured findings
   ├─ diagnosis   → rules → Evidence[] + candidate bottlenecks
   ├─ ai-report   → callLLM(compact payload) → zod-validated report
   │
   └─ stream: {stage} … {stage} … {result: DiagnosisResult}   → nothing persisted
```

### File layout

```
src/lib/youtube/
  config.ts              env validation, scopes, constants
  crypto.ts              AES-256-GCM encrypt/decrypt for tokens
  oauth.ts               auth URL, code exchange, refresh, revoke
  connection-service.ts  load/save/delete connection, getValidAccessToken()
  google-fetch.ts        fetch with timeout, bounded retry, quota/auth error mapping
  data-client.ts         channels.list, playlistItems.list, videos.list
  analytics-client.ts    reports.query wrappers (one function per report)
  normalize.ts           API rows → typed dataset
  types.ts               ChannelDataset, VideoStats, Evidence, DiagnosisResult …
  analysis/
    baselines.ts         medians, percentiles, small-sample handling
    period.ts            date ranges, previous comparable period
    videos.ts            relative performance, age buckets
    retention.ts         validate, normalize, detect drops/spikes
    titles.ts            title features
    thumbnails.ts        vision model calls + schema
    rules.ts             configurable bottleneck rules → Evidence
    confidence.ts        confidence from sample size and signal strength
  ai/
    report-schema.ts     zod schema + enums + length limits
    report-prompt.ts     system prompt + compact payload builder
    report.ts            callLLM + validation + evidence-id check
  redact.ts              safe logging helpers

src/app/api/youtube/
  oauth/start/route.ts       GET  → redirect to Google
  oauth/callback/route.ts    GET  → exchange code, save connection, redirect
  connection/route.ts        GET status · DELETE disconnect (+ revoke)
  videos/route.ts            GET  paginated list of the channel's videos (picker)
  diagnosis/route.ts         POST streaming channel diagnosis
  videos/[videoId]/analysis/route.ts   POST streaming single-video analysis

src/app/(private)/youtube-doctor/
  page.tsx                   intro / connected / configure / progress / report
  video/[videoId]/page.tsx   single-video analysis

src/components/youtube-doctor/
  intro-card.tsx, channel-header.tsx, range-picker.tsx, progress-steps.tsx,
  metric-card.tsx, trend-chart.tsx, video-table.tsx, bottleneck-card.tsx,
  evidence-list.tsx, action-list.tsx, limitations-card.tsx,
  retention-chart.tsx, packaging-panel.tsx, disconnect-dialog.tsx
```

---

## 5. Database: what is saved and what is not

### Saved (one new table)

```sql
create table public.youtube_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  channel_id        text not null,
  channel_title     text,           -- shown in the UI without calling YouTube
  channel_thumbnail text,
  access_token_enc  text,           -- AES-256-GCM, base64(iv|tag|ciphertext)
  refresh_token_enc text,
  token_expires_at  timestamptz,
  scopes            text[] not null default '{}',
  reporting_job_id  text,           -- YouTube Reporting API job for channel_reach_basic_a1
  reporting_job_created_at timestamptz,
  status            text not null default 'active'
                    check (status in ('active','needs_reauth','revoked')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.youtube_connections enable row level security;
-- No policies for anon/authenticated: only the server (service role) reads or writes,
-- always filtered by the session user's id. Token columns never leave the server.
```

One connection per user in Phase 1 (`unique(user_id)`). Reconnecting a different channel replaces the row.

`channel_title` and `channel_thumbnail` are identity data needed to show the connection, not audit data. They are refreshed on every analysis.

### Saved: admin settings (one row)

Configuration, not user data. Every value is editable from **Admin → Channel Doctor**.

```sql
create table public.channel_doctor_settings (
  id                         int primary key default 1 check (id = 1),  -- single row
  enabled                    boolean not null default true,
  allowed_plans              text[]  not null default '{STARTER,CREATOR,STUDIO}',
  diagnosis_credit_cost      int     not null default 10 check (diagnosis_credit_cost >= 0),
  video_analysis_credit_cost int     not null default 3  check (video_analysis_credit_cost >= 0),
  text_models                text[]  not null default '{deepseek-ai/DeepSeek-V4-Flash-0731,nvidia/NVIDIA-Nemotron-3.5-Lightning}',
  vision_models              text[]  not null default '{Qwen/Qwen3-VL-30B-A3B-Instruct,google/gemma-3-27b-it}',
  max_videos                 int     not null default 100 check (max_videos between 10 and 200),
  max_retention_videos       int     not null default 8   check (max_retention_videos between 0 and 20),
  max_thumbnails             int     not null default 12  check (max_thumbnails between 0 and 24),
  hourly_limit_per_user      int     not null default 10  check (hourly_limit_per_user between 1 and 100),
  updated_at                 timestamptz not null default now()
);
insert into public.channel_doctor_settings default values;

alter table public.channel_doctor_settings enable row level security;
create policy "Admins manage channel doctor settings" on public.channel_doctor_settings
  for all using (public.is_admin()) with check (public.is_admin());
-- Users never read this table directly; they get the safe subset from GET /api/youtube/config.
```

Model lists are ordered: the first is tried first, the rest are fallbacks. `allowed_plans` uses the effective tier (`profileEffectiveTier`), so an expired plan counts as TRIAL. Put `TRIAL` in the list to let trial users try it.

The server reads this row on every request (no in-memory cache across requests), so admin changes apply immediately.

### Short-lived OAuth state (cookies, not DB)

| Cookie | Content | Lifetime |
|---|---|---|
| `yt_oauth_state` | random 32 bytes hex | 10 min, HTTP-only, SameSite=Lax |
| `yt_oauth_verifier` | PKCE code verifier | 10 min |
| `yt_oauth_return` | validated relative path | 10 min |

### Never saved

Raw channel/video responses, daily analytics, CTR or watch-time data, retention curves, thumbnails, transcripts, prompts, AI output, reports, "last analyzed" time. No audit-history table. No cache.

### Optional usage counter

If you want usage stats or rate limits, keep only `(user_id, kind, created_at)` with no channel data. This is billing metadata, not audit data. The existing credit deduction already gives you usage tracking, so this is optional.

---

## 6. OAuth flow

1. **Start** `GET /api/youtube/oauth/start?return_to=/youtube-doctor`
   - Session required.
   - Create `state` and a PKCE verifier/challenge and set the cookies above.
   - Redirect to `https://accounts.google.com/o/oauth2/v2/auth` with `response_type=code`, `access_type=offline`, `prompt=consent select_account`, `include_granted_scopes=true`, the two scopes, `code_challenge`, `state`.
2. **Callback** `GET /api/youtube/oauth/callback`
   - Google `error=access_denied` → redirect to `/youtube-doctor?yt=cancelled`.
   - The state must match the cookie (constant-time compare). Otherwise 400 and clear the cookies.
   - Exchange the code at `https://oauth2.googleapis.com/token` (server, with the client secret and verifier).
   - Check that both scopes were granted. If not: `?yt=missing_scope`.
   - Call `channels.list?part=snippet,statistics,contentDetails&mine=true`. 0 items → `?yt=no_channel` (and don't save anything). 1 item → save. More than 1 → save nothing and show a picker (rare, handled with a short-lived signed cookie holding only the channel IDs).
   - Create the Reporting API job: `POST https://youtubereporting.googleapis.com/v1/jobs {reportTypeId: "channel_reach_basic_a1", name: "channel-doctor"}` (first check `jobs.list` and reuse an existing job for that report type). Store the job ID and its creation time. If this fails, the connection still succeeds and the next analysis tries again.
   - Upsert the connection with encrypted tokens. **If Google returned no refresh token, keep the existing one**; if there is none at all, set `needs_reauth`.
   - Clear the cookies and redirect to `return_to?yt=connected`.
3. **Using tokens** `getValidAccessToken(userId)`: decrypt; if it expires within 2 minutes, refresh. On `invalid_grant`, set `status='needs_reauth'` and throw a typed `ReauthRequiredError` so the UI shows "Reconnect YouTube".
4. **Disconnect** `DELETE /api/youtube/connection`: delete the reporting job (`DELETE /v1/jobs/{id}`) so YouTube stops generating files, then POST the refresh token (or access token) to `https://oauth2.googleapis.com/revoke`, then delete the row. The response reports `{revokedAtGoogle: true|false}`, so the UI only says "access revoked at Google" when it really happened.

---

## 7. YouTube API calls

All calls go through `google-fetch.ts`: 15 s timeout, up to 2 retries with backoff for 429/500/503 only, never retry 400/401/403 (except one refresh-and-retry on 401).

### Data API v3 (quota: 10,000 units/day per Google project)

| Purpose | Request | Units |
|---|---|---|
| Channel identity | `channels.list part=snippet,statistics,contentDetails mine=true` | 1 |
| Recent uploads | `playlistItems.list part=contentDetails playlistId=<uploads> maxResults=50` (2 pages max = 100 videos) | 1 per page |
| Video details | `videos.list part=snippet,contentDetails,statistics id=<50 ids>` | 1 per 50 |

**Never use `search.list`** (100 units each). A full diagnosis costs about 5 units, so the daily quota supports roughly 2,000 diagnoses.

Use `fields=` to request only the needed fields (title, publishedAt, duration, thumbnails, view/like/comment counts).

### Analytics API v2 (`GET https://youtubeanalytics.googleapis.com/v2/reports`, `ids=channel==MINE`)

| Report | dimensions | metrics | Notes |
|---|---|---|---|
| Daily trend | `day` | `views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost` | Current and previous period |
| Per-video | `video` | `views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained` | `sort=-views`, `maxResults=200` |
| Traffic sources | `insightTrafficSourceType` | `views,estimatedMinutesWatched` | Channel level, and per video on the video page |
| Retention | `elapsedVideoTimeRatio` | `audienceWatchRatio,relativeRetentionPerformance` | `filters=video==ID`, one video per request |
| Impressions / CTR | Reporting API, not `reports.query` | — | See below |

### Reporting API (impressions and CTR)

Same OAuth token and the same `yt-analytics.readonly` scope; no extra permission.

1. `GET https://youtubereporting.googleapis.com/v1/jobs/{jobId}/reports?startTimeAtOrAfter=<period start>&startTimeBefore=<period end>` lists one report file per day.
2. Download each file's `downloadUrl` (CSV) with the access token, in parallel (max 6 at a time), straight into memory.
3. Parse and sum per video: `impressions = Σ video_thumbnail_impressions`, `clicks = Σ impressions × ctr`, so `ctr = clicks / impressions`. Never average daily CTRs.
4. If some days are missing (job too new), report CTR only for the covered days and say so: "CTR covers 12 of 28 days (reporting started 7 Oct)". With no files at all: "Impressions and CTR will be available from <job created + 2 days>".
5. Nothing is written to disk or the database; the parsed rows are discarded with the request.

A 90-day range means up to 90 small CSV downloads, which is acceptable inside one request; cap at 90 and skip on timeout with a limitation note.

Every report is wrapped in `Result<T> = {ok: true, data} | {ok: false, reason}` so one failure becomes a limitation, not a crash.

### Date ranges

- `28d` and `90d` end on the **last fully reported day** (today minus 2 days, since YouTube Analytics data lags).
- The previous period has the same number of days, immediately before.
- The UI always shows the exact dates, for example "28 days: 19 Sep – 16 Oct 2026, compared with 22 Aug – 18 Sep".

---

## 8. Deterministic analysis engine (examples)

Every rule produces **evidence objects** first. The AI can only reference these IDs.

```ts
interface Evidence {
  id: string;                    // "ev_ctr_low_video_abc123"
  kind: 'metric' | 'comparison' | 'retention' | 'title' | 'thumbnail' | 'limitation';
  category: 'packaging' | 'retention' | 'topic' | 'acquisition' | 'consistency' | 'strength' | 'data';
  statement: string;             // human sentence built from numbers, not by the AI
  values: Record<string, number | string | null>;
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  videoIds?: string[];
}
```

Thresholds live in `rules.ts` as one config object, so they are easy to tune and test.

### Baselines

- Use the **median** of the channel's own videos in the period (not the mean, so one viral video does not distort it).
- Need at least 5 videos for a baseline. With 3–4, mark confidence `low`. With fewer than 3, emit `insufficient_evidence` for that comparison.
- **Missing is `null`, never `0`.**

### Relative video performance

Videos of different ages are not compared on lifetime views. Example:

- Age buckets: 0–7 days, 8–30 days, 31–90 days, 90+ days.
- `relativeViews = video.periodViews / median(periodViews of videos in the same bucket)`.
- "Outperformer" when ≥ 2.0×, "underperformer" when ≤ 0.5×, only when the bucket has at least 4 videos.

### Example rules

| Bottleneck | Fires when (all must hold) | Example evidence statement |
|---|---|---|
| Packaging | CTR available; video CTR ≤ 0.7 × channel median CTR; impressions ≥ 1,000; at least 3 such recent videos | "4 of your last 10 videos had a CTR at or below 70% of your channel median (3.1% vs 4.6%), each with over 1,000 impressions." |
| Retention | Average percentage viewed ≤ 0.8 × channel median on ≥ 3 recent videos, **or** retention anomalies in the first 30 s on ≥ 3 of the sampled videos | "On 3 of 8 sampled videos, more than 35% of viewers left in the first 30 seconds." |
| Topic | ≥ 3 recent underperformers (≤ 0.5× bucket median) **and** their packaging and retention look normal | Labelled a hypothesis with `low`/`medium` confidence only |
| Acquisition | "Browse features" + "Suggested videos" < 30% of views while views fall versus the previous period | "Only 18% of views came from Browse and Suggested; 61% came from external sources." |
| Consistency | Gaps between uploads vary a lot (coefficient of variation > 1) or no upload in the last 30 days | "Your last 8 uploads were 3 to 41 days apart." |
| Insufficient evidence | Fewer than 5 videos in the period, or key reports unavailable | "Only 2 videos were published in this period, so video comparisons are not reliable." |

### Retention engine

1. Drop points outside `0 ≤ ratio ≤ 1` and sort by `elapsedVideoTimeRatio`.
2. Convert each point to seconds with the video duration.
3. Compute the drop between neighbouring points. The **expected** drop is the median drop across the curve.
4. **Steep drop:** a drop > max(3 percentage points, 2.5 × median drop), outside the first 3% of the video (intro decay is normal and reported separately).
5. **Rewatch spike:** `audienceWatchRatio` rises by > 2 percentage points versus the previous point.
6. **Relative weakness:** where available, `relativeRetentionPerformance` < 0.35 across a 10% stretch of the video.
7. Each anomaly gets a timestamp, severity (by size), and confidence (by the video's views in the period: < 500 views → `low`).

No transcript in Phase 1: captions download needs `youtube.force-ssl`, which is beyond the minimum scopes. The UI shows the timestamp and the signal, with a "watch this moment" link (`https://youtu.be/ID?t=SECONDS`). It does not claim to know what was said.

### Title features (deterministic, no AI)

Length in characters, words, digits, question mark, brackets/parentheses, ALL CAPS words, and the first 3 words. These are compared between the channel's top and bottom thirds. The AI then interprets clarity and promise using these features plus the title text.

---

## 9. AI models and their jobs

| Job | Model | Why | Input / output |
|---|---|---|---|
| Diagnosis report (interpretation, priorities, wording) | `text_models` from admin settings, default DeepSeek V4 Flash → Nemotron 3.5 Lightning | Already benchmarked in this app for structured JSON; cheap and fast | ~6–10k tokens in (compact payload), ~2k out, JSON |
| Thumbnail analysis | `vision_models` from admin settings, default `Qwen/Qwen3-VL-30B-A3B-Instruct` → `google/gemma-3-27b-it` | Both accept image input on DeepInfra, have OCR (text density) and structured output, are non-reasoning (fast) and cheap | Up to `max_thumbnails` (default 12: top 6 + bottom 6), one image per request, 4 in parallel, JSON per image |
| Title interpretation | Same call as the diagnosis report | Avoids an extra call | Title text + features |
| Single-video explanation | Same text model | | One video's evidence |

### Admin model control

- `callLLM` gets an optional `models` list. Without it, it keeps today's hardcoded order, so other features are unaffected.
- A model not in the known list is called without `response_format: json_object` and parsed with the existing `parseJsonObject` (safe for any model).
- **Saving a model in the admin page validates it first** through `api.deepinfra.com/models/{id}`: the model must exist and be a text-generation model, and a vision model must have the `multimodal` tag. This blocks the "image sent to a text-only model" mistake the PRD warns about.
- A **Test** button next to each list runs one small real request (a sample thumbnail for vision) and shows the time taken and whether the JSON was valid.

Before setting the default vision model, run both candidates on 10 real thumbnails and pick by JSON validity and accuracy (same method used for the earlier model benchmark). Prices from the DeepInfra model list (per 1M tokens): Qwen3-VL-30B ≈ $0.15 in / $0.60 out, Gemma 3 27B ≈ $0.08 / $0.16. A full diagnosis costs well under $0.01 in AI fees.

### Thumbnail output (per image, validated)

```json
{
  "subject": "a person holding a broken phone",
  "subjectSizePct": 35,
  "textOnImage": "IT BROKE",
  "wordCount": 2,
  "contrast": "high",
  "background": "simple",
  "faceVisible": true,
  "readableAtSmallSize": true
}
```

The deterministic layer then compares top vs bottom thirds, for example: "5 of 6 top videos have a visible face; 1 of 6 weaker videos do."

### Report generation rules

- The system prompt says: use only the given evidence; every claim must cite `evidenceIds`; hypotheses must be marked `isHypothesis: true`; no numbers that are not in the payload.
- Titles and descriptions are untrusted text: they are passed inside a clearly delimited data block, and the prompt says to ignore instructions found in them.
- The payload contains no tokens, emails, or channel IDs beyond what's needed.
- After parsing: zod validation, then drop any `evidenceIds` that don't exist. A section left with no valid evidence is removed.
- If the AI fails or returns invalid JSON twice, the response still contains every deterministic finding plus `aiStatus: "unavailable"`, and the UI says "AI summary unavailable; showing measured findings."

---

## 10. API routes

| Route | Method | Purpose | Response |
|---|---|---|---|
| `/api/youtube/config` | GET | What the UI needs from admin settings | `{enabled, hasAccess, diagnosisCost, videoCost, allowedPlans}` (no model names needed) |
| `/api/admin/channel-doctor` | GET / PUT | Admin settings (admins only, like other `/api/admin/*` routes) | Settings row; PUT validates models first |
| `/api/admin/channel-doctor/test-model` | POST `{kind, modelId}` | Admin "Test" button | `{ok, ms, validJson, error?}` |
| `/api/youtube/oauth/start` | GET | Start OAuth | 302 to Google |
| `/api/youtube/oauth/callback` | GET | Finish OAuth | 302 to `/youtube-doctor?yt=…` |
| `/api/youtube/connection` | GET | Status + channel identity | `{connected, status, channel:{id,title,thumbnail,url,subscriberCount?,videoCount?}}` |
| `/api/youtube/connection` | DELETE | Disconnect + revoke | `{revokedAtGoogle}` |
| `/api/youtube/videos` | GET | Video picker (`cursor`, max 50) | `{videos:[{id,title,publishedAt,thumbnail}], nextCursor}` |
| `/api/youtube/diagnosis` | POST `{range:'28d'\|'90d'}` | Full diagnosis | NDJSON: `{"type":"stage","stage":"fetch_channel"}` … `{"type":"result","data":DiagnosisResult}` or `{"type":"error",…}` |
| `/api/youtube/videos/[videoId]/analysis` | POST `{range}` | One video | NDJSON, same shape |

Every route: session user from `auth.getUser()`, never a user ID from the body; zod-validated input; the video route checks the video belongs to the connected channel.

Stages (real, in order): `connect`, `fetch_channel`, `fetch_analytics`, `compare_videos`, `retention`, `packaging`, `ai_report`, `done`.

---

## 11. Credits and plan access

All values come from `channel_doctor_settings` and are changed in **Admin → Channel Doctor**.

| Action | Default cost | Notes |
|---|---|---|
| Connect / disconnect | Free | Allowed even for plans without access, so a user can disconnect after a downgrade |
| Channel diagnosis | 10 credits (`diagnosis_credit_cost`) | Deducted at start, refunded if it fails before producing results |
| Single-video analysis | 3 credits (`video_analysis_credit_cost`) | Same refund rule |

- **Plan access:** `allowed_plans` (default Starter, Creator, Studio). A user without access sees the intro with an "Upgrade to use Channel Doctor" button instead of Analyze. The server checks again on every analysis route.
- **Feature switch:** `enabled = false` hides the sidebar item and makes the routes return 503 "temporarily unavailable".
- **Limits:** one analysis at a time per user, and at most `hourly_limit_per_user` per hour, so the Google quota stays safe.
- The cost shown on the Analyze button comes from `GET /api/youtube/config`, and the server always charges from the database value, never from the request.

---

## 12. Screens

| # | Screen | Key contents |
|---|---|---|
| 1 | Intro (not connected) | "Understand Why Your Channel Isn't Growing", one paragraph, **Connect YouTube**, privacy note: "We fetch your channel data when you run an analysis and don't store it on our servers. The report is kept only in this browser tab until you close it. Titles, thumbnails and summary metrics are sent to our AI provider to write the report." |
| 2 | Google consent | Handled by Google; return states `connected`, `cancelled`, `missing_scope`, `no_channel`, `error` shown as a banner |
| 3 | Connected | Avatar, name, URL, subscribers, videos, status chip, **Analyze Channel**, **Disconnect** |
| 4 | Configure | 28 / 90 days, exact dates, credit cost, "some metrics may be unavailable" |
| 5 | Progress | The 7 real stages with done/active/pending states, no fake percentage |
| 6 | Report | Header with range and session-only "analyzed at"; metric cards (value, previous period, tooltip, "not available" state); trend charts; top/under-performers table with relative-performance badges; primary bottleneck, secondary, strengths, each expandable to evidence; prioritized actions; limitations |
| 7 | Video analysis | Metrics vs channel median, traffic sources, retention chart with anomaly markers and "watch this moment" links, packaging panel (title features + thumbnail findings), recommendations |
| 8 | Disconnect dialog | What will happen, then the honest result ("Access revoked at Google" or "Removed from our app; revoke it at myaccount.google.com/permissions") |

| A | Admin → Channel Doctor (`/admin/channel-doctor`) | On/off switch; plan checkboxes (Trial, Starter, Creator, Studio); two credit inputs; ordered text-model list and vision-model list with add/remove/reorder, validation and **Test** buttons; limits (videos, retention videos, thumbnails, hourly runs); Save |

Sidebar: add `{ href: '/youtube-doctor', label: 'Channel Doctor', icon: Stethoscope }` (hidden when the feature is off), and an admin link next to `/admin/models`.

### Keeping results in sessionStorage

- Key: `channel-doctor:v1:{userId}:{channelId}:{range}`, value `{analyzedAt, result}`. Single-video results: `channel-doctor:v1:{userId}:{channelId}:video:{videoId}:{range}`.
- On page load the latest saved report for the connected channel is shown with "Analyzed at 14:32 · Run again".
- `sessionStorage` lives only in that browser tab and is cleared when the tab is closed. Nothing goes to our server or database.
- Cleared on disconnect, on sign-out, and when the connected channel changes. Reading it is wrapped in try/catch; if storage is unavailable or full, the page still works without it.
- Only the finished report is stored (typically 30–100 KB), never tokens or raw API responses.

---

## 13. Privacy and logging checklist

- No `console.log` of API responses, prompts or tokens in `src/lib/youtube/**`. Errors are logged with `redact()` (status code, report name, user ID only).
- No `fetch` caching: every Google call uses `cache: 'no-store'`.
- Thumbnails are passed to the vision model as `i.ytimg.com` URLs that we validate (host allowlist). Nothing is downloaded or stored.
- A test asserts that the diagnosis flow performs no inserts other than credit changes.
- The only browser storage is the `sessionStorage` report described in section 12; it is cleared on disconnect and sign-out.
- The privacy policy page gets a "YouTube data" section: scopes, what is stored (connection only), deletion on disconnect, and a link to the Google API Services User Data Policy.

---

## 14. Tests (vitest, all mocked)

| Area | Examples |
|---|---|
| Auth | Routes return 401 without a session; tokens never appear in any response body; user A cannot read user B's connection |
| OAuth | State mismatch → 400; `access_denied` → cancelled redirect; missing refresh token keeps the old one; `invalid_grant` → `needs_reauth` |
| Reporting API | Existing job is reused; CTR = Σclicks / Σimpressions across days; missing days produce a coverage note; no files → "available from" date; disconnect deletes the job |
| Clients | Pagination stops at the cap; 403 `quotaExceeded` maps to a quota error; 401 refreshes once; an unsupported report becomes a limitation |
| Engine | Median with even/odd counts; baselines with 2, 4, 10 videos; age buckets; `null` stays `null`; retention normalization and drop detection on fixture curves |
| AI | Invalid JSON → deterministic fallback; unknown evidence IDs are removed; schema length limits enforced |
| Admin settings | Non-admins get 403; a text-only model is rejected for the vision list; costs and plans come from the DB, not the request; a plan outside `allowed_plans` gets 403; `enabled=false` returns 503 |
| Privacy | No DB writes during diagnosis (mock the client and assert calls) |

Add `"test": "vitest run"` and `"typecheck": "tsc --noEmit"` scripts.

---

## 15. Environment and Google Cloud setup

```bash
# Google OAuth (YouTube connection, separate from Supabase sign-in)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://<domain>/api/youtube/oauth/callback
# 32-byte key, base64. Generate: openssl rand -base64 32
YOUTUBE_TOKEN_ENCRYPTION_KEY=
```

AI models are not env vars: they are set in **Admin → Channel Doctor** (section 9).

No `YOUTUBE_API_KEY` is needed: every call in Phase 1 is for the user's own channel and uses their OAuth token.

`next.config.mjs` → `images.remotePatterns` needs `i.ytimg.com` (video thumbnails) and `yt3.ggpht.com` (channel avatars).

Google Cloud steps:
1. Create (or reuse) a project, enable **YouTube Data API v3**, **YouTube Analytics API** and **YouTube Reporting API**.
2. OAuth consent screen: External, app name, support email, privacy policy URL, terms URL, scopes `youtube.readonly` and `yt-analytics.readonly`.
3. While in Testing: add your own and test users' Google accounts (max 100; tokens expire after 7 days).
4. Credentials → OAuth client ID → Web application. Redirect URIs: `http://localhost:3000/api/youtube/oauth/callback` and the production URL, exactly.
5. Before launch: submit for verification with a demo video of the connect → analyze → disconnect flow.

---

## 16. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | **Spike** (½ day): connect a real channel with a throwaway script, call every report in section 7, create a Reporting API job and check its files 2 days later | Real responses saved as test fixtures (with personal data removed) |
| M1 | Foundation: migrations (connections + settings), crypto, OAuth start/callback, connection GET/DELETE, `/api/youtube/config`, admin settings page and API, intro + connected screens | Connect/disconnect work; admin can change cost, plans and models |
| M2 | Data layer: Data + Analytics clients, normalization, `Result` handling | Dataset for a real channel, mocked tests pass |
| M3 | Engine: baselines, video comparison, retention, titles, rules, evidence | Fixture tests pass; deterministic report renders |
| M4 | AI: vision benchmark + thumbnail module, report schema, prompt, validation, fallback | Report with valid evidence IDs; fallback path works |
| M5 | UI: progress stream, report dashboard, charts, video page, disconnect dialog, sessionStorage restore, mobile | Full journey on desktop and mobile; refresh keeps the report |
| M6 | Hardening: credits + cooldown, privacy test, log review, privacy page, env docs, `tsc` + tests + `next build` | Definition of done in the PRD |

---

## 17. Decisions

- Name: **Channel Doctor**.
- Credit prices, plan access and AI models are controlled from the admin panel (defaults above).
- Reports are kept in `sessionStorage`.
- Impressions and CTR: built in Phase 1 with the Reporting API job created at connect time. The first analysis after connecting shows CTR as "available from <date>".

Sources for the Reporting API facts: [revision history](https://developers.google.com/youtube/reporting/revision_history), [channel reports](https://developers.google.com/youtube/reporting/v1/reports/channel_reports), [introduction](https://developers.google.com/youtube/reporting), [metrics](https://developers.google.com/youtube/reporting/v1/reports/metrics), [Fivetran on backfill](https://fivetran.com/docs/applications/youtube-analytics), [Airbyte on the 48-hour delay](https://docs.airbyte.com/integrations/sources/youtube-analytics). Re-check the official reference during M0.

## 18. Hooks for later phases (not built now)

- `data-client.ts` keeps a `publicVideos()` function slot for competitor research (API-key based).
- `Evidence.category` already allows new categories.
- The rules config can take new rule sets (content gaps, niche research) without changing the report schema.
