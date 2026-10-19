# Create & Learn — Phase 3 Implementation Plan

This plan implements [youtube-growth-3.md](youtube-growth-3.md) (Phase 3: Execute & Learn). It is based on an inspection of this repository on 19 Oct 2026, at `feature/youtube-doctor` @ `b1c805b`, which holds Phase 1 and Phase 2. It builds on [youtube-doctor-plan.md](youtube-doctor-plan.md) (Phase 1) and [discover-plan.md](discover-plan.md) (Phase 2).

Phase 3 connects the existing video engine to Phase 1 and Phase 2:

**Diagnose → Discover → Brief → Script → Voice → Scenes → Render → Package → Publish → Measure → Learn → Discover again**

---

## Scope decision (19 Oct 2026)

The video engine connection is **out of scope for now**. Phase 3 covers the intelligence loop around a video, not its production:

- **In scope:** Opportunity → Brief → Script → Packaging → link the published video → Measure → Learn → feed back into Discover, plus the project library and dashboard.
- **Out of scope (not built now):**
  - storyboard and engine connection: voice/timing (§5), scene planner (§6), review and render (§7);
  - YouTube upload (§10.2);
  - renderer text cards (§13).

  The sections below are kept as the design for later and are marked *deferred*.
- **Hand-off instead of integration:** the approved script and packaging can be copied or downloaded as text. The user makes the video with any tool, including the existing engine by pasting the script into a new project by hand. The user then marks the project as "in production" and links the published video.

---

## 0. What the inspection found (and why it shapes this plan)

### 0.1 Phase 1 and 2 are not on `main` yet

PR #18 merged `feature/discover` into `feature/youtube-doctor`, not into `main`. Phase 3 must branch from `feature/youtube-doctor`, or `feature/youtube-doctor` should be merged into `main` first. The second option is recommended.

### 0.2 The video engine is browser-based, not Remotion

The PRD assumes Remotion. This repository has none. The real engine works like this:

| Part | Where | What it does |
|---|---|---|
| Project model | `src/types/index.d.ts` → `ProjectManifest`, `SceneItem`, `AudioChunk` | `scenes[]` with `audioStartSec`/`audioEndSec`, `narrationLine`, `visualPrompt`, `cameraMotion`, `imagePath`/`imageUrl`, `status` |
| Persistence | `src/lib/store.ts` + `src/lib/media-storage.ts` | **Browser only**: manifests in IndexedDB (mirrored to localStorage), audio and image blobs in IndexedDB. There is no project table on the server. |
| Script → scenes | `src/lib/scene-ai.ts` (`breakdownRequirementToImageScenes`, `generatePromptsForTimedSegments`, `generateStoryWorldBible`) | AI director: world bible, scene beats, visual prompts, shot types |
| Voice | `/api/voice/plan` + `/api/voice/chunk` (`voice-server.ts`, `voice-chunker.ts`) | DeepInfra TTS, credits charged up front, resumable chunk by chunk, provider and model resolved per request |
| Audio → timing | `/api/transcribe-audio` + `audio-transcriber.ts` | Whisper word timings become spoken segments, which become timed scenes (the "custom voiceover" path in `/project/new`) |
| Images | `/api/generate-image` + `image-queue.ts` | Throttled AI images with credits; the storyboard also accepts user uploads (`handleUpload`) |
| Storyboard | `/storyboard?id=…` | Per-scene editing, regenerate, upload, timing sync, duration edits |
| Render | `src/lib/export-engine.ts` (`/export`) | **In the browser**: canvas Ken Burns plus transitions (crossfade / fade / slide / cut), WebCodecs H.264 + `mp4-muxer`, with a MediaRecorder fallback. Real frame-based progress, cancel supported. The MP4 is **downloaded**, not stored. |
| Packaging | YouTube Launch Kit (`/api/generate-packaging`, `components/export/launch-kit/*`, Canva integration) | Titles, description, tags, thumbnail concepts and images, Canva editing |

**Consequences:**

1. **Structured data is the only interface to the renderer.** The PRD's safety rule ("no AI-written render code") already holds. The scene planner outputs `SceneItem` JSON and nothing else.
2. **Scene types are limited to what the renderer draws: a still image with Ken Burns motion plus a transition.**
   - `visualType` (HERO_AI / STOCK_BROLL / MOTION_GRAPHIC) is only a label.
   - Text, lower thirds, charts and video clips are *not* rendered.
   - Phase 3 v1 plans image scenes only. A small deterministic text-card layer is an optional extension (§13).
3. **Media and rendered videos never reach our servers.** The server can't verify "rendered" and can't upload the MP4 to YouTube itself. See §10.
4. **A project lives on one browser.** Server records (below) carry the workflow, brief, script and learning across devices. Media and audio stay on the device that made them.

### 0.3 The existing Launch Kit and the PRD

`TitleOption.ctrScore`, `ScriptIntelligence.viralAngles` and `hookRetentionScore` exist as types only: they are not generated or shown. The Launch Kit's prompt and copy use "viral" wording. Phase 3 packaging has its own schema (§9), with no scores and no "viral" language (PRD §21, §51). The standalone Kit is left unchanged.

### 0.4 Timing reality for "6 hours / 24 hours" checkpoints

- YouTube Analytics data is **daily**, with roughly 2–3 days of lag.
- The Data API's view count is live but lifetime-only. Polling it would mean storing statistic snapshots.

Checkpoints are therefore **1, 2, 7 and 28 days**, measured from Analytics day rows once available. The 6-hour checkpoint is dropped, and the UI explains why. The checkpoints are admin-configurable.

---

## 1. Decisions at a glance

| Topic | Decision |
|---|---|
| Server state | New `video_projects` table: workflow status, brief, script, scene-plan summary, packaging choice and opportunity *thesis*. It is linked to the browser project by `local_project_id`. Media stays in IndexedDB. |
| State machine | Explicit statuses with a transition table in code (`project-state.ts`) plus a DB check constraint. Every step has `last_error` for retry. |
| AI tasks | Separate modules, each with a zod schema, sanitizer, retry and fallback: `BriefInterpreter`, `ScriptGenerator`, `ScenePlanner`, `PackagingGenerator`, `PerformanceInterpreter`, `LearningInterpreter`. All use `callLLM` with the admin model list. |
| Voice / timing *(deferred)* | TTS **per script section** through the existing `/api/voice/plan` + `/api/voice/chunk`. Real audio durations set section timing. Scenes inside a section are timed from Whisper segments (existing transcriber), or by word share if transcription fails. Regenerating one section re-times only that section. |
| Scenes → engine *(deferred)* | ScenePlan → `ProjectManifest.scenes` (deterministic converter) → existing storyboard (images, user uploads) → existing export. No new renderer. |
| Assets *(deferred)* | `AssetRequirement` per scene (intent ≠ asset). Sources today: AI image, user upload, placeholder. Stock and other providers plug in later behind an interface. Nothing expensive runs without a click. |
| Packaging | Brief-aware packaging step built on Launch Kit pieces. New title concept schema (title, mechanism, audience, risk, rationale). No scores. |
| Publishing | **Find and confirm.** The user uploads on YouTube themselves. The app finds the video among the connected channel's recent uploads, suggests the best match, and the user confirms with one click. No upload from our app, so no new Google scope. |
| Production hand-off | The approved script and packaging can be copied or downloaded as text. The project is marked "in production" by the user. No storyboard or render integration for now. |
| Measurement | On-demand Analytics per video, compared with the channel's own videos *at the same age*, plus reach/CTR where available. Only derived outcome labels are stored. |
| Learning | `learning_records` per measured video. Aggregated with minimum samples and shrinkage. Fed back into Phase 2 as a new "your track record" score signal with evidence. |
| Credits | Script, scene plan, packaging and performance analysis prices are set in **Admin → Channel Doctor → Create**. TTS and images keep their existing per-use credits. |
| Navigation | Dashboard · Channel Doctor · Discover · **Projects** (library with statuses) · **Learn**. Equivalent pages are reused. |

---

## 2. Data model (migration `2026xxxx_create.sql`)

### 2.1 `video_projects`: the workflow record (user-owned content)

```sql
create table public.video_projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  local_project_id  text,                 -- reserved for a later engine link; unused now
  origin            text not null check (origin in ('opportunity','manual')),
  status            text not null default 'DRAFT' check (status in (
                      'DRAFT','BRIEF_READY','SCRIPT_READY','PACKAGED','IN_PRODUCTION',
                      'PUBLISHED','ANALYZING','LEARNED','ARCHIVED')),
  last_error        jsonb,                -- { step, code, message, at } for retry UI
  title             text not null check (char_length(title) <= 200),
  thesis            jsonb,                -- opportunity snapshot WITHOUT competitor data (§3.2)
  brief             jsonb,                -- VideoBrief v1 (user-editable)
  script            jsonb,                -- Script v1 (sections, claims)
  packaging         jsonb,                -- selected title/thumbnail concept + metadata draft
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- RLS: owner-only for all operations; index on (user_id, updated_at desc)
```

### 2.2 `published_videos`: the project ↔ YouTube link

```sql
create table public.published_videos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  project_id        uuid not null references public.video_projects(id) on delete cascade,
  youtube_video_id  text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  channel_id        text not null,
  published_at      timestamptz not null,     -- from YouTube, used for age-matched baselines
  link_method       text not null check (link_method in ('manual','upload')),
  status            text not null default 'tracking' check (status in ('tracking','complete','unavailable')),
  created_at        timestamptz not null default now(),
  unique (user_id, youtube_video_id)
);
```

There are no view counts and no analytics in this table. It only records the relationship (PRD §26).

### 2.3 `learning_records`: derived outcome metadata

```sql
create table public.learning_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  published_video_id uuid not null references public.published_videos(id) on delete cascade,
  checkpoint_days    int  not null,             -- 7 or 28
  -- what was decided
  topic_label        text, content_format text, title_mechanism text, thumbnail_mechanism text,
  gap_types          text[], opportunity_confidence text,
  -- what happened (derived labels, not raw analytics)
  views_vs_baseline  text check (views_vs_baseline in ('well_above','above','typical','below','well_below','unknown')),
  ctr_vs_baseline    text, retention_vs_baseline text,
  bottleneck         text check (bottleneck in ('none','discovery','packaging','retention','content_market_mismatch','execution','insufficient_data')),
  thesis_verdict     text check (thesis_verdict in ('supported','partly_supported','not_supported','inconclusive')),
  baseline_sample    int, confidence text,
  created_at         timestamptz not null default now(),
  unique (published_video_id, checkpoint_days)
);
```

**Policy note:** these are derived metrics. Phase 2's audit application ("Analytics & Reporting") must also cover them. Only bucketed labels and sample sizes are stored: no view counts, CTR values or retention curves. Raw numbers are always fetched fresh.

### 2.4 Settings: new columns on `channel_doctor_settings` (admin → "Create")

| Column | Default | Meaning |
|---|---|---|
| `create_enabled` | `false` | Admins can still use it, as with Discover. |
| `create_allowed_plans` | `{CREATOR,STUDIO}` | Plans that can use Create. |
| `brief_credit_cost` | 2 | Credits to build a brief. |
| `script_credit_cost` | 5 | Per full script; regenerating one section costs half, rounded up. |
| `packaging_credit_cost` | 5 | Credits per packaging run. |
| `performance_credit_cost` | 2 | Per analysis. 0 is allowed. |
| `checkpoint_days` | `{1,2,7,28}` | Measurement checkpoints. |
| `learning_min_videos` | 3 | Measured videos needed before a pattern is shown. |
| `track_record_weight` | 10 | New Phase 2 score weight. The other weights are rescaled so the total stays 100. |

---

## 3. Opportunity → Video Brief

### 3.1 VideoBrief v1 (zod)

```ts
{ version: 1, origin: 'opportunity'|'manual', opportunityId?: string,
  topic, audience, problem|null, intent: 'inform'|'compare'|'teach'|'entertain'|'persuade',
  corePromise, recommendedAngle, recommendedFormat: ContentFormat,
  keyPoints: string[],                 // 3–7, user-editable
  keyQuestions: string[],              // what the viewer wants answered
  supportingEvidence: { statement, kind: 'channel'|'market'|'diagnosis' }[],   // qualitative
  contentGap: GapType[], recommendedStructure: StructureBeat[],               // from format template
  titleDirections: { mechanism, direction }[], thumbnailDirection: string,
  productionDifficulty, confidence, language: 'English'|'Bangla', createdAt }
```

### 3.2 Building it

1. **Deterministic first.** The following fields copy straight from the Phase 2 `Opportunity`, so they stay traceable: topic, angle, format, gaps, difficulty and confidence. `supportingEvidence` is rebuilt as **qualitative** statements, for example "Several competitor videos on this topic beat their channel's usual". Competitor titles, view counts and ratios are left out, because they are Non-Authorized data under the 30-day rule. The thesis snapshot (§2.1) stores scores, levels and labels only.
2. **BriefInterpreter (AI) fills the gaps.** It writes `corePromise`, `keyPoints`, `keyQuestions`, `titleDirections` and `thumbnailDirection`, plus `audience` and `problem` when missing. Validation: zod, banned-hype list, number check against the opportunity evidence, and the originality guard against the topic's competitor titles (reuse `ai/originality.ts`).
3. **Structure templates per format are deterministic** (`formats/structures.ts`). Examples:
   - comparison: Hook → What we compare and how → Round 1…n → Verdict → Who should pick which
   - explainer: Hook → Question → Context → 3 beats → Payoff → CTA
   - list: Hook → Items (n) → Best/surprise → CTA

   The user can add, remove or reorder beats.
4. **Manual projects** start with an empty brief form. "Help me fill this" runs the same BriefInterpreter on the user's topic.
5. **Entry points:** Discover opportunity → "Create video brief"; Projects → New → From opportunity / Start from scratch; Dashboard → recommended opportunity.

### 3.3 UI (`/create/[projectId]/brief`)

- Same visual language as Discover: big readable text, answer first.
- Every field is editable inline. "Why this opportunity" shows the qualitative evidence and confidence.
- **Generate script** shows its cost.
- Saved to `video_projects.brief`; the status moves to BRIEF_READY.

---

## 4. Script

### 4.1 Script v1 (zod)

```ts
{ version: 1, language, targetDurationSec,
  sections: [{ id, beat: StructureBeat, heading, narration,          // spoken text only
               claims: [{ text, kind: 'evidence'|'needs_research'|'creative', evidenceRef? }],
               estSec }],                                              // words ÷ speaking rate (deterministic)
  researchChecklist: string[] }                                        // all needs_research claims, for the user
```

### 4.2 ScriptGenerator

- **Input:**
  - the brief, after user edits;
  - Phase 1 insights: primary bottleneck, retention moments summary (for example "viewers leave at 0:20 on your videos"), and best-holding format;
  - Phase 2 qualitative evidence;
  - target length, from the brief format and the channel's median duration.
- **Prompt rules:**
  - narration only, no stage directions;
  - no fake excitement;
  - evidence claims only from the given facts; anything factual beyond them must be marked `needs_research`, not invented (PRD §8);
  - follow the section beats;
  - if Phase 1 says retention, the hook must deliver the promise in the first 15 seconds.
- **Validation:**
  - zod schema;
  - each section is non-empty and under its word cap;
  - a repetition check (deterministic n-gram overlap between sections);
  - banned phrases ("in today's video", "smash that like button" and similar), which go into a configurable list;
  - number check: `evidence` claims may only use numbers from the brief evidence.
- **Retry and fallback:** one retry with the validation errors. After that, the failing sections are returned empty with "write this section" so the user is never blocked.
- **Regenerate one section,** keeping the others as context. This costs half the script price.

### 4.3 UI (`/create/[projectId]/script`)

- Section list with editable narration.
- Claim chips (Evidence / Needs research / Creative) and a research checklist panel.
- Word count and estimated duration per section and in total.
- Status SCRIPT_READY when the user approves.

---

## 5. Voice and timing *(deferred)*

Everything here reuses the existing voice system.

1. The user picks a voice. This reuses Voice Studio presets and models (`/api/voice/voices`, `/api/voice/models`).
2. **Per-section TTS:** for each section, `/api/voice/plan` (credits, unchanged) then `/api/voice/chunk`. The audio blobs go to IndexedDB as `audio_{localProjectId}_{sectionIndex}`, and each one becomes an `AudioChunk` in the manifest.
3. **Real durations:** each section's `durationMs` comes from the decoded audio, never from an estimate.
4. **Scene timing inside a section:**
   - Whisper transcription of that section's audio (`/api/transcribe-audio`) gives segments, which split the narration at the planned scene boundaries.
   - If transcription fails, time is split by word share within the section, and a limitation note is shown.
5. **Regenerate the voice for one section:** only that section's chunk and the scenes inside it are re-timed. Later sections shift by the duration difference (deterministic `retime.ts`).
6. Status VOICE_READY.

---

## 6. Scene planner → existing engine *(deferred)*

### 6.1 ScenePlan v1

```ts
{ version: 1, scenes: [{ id, sectionId, narration, startSec, endSec,        // from §5 timing
    visualIntent,                       // "Show dirt being pulled out of a car seat"
    asset: { type: 'image', description, keywords: string[], preferredSource: 'ai_image'|'upload'|'placeholder',
             aspectRatio, usage: 'full_frame', status: 'needed'|'ready'|'skipped' },
    motion: CameraMotionEffect, transition: TransitionType, shotType, importance: 'key'|'normal' }] }
```

**Supported scene types are what the renderer can draw:** an image scene with Ken Burns motion and a transition. The planner's enum contains only these. Text cards are an optional extension (§13).

### 6.2 ScenePlanner (AI) + deterministic timing

- **Deterministic first:**
  - Scene count per section = section duration ÷ the pacing target (existing `PacingProfile`), clamped to 3–8 s per scene.
  - Key beats (hook, verdict) get longer holds.
  - Boundaries snap to Whisper segment ends.
- **AI fills, for each pre-cut scene:**
  - `visualIntent`;
  - the asset description and keywords;
  - `shotType` and motion.

  It **reuses** `generateStoryWorldBible` and `generatePromptsForTimedSegments` from `scene-ai.ts` for visual consistency instead of a second prompt system.
- **Validation:**
  - scene IDs match the pre-cut list;
  - the enums are valid;
  - timing is never taken from the model.

### 6.3 Conversion to the engine (`to-manifest.ts`, pure and tested)

- ScenePlan → `SceneItem[]`:
  - `sceneId`;
  - `audioStartSec` / `audioEndSec`;
  - `narrationLine`;
  - `visualPrompt` = asset description;
  - `fullPrompt` = description + style prompt (existing `assembleFinalImagePrompt`);
  - `cameraMotion`, `shotType`;
  - `status: 'PENDING'`.
- The ProjectManifest gets `audioChunks` from §5, plus `pacingProfile`, `aspectRatio`, `baseStylePresetId`, and the project link `phase3: { serverProjectId }`.
- A **timeline validator** runs before handing over:
  - scenes are contiguous and cover the audio with no gaps or overlaps;
  - each duration is at least the transition length;
  - IDs are unique;
  - aspect ratio is supported.
- Saved through the existing `saveProject()`. The user lands in the **existing storyboard** (`/storyboard?id=…`) to generate or upload images per scene. Nothing generates automatically: the storyboard opens without the `autoGenerate` flag, and the user clicks "Generate all" or picks per scene.

### 6.4 Asset control

- The storyboard scene card gets an "Asset needed" strip showing the visual intent and requirement, with **Generate image** (existing), **Upload** (existing), **Use placeholder** and **Skip**.
- A provider interface `AssetSource { id, search?(req), fetch?(id) }` is in place, so stock APIs can be added later without touching the planner.

---

## 7. Production review and render *(deferred)*

- A **Review** panel in the storyboard for Phase 3 projects shows:
  - script and section audio, with play and regenerate;
  - scene list with requirements and asset status;
  - timeline bar;
  - estimated length;
  - missing assets (render is blocked until every scene has an image or placeholder).
- The user can reorder scenes **within a section only**, since moving across sections would break narration sync. Re-plan section and regenerate narration are explicit buttons, each showing its cost.
- **Render** uses the existing `/export` and `ExportEngine`:
  - preview means a lower resolution (720p) render;
  - final means the chosen resolution;
  - progress comes from real frame counts (already true);
  - cancel is already supported;
  - on failure, retry the render only.
- On completion the client reports RENDERED with duration and resolution. This is a self-report, since the file stays on the user's device. The server only allows the transition IN_PRODUCTION → RENDERED.

---

## 8. State machine (`project-state.ts`)

```
DRAFT → BRIEF_READY → SCRIPT_READY → PACKAGED → IN_PRODUCTION → PUBLISHED → ANALYZING → LEARNED
```

- **IN_PRODUCTION** is set by the user ("I'm making this video") after copying the script and packaging. Linking a published video is allowed from PACKAGED or IN_PRODUCTION.
- **Backward edits are allowed and explicit.** For example, editing the brief after SCRIPT_READY returns the project to BRIEF_READY and marks the script as out of date. The UI warns before such moves.
- Any state can go to ARCHIVED, and the reverse is allowed.
- **Server-enforced:**
  - every API that advances the status checks the transition table (unit-tested, invalid moves → 409);
  - errors are written to `last_error`, the status does not move, and the UI offers "Retry {step}".

---

## 9. Packaging Studio

- **Input:** brief + final script + Phase 2 mechanism stats for the topic (aggregated shares only) + the channel's own winning title mechanisms (Phase 1 outperformers' titles, run through `titleMechanisms()`).
- **PackagingGenerator** produces 4–6 **title concepts** `{ title, mechanism (from MECHANISMS), audience, risk, rationale }`:
  - zod-validated;
  - originality guard against competitor titles;
  - banned-hype check;
  - titles over 100 characters are rejected (YouTube's limit).
- **Thumbnail concepts** `{ mainSubject, supportingObject, composition, emotionOrAction, background, text, contrast, hierarchy }`, as a visual brief the user can execute. Image generation and Canva are not part of this flow for now.
- **Compare view:** concepts A/B/C side by side. The user selects one, and the selection is stored in `video_projects.packaging`.
- **Metadata draft:** description (chapters are added only after the video exists, since there are no timings yet) and tags.
- The Launch Kit's `ctrScore`, `viralAngles` and `hookRetentionScore` are not shown in this flow. Recommendation: remove them from the standalone Kit too.
- Status: PACKAGED after the user selects a concept and reviews the metadata.
- **Hand-off:** "Copy script" and "Download as .txt" (script + selected title, description, tags, thumbnail brief).

---

## 10. Publish

### 10.1 Link the published video (no new Google scope, no URL pasting)

The channel is already connected, so the app finds the video itself. **The app suggests and the creator confirms.** It never links on its own, because titles change at the last minute and two videos can go out on the same day.

1. A **Publish checklist** shows the selected title, description, tags and thumbnail brief, with a "copy all" action.
2. **"Mark as published"** fetches the channel's recent uploads (uploads playlist + `videos.list`; about 2 units, no search quota). Private, unlisted and scheduled videos are included, since the owner is authorized. Then:
   - videos already linked to another project are excluded;
   - the rest are ranked by similarity to the selected title (word overlap + embedding) and by publish time after the project was packaged;
   - the best match is shown as **"Is this your video?"** with thumbnail, title, date and privacy status.
3. One click, **"Yes, this one"**, links it. Otherwise the creator picks from the list. A small "Older video? Paste its link" fallback covers videos outside the recent list.
4. **Reminder:** while a project is IN_PRODUCTION, opening the Create library checks recent uploads once (cheap, throttled to at most once an hour per user). A likely match shows a banner: "New video 'X' found: is it for project 'Y'?". The creator still confirms.
5. **The server re-verifies on link:**
   - the video's `channelId` must equal the connected channel;
   - the video must not already be linked;
   - `publishedAt` and the privacy status are read from YouTube.

   A `published_videos` row is created and the status becomes PUBLISHED. Measurement starts once the video is public. Scheduled or private videos show "Tracking starts when it goes public". The creator can undo a link.

### 10.2 Direct upload *(deferred: not planned for now)*

- **Needs:**
  - the `https://www.googleapis.com/auth/youtube.upload` scope, which is sensitive and requires **updated Google verification** (scope justification and demo video);
  - incremental auth, so existing users re-consent;
  - our server creating the resumable session (it holds the token), while the browser streams the file (it holds the MP4).
- **The spike must confirm** that the browser can PUT to the YouTube resumable session URI without receiving our access token, and that CORS allows it. If not, uploading via Supabase Storage + a server relay is the fallback, at bandwidth cost.
- `thumbnails.set` runs server-side after upload. Privacy status, schedule (`status.publishAt`) and playlist are supported.
- **Never auto-publish.** The final confirm screen repeats title, privacy and schedule. Default privacy is *private*.

---

## 11. Measure: performance and thesis test

### 11.1 Data (fetched on demand, nothing raw stored)

- **This video:** Analytics `dimensions=day`, `filters=video==ID`, from `publishedAt` to today.
  - Cumulative views, watch time, average view duration, average % viewed and subscribers gained at each checkpoint age (1/2/7/28 days, once available).
  - Traffic sources, if available.
  - Impressions and CTR from the reach report (Phase 1 `reporting-client`), if available.
- **Baseline:** the channel's own videos of the **same format** (Analytics `creatorContentType`), published within the last 12 months and older than the checkpoint.
  - The same day query is run for each of up to 20 videos, through `mapLimit`.
  - The median cumulative views at the same age is computed, with MAD for robustness.
  - Fewer than 5 comparable videos → "insufficient baseline".
- Every metric is a `Result` (available, or a reason), as in Phase 1. Missing metrics are stated, never guessed.

### 11.2 Outcome classification (`outcome.ts`, deterministic, reuses Phase 1 `RULES`)

- **Views vs baseline:** ≥ 2× well above; 1.25–2× above; 0.8–1.25× typical; 0.5–0.8× below; < 0.5× well below.
- **Bottleneck:**
  - **discovery:** impressions below 0.5× the baseline impressions;
  - **packaging:** impressions normal, CTR ≤ 0.7× median (Phase 1 packaging rule);
  - **retention:** CTR normal, average % viewed ≤ 0.8× median, or an early exit (Phase 1 retention rules);
  - **content-market mismatch:** views below and every other signal typical, when the opportunity's fit was high;
  - **execution:** discovery and CTR fine, retention and views below;
  - **insufficient_data:** too young, missing metrics or a small baseline.
- **Thesis test:** compare the stored thesis (fit, competition, momentum, gap, confidence) with the outcome. For example: high-confidence opportunity + views above + CTR above + retention below → "Topic and packaging validated; retention is the weakness". The verdict is one of supported / partly / not / inconclusive.
- **PerformanceInterpreter (AI)** writes the plain-language explanation from these labels only. Number check, no new claims.

### 11.3 UI (`/create/[projectId]/performance`)

- Checkpoint timeline. The current checkpoint shows "This video vs your usual at the same age", with the sample size.
- Bottleneck card, thesis card ("What we expected → what happened") and next steps that link into Channel Doctor's video check-up.
- Status ANALYZING. At the 28-day checkpoint (or when the user closes it), LEARNED and a `learning_records` row are written.

---

## 12. Learn: feedback into Discover

- **Aggregation (`learning.ts`, deterministic):**
  - grouped by content format, topic label (via embeddings, nearest Phase 2 topic) and title mechanism;
  - for each group: n, the share of videos above the baseline, and a shrunk effect = (above − below) / (n + k), with k = 3;
  - a group is shown only when n ≥ `learning_min_videos`, and phrased as "tends to", never as a rule.
- **Learn dashboard (`/learn`):**
  - "What's working" and "What isn't" lists, each with n and its evidence (links to the videos);
  - "Not enough videos yet" state.
  - The LearningInterpreter writes headlines from the aggregates only.
- **Feedback into Phase 2:**
  - New score dimension `trackRecord`, with weight from admin settings (default 10).
  - Its value comes from the shrunk effect for the opportunity's format and nearest topic. If no group qualifies, it is a *missing signal* and the weights renormalize, as in the existing engine.
  - New evidence line, for example: "Your 4 past comparison videos did better than your usual in 3 cases".
  - Confidence only rises when n ≥ 5.

---

## 13. Optional extension: text cards in the renderer *(deferred)*

If wanted, add one deterministic layer to `export-engine.ts`: lower third, title card and statistic card, drawn with canvas `fillText` from structured fields (text, position, style preset). The same component draws the storyboard preview. Until this exists, the planner never emits text scenes. Effort: medium.

---

## 14. Routes

| Route | Purpose |
|---|---|
| `POST /api/create/projects` | Create from an opportunity (body: the opportunity object from session storage; validated, competitor data stripped) or manually |
| `GET /api/create/projects`, `GET/PATCH/DELETE /api/create/projects/[id]` | Library listing, read, edit (brief/script/plan/packaging) with transition checks |
| `POST /api/create/projects/[id]/brief` (stream) | BriefInterpreter |
| `POST /api/create/projects/[id]/script` (stream, `?section=`) | ScriptGenerator, full or one section |
| `POST /api/create/projects/[id]/packaging` | PackagingGenerator |
| `POST /api/create/projects/[id]/status` | User-set transitions (IN_PRODUCTION, ARCHIVED), validated |
| `GET /api/create/projects/[id]/publish-candidates` | Recent uploads from the connected channel, ranked as likely matches (excludes linked videos) |
| `POST /api/create/projects/[id]/publish` | Link the confirmed video (ownership re-checked; pasted link accepted as fallback) |
| `POST /api/create/projects/[id]/performance` (stream) | Measure + classify + interpret |
| `GET /api/create/learning` | Aggregates for /learn and for Discover scoring |
| `/api/admin/channel-doctor` | Extended with Create settings |

All routes:
- use `requireUser` plus an ownership check: the row's `user_id` must equal the session user, and RLS also enforces this;
- validate input with zod;
- reuse `streamAnalysis` for credit charging and refunds;
- write structured logs only (project_id, operation, status, duration, error_code).

Pages:
- `/create/new`: from opportunity / from scratch;
- `/create/[id]`: stepper with Brief · Script · Package · Publish · Performance;
- **Create library** (`/create`): server records with status chips. The existing `/projects` page (engine projects) stays unchanged for now;
- `/learn`;
- dashboard cards.

---

## 15. Privacy, security and cost

- **Stored:**
  - projects, brief, script, scene plan and packaging (user content);
  - published-video links;
  - derived learning labels.
- **Not stored:**
  - raw analytics;
  - competitor titles and statistics (stripped before the brief);
  - prompts and AI responses;
  - any video or media file (none passes through Create).
- **Disconnecting YouTube** stops tracking (sets status to `unavailable`) but keeps the user's projects. Deleting a project cascades to its links and learning rows.
- **Logs:** no tokens, scripts, prompts or titles.
- **Cross-user tests** on every route and RLS policy.
- **Costs:**
  - every AI step and every TTS or image call is an explicit click showing its credit price;
  - there are no automatic regenerations;
  - section-level regeneration keeps the cost low.

---

## 16. Milestones

| # | Scope | Done when |
|---|---|---|
| **C1** Foundation | Migration (3 tables + settings), `project-state.ts`, ownership helpers, admin "Create" section, projects API | Transition and RLS tests pass |
| **C2** Brief | Opportunity → brief (deterministic + BriefInterpreter), structure templates, manual brief, brief UI; Discover's "Create video brief" points here | Real opportunity → editable brief |
| **C3** Script | ScriptGenerator, claim tagging, validation, section regenerate, script UI, copy/download | Real brief → structured script in English and Bangla |
| **C4** Packaging | Title and thumbnail concepts, compare and select, metadata draft, hand-off export | Selected packaging saved |
| **C5** Publish link | Checklist, match suggestions from recent uploads, one-click confirm, reminder banner, link fallback | Real video found and linked without pasting a URL |
| **C6** Measure | Per-video analytics, age-matched baseline, outcome classification, thesis test, performance UI | A real published video measured, with honest "insufficient data" before day 7 |
| **C7** Learn | learning_records, aggregation with shrinkage, /learn, trackRecord in Discover scoring | Track-record evidence appears after ≥3 measured videos (tests use synthetic fixtures) |
| **C8** Library & nav | /create library, sidebar entries (Create, Learn); existing dashboard left unchanged | — |
| **C9** Hardening | Privacy page, tests, build | Checklist complete |

**Deferred (not planned now):** voice/timing, scene planner, storyboard and render integration, YouTube upload, renderer text cards (§5–7, §10.2, §13).

---

## 17. Risks

| Risk | Mitigation |
|---|---|
| Analytics lag and daily granularity | Day checkpoints from day 1; honest "available on {date}" states |
| Small samples → false lessons | Minimum n, shrinkage, "tends to" wording, confidence gates |
| Derived metrics policy | Same audit application as Phase 2; store labels, not statistics |
| Script facts | Claim tagging, research checklist, number checks; never invented facts |
| Video made outside the app | The library tracks it by the user's own status and the linked YouTube video; nothing depends on the engine |

---

## 18. Decisions

**Confirmed (19 Oct 2026):**
- No storyboard or engine connection for now.
- No YouTube upload from the app.
- No renderer changes.

- Phase 3 is built on a new branch `feature/create`, made from `feature/youtube-doctor`. C0 (merge into `main`) is not needed.
- YouTube Kit Studio stays as it is. `ctrScore`, `viralAngles` and `hookRetentionScore` exist only as types: they are not generated or shown. "Viral" appears only in Kit marketing copy. The Phase 3 packaging flow uses neither.

- Credit prices, plan access and limits are controlled from the admin panel. The values in §2.4 are only seed defaults.
- **Existing features on `main` are not modified.** This covers YouTube Kit Studio / Launch Kit, the video engine (storyboard, export), `/projects`, Voice Studio and the dashboard view. Phase 3 adds new modules, routes and pages next to them. Existing libraries are only reused read-only (for example `callLLM`). The dashboard gets no new cards on `main` pages; the Create library and Learn page are new pages instead.

**Script (C3, 20 Oct 2026):**
- Phase 1 insights are not sent to the script writer for now. Loading them needs the YouTube token and a full Analytics fetch on every script. Instead, every hook delivers the promise in the first 15 seconds.
- Durations and the research checklist are computed from the script, not stored: estimated at 150 words a minute for English and 115 for Bangla.
- "Evidence" means the brief says it: the claim must share most of its meaningful words with the brief's key points, promise, questions or evidence. Any other factual claim becomes "Check this" automatically, as does any sentence with a number the brief doesn't contain (small counts like "3 reasons" excepted).
- Rewriting one part costs half the admin-set script price, rounded up.
- Generating a script sets SCRIPT_READY. Saving after a brief change marks the script as reviewed against the new brief.

**Packaging (C4, 20 Oct 2026):**
- The packager gets no competitor titles or Phase 1 title stats for now. Competitor titles aren't stored (30-day rule), and Phase 1 needs a full Analytics fetch. It works from the brief (including its title and thumbnail directions) and the script.
- Generating ideas never finishes the step. PACKAGED is set when the user saves with one title and one thumbnail chosen; clearing the choice returns to SCRIPT_READY. Saving while IN_PRODUCTION keeps that status.
- "New ideas" replaces only the concepts the user hasn't chosen. The AI fills an empty description and tags and never overwrites them.
- Titles drop hype, all-caps words and any number not in the brief. Counts ("5 ways") are allowed only if they match the brief or the number of key points. A title's mechanism is read from its wording, not taken from the model's claim.
- Thumbnails are visual briefs only: no image generation and no Canva in this flow.
- Hand-off: "Download package" (title, thumbnail brief, description, tags and the script) plus copy buttons.

**Publish link (C5, 20 Oct 2026):**
- Matching uses title word overlap only (chosen title first, then the other concepts and the project title), plus whether the video went out after the project started. No embeddings: word overlap already finds the video after small last-minute title edits (tested on two real channels), and it costs nothing.
- Recent uploads are read from the uploads playlist (`UU…`, derived from the channel id) and `videos.list` with `status`: 2 quota units, no search, nothing stored. A video is suggested only at a score of 0.5 or more; otherwise the creator picks from the list or pastes a link.
- The server re-checks every link: the video's channel must be the connected one, and the video must not be linked already. Private, unlisted and scheduled videos link as `waiting_public`; the status moves to `tracking` when YouTube reports the video public (checked whenever the link is shown).
- Unlinking is allowed while the project is PUBLISHED (before measuring). It returns to PACKAGED.
- Library reminder: for projects IN_PRODUCTION, the library checks recent uploads at most once an hour per browser, and at most 24 times a day per user on the server. Matches need a score of 0.6 or more. Each video and each project appears in at most one reminder, and "No" hides that pair.
