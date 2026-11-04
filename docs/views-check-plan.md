# Views Check: implementation plan

A new part of Channel Doctor that answers two questions in plain words:

1. **Why do my videos get 0 views?**
2. **Why do my Shorts stop after 1–2 hours?**

It also adds an optional **keyword check**: how hard a topic is to rank for, based on what YouTube actually shows for it.

Branch: `feat/channel-doctor-views-check` (from `fix/long-audio-transcription`, which has the latest commits).

## Ground rules

- **Nothing existing changes behaviour.** The current diagnosis (`/api/youtube/diagnosis`, `runDiagnosis`, `analyzeChannel`, its report UI) stays as it is. Views Check is a new route, new library code and new components. It may *call* existing fetch helpers but does not edit them.
- **Official data only.** Every finding comes from the YouTube Data, Analytics or Reporting API, using the scopes we already have (`youtube.readonly`, `yt-analytics.readonly`). What the API doesn't give, the report says so and sends the user to the right Studio screen. No guessed substitutes.
- **Same privacy rule as Channel Doctor.** The report is streamed to the browser and kept in sessionStorage only.
- **Admin-controlled.** Credit cost, daily runs and limits are editable in the admin panel.

## What the API can and can't tell us

| Signal | Source | Available |
|---|---|---|
| Upload failed or rejected (copyright, claim, duplicate…) | `videos.status.uploadStatus`, `rejectionReason` | Yes |
| Private / unlisted | `status.privacyStatus` | Yes |
| Blocked in some or all countries | `contentDetails.regionRestriction` | Yes |
| Age-restricted | `contentDetails.contentRating.ytRating` | Yes |
| Made for Kids | `status.madeForKids` | Yes |
| Long-video impressions and CTR | Reporting API `channel_reach_basic_a1` (already used) | Yes, 2–3 days late |
| Shorts feed traffic per video | Analytics `insightTrafficSourceType` = `SHORTS`, filtered by video | Yes |
| Retention, and retention compared with similar-length videos | Analytics `audienceWatchRatio`, `relativeRetentionPerformance` | Yes |
| Engaged views | Analytics `engagedViews` | Yes |
| Views per day after upload | Analytics `day` dimension filtered by video | Yes (daily, not hourly) |
| "Shown in feed", "Viewed vs swiped away" | — | **No**: Studio only |
| Content ID claims, strikes, Feature eligibility | — | **No** (needs partner or MCN scopes) |
| Hour-by-hour views | — | **No**: Analytics is daily |
| Keyword search volume | — | **No**: YouTube publishes none |

## The report the user sees

1. **Verdict card.** One sentence naming the main cause, for example: "Your last 6 videos are not being shown to anyone: 0 impressions after 3+ days." Then the one thing to do first.
2. **Why 0 views.** Each video with 0 or near-0 views, grouped by cause, with the evidence numbers.
3. **Why your Shorts stop.** For each recent Short: how much of its views came in the first 2 days, whether it reached the Shorts feed, and how its retention compares with similar Shorts. Plus a plain explanation of the test-audience model.
4. **Channel-wide signals.** Double-posting, hashtags in titles, upload gaps, a sudden drop across all videos, mass-produced risk, audience country vs video language.
5. **Check these in Studio.** The signals the API can't see, each with where to click and what to do. The user can tick what they found, and it updates the verdict in the browser.
6. **Fix plan.** At most 5 steps, in priority order.
7. **Keyword check** (optional, separate button). See phase 4.
8. **What this report can't see.** An honest list of limits, like the existing Limitations card.

Wording: short sentences, numbers always shown, no jargon without a one-line explanation.

## Rules (deterministic, in priority order)

The verdict is the highest-priority rule that fires.

| # | Rule | Fires when | Verdict |
|---|---|---|---|
| 1 | Blocked | Rejected or failed upload, not public, blocked in all countries, age-restricted, or Made for Kids on a non-kids channel | "Fix this first" + exact reason |
| 2 | Too new | Uploaded under 3 days ago | Left out of the analysis; shown as "too early to judge" |
| 3 | Not shown (long) | ≥ 3 days old, 0 impressions | Not being distributed |
| 4 | Not in feed (Short) | Has views but 0 from the Shorts feed source | Not reaching the Shorts feed |
| 5 | Channel-wide stop | Rules 3/4 fire on most of the last N uploads | Channel-level: check Studio items and originality |
| 6 | Seen, not clicked | Impressions > 0, CTR under 2% | Title/thumbnail problem |
| 7 | Clicked, then left | Big drop in the first 30 s (long) or weak early retention (Short), or `relativeRetentionPerformance` below similar videos | Opening problem |
| 8 | Quick stop (Short) | Most lifetime views in the first 2 days, and retention vs similar Shorts below average | Lost the test against competing Shorts |
| 9 | Not enough data | Under ~10 uploads, or analytics missing | Keep posting; what to watch |
| 10 | Healthy | None of the above | Strengths + next experiment |

Channel-wide signals (shown alongside, not as the verdict unless strong):

- **Double-posting:** the same topic uploaded as a Short and a long video (reuse `titleSimilarity` from `create/topic-landscape.ts`).
- **Hashtags in titles.**
- **No long video over 4 minutes** while long videos get ~0 views.
- **Upload gaps** ≥ 30 days, and very high volume (many near-identical uploads per day) as a mass-produced risk. Label it a risk, never a detection.
- **Sudden drop:** median views of the last 5 uploads vs the 5 before.
- **Audience mismatch:** top viewer countries vs the videos' language.
- **Views to subscribers and comments:** e.g. 1 subscriber per 4,000 views.

Each threshold lives in one config object (like `RULES` in `analysis/rules-config.ts`) so it can be tuned without code changes elsewhere.

## Phases

### Phase 0: setup (½ day)
- Branch created.
- Add `docs/views-check-plan.md` (this file).
- Confirm the current test suite and build pass, as the baseline.

### Phase 1: data layer (1–1½ days)
New folder `src/lib/youtube/views-check/`:
- `fetch.ts`
  - `fetchVideoStatus(ids)`: `videos.list` with `part=status,contentDetails` (about 1 unit per 50 videos).
  - Per-video daily views for the last N Shorts (Analytics `day` + `video==id`).
  - Per-video traffic source (reuse `fetchTraffic` from `analytics-client.ts`, which already accepts a video filter).
  - `engagedViews` per video.
  - Reuse `fetchMyChannels`, `fetchUploadIds`, `fetchVideoDetails`, `fetchReach`, `fetchRetention` as they are.
- Every call is wrapped with the existing `settle()`, so one missing source becomes a limitation, not a failure.
- Caps from admin settings: max videos, max Shorts with daily curves, max per-video traffic calls.

### Phase 2: rules engine (1½–2 days)
- `rules-config.ts`: all thresholds.
- `engine.ts`: `analyzeViews(dataset) → ViewsCheckReport` (verdict, per-video causes, channel signals, Studio checklist, fix plan, limitations). Pure functions, no I/O.
- `engine.test.ts`: one fixture per rule, plus priority-order tests and the "too new" exclusion. Use the existing Channel Doctor test style.

### Phase 3: route, wording and UI (2 days)
- `src/app/api/youtube/views-check/route.ts`: `requireUser` + `streamAnalysis` (credits charged up front, refunded on failure, daily limit, quota meter label `youtube/views-check`).
- `ai/views-report.ts`: AI rewrites the deterministic findings into plain sentences. It may not add causes or numbers. A deterministic fallback text is used if the AI fails.
- UI:
  - A tab switcher on the Channel Doctor page: **Diagnosis** (default, unchanged) | **Views check** | **Keywords**.
  - New components under `src/components/youtube-doctor/views-check/`: verdict, "why 0 views", "why Shorts stop", channel signals, Studio checklist, fix plan.
  - sessionStorage key per user and channel, like the existing report.
- Admin: new fields in the Channel Doctor admin page (enabled, credit cost, runs per user per day, max videos, max Shorts analysed).
- Migration: add the new columns to `channel_doctor_settings`. The settings loader uses `?? default` so the app works before the migration is applied.

### Phase 4: keyword check (1½–2 days)
- User enters up to 5 keywords, or picks ones suggested from their best videos' titles.
- For each keyword, 1 `search.list` call (shared `SEARCH_BUCKET` and a per-user daily limit), then `videos.list` and `channels.list` for the results. Reuse `buildLandscape` from `create/topic-landscape.ts`.
- Output per keyword:
  - **Competition:** how many top results come from small channels, their views per day, how old they are.
  - **Opportunity note:** "small channels are ranking here" vs "only big channels rank".
  - **Title advice:** search phrase first, brand second.
- No "search volume" number. The UI says plainly that YouTube doesn't publish one. (Google Ads Keyword Planner is a possible later add-on, labelled as *Google* searches, needing a Google Ads developer token.)
- Admin: on/off, credit cost, keywords per run, runs per user per day.

### Phase 5: testing and release (1 day)
- Unit tests for all rules and the keyword summary.
- Regression:
  - The full existing test suite passes.
  - `next build` passes.
  - The existing diagnosis on a real channel still returns the same sections.
- Manual test on 2 real channels: one healthy, one with 0-view uploads.
- Check quota use on the admin usage card.
- Update the Google API screencast plan: Views Check uses the same scopes and APIs, and the keyword check uses `search`.

**Estimate:** about 8–9 working days.

## Quota per run (approximate)

| Part | Cost |
|---|---|
| Video status | ~1 Data API unit per 50 videos |
| Channel and upload list | ~2–3 units (same as now) |
| Analytics (daily, traffic, retention, engaged views) | Analytics API quota, not the 10k Data units |
| Keyword check | 1 search call per keyword + ~2 units |

## Risks

- **Data lag:** Analytics and Reporting are 2–3 days behind, so videos under 3 days old can't be judged. The report says so.
- **Daily, not hourly:** "stops after 1–2 hours" is explained by day-1/day-2 share and retention vs similar Shorts, not shown hour by hour.
- **Reach report not ready yet:** for newly connected channels the Reporting job needs time. Fall back to limitations, as the current diagnosis does.
- **Search budget:** the keyword check competes with Discover and Create for ~80–90 search calls a day. Keep it optional and limited.
