# Viral Engine: implementation plan

The user picks a Short (a video file from their computer). We analyse it frame by frame and second by second and show a timeline that marks, in red, yellow and green, where the problems are and what to do about each one.

- **Channel not connected:** the analysis uses the video itself (frames, sound, speech) and general Shorts rules.
- **Channel connected:** the analysis also uses the channel's data:
  - The channel's recent Shorts as a baseline ("your usual Short").
  - If this Short is already published, its real retention curve, laid over the frames, so we can show where viewers left and what was on screen at that moment.

Design mockup: https://claude.ai/artifact/NxGKrmyb4oMJ6rq19LLNcM

## Ground rules

- **Nothing is saved in the database.**
  - No video, no frames, no transcript, no report.
  - The report lives in the browser tab (sessionStorage), the same as Channel Doctor and Views Check.
  - The only database writes are ones that already exist:
    - The credit charge and refund (`streamAnalysis`).
    - The daily-run counter (`consume_youtube_quota` RPC).
  - Plus the admin settings for this feature (see "Admin settings").
- **The video file never leaves the user's computer.**
  - Frames and sound are extracted in the browser.
  - Only these are sent to the server:
    - About 40 still images.
    - The audio, for transcription. This goes through the existing route.
    - A few numbers measured in the browser.
  - The server passes them to the AI providers and keeps nothing.
- **The model describes; the rules judge.** Same principle as `audit/thumbnail-audit.ts`. Vision and text models only report what they see, as structured JSON. All red/yellow/green decisions are made by pure, tested rule functions. Results are repeatable and every finding can be traced to a signal.
- **Data beats guesses.** When real retention exists, it confirms, upgrades or downgrades what the rules estimated. Every finding says whether it is *measured* (audio level, speech timing, retention) or *estimated* (anything from a vision model).
- **Honest about limits.**
  - We never predict view counts. We show risks and, with channel data, comparisons with the creator's own Shorts.
  - What we can't see is listed in the report.
- **Nothing existing changes behaviour.** This is a new route, new library code and new components. Existing helpers are called, not edited.

## What we can and can't know

| Signal | How | Measured or estimated | Available |
|---|---|---|---|
| Duration, resolution, aspect ratio, black bars | `<video>` metadata + frame pixels | Measured | Always |
| Picture change per moment (motion), scene cuts, still stretches | Frame difference in the browser | Measured | Always |
| Loudness, silence, clipping | Audio samples in the browser | Measured | Always |
| What is said, and when | Whisper via `/api/transcribe-audio` | Measured (timing), transcript can contain errors | Always (if there is speech) |
| What is on screen: subject, faces, on-screen text, its position, watermarks | Vision model on frames | Estimated | Always |
| Video type (talking, cooking/process, visual, skit…) | Vision model | Estimated; the user can change it | Always |
| Loop (does the end match the start) | First vs last frame similarity | Measured | Always |
| Retention curve of this Short | `fetchRetention` (Analytics) | Measured | Connected, Short published, ≥ 3 days old |
| "Your usual Short" retention | Median of recent Shorts' curves | Measured | Connected, ≥ 3 eligible Shorts |
| Swipe-away for this Short | Engaged views ÷ views (Views Check method) | Estimate | Connected, published |
| Studio's "Viewed vs swiped away", "Shown in feed" | — | — | **No**: Studio only |
| Frames of the channel's *other* Shorts | — | — | **No**: the API doesn't give video files; no scraping |
| Future views | — | — | **No**: we don't predict |

## How it runs

```
Browser (tab must stay open, like rendering)          Server
────────────────────────────────────────────          ──────
1. Pick file (+ optional: link to the published Short,
   title, hashtags)
2. Read metadata; reject if > 3 min or not playable
3. Extract (free, local):
   - motion samples, 4 per second, tiny greyscale
   - hook frames: 0, 0.5, 1, 1.5, 2, 3 s (720p JPEG)
   - body frames: about 40 across the video (360p)
     packed into 3×3 contact sheets
   - first and last frame (loop check)
   - audio → mono 16 kHz, loudness per 0.1 s
4. Transcribe audio  ──────────────────────────────►  /api/transcribe-audio (existing)
5. POST /api/viral-engine  ────────────────►  credits charged, daily limit
   (frames, sheets, transcript, measured signals,      stream stages (NDJSON):
    optional videoId)                                   a. vision: hook frames
                                                        b. vision: contact sheets (parallel)
                                                        c. channel data (if connected)
                                                        d. rules → timeline issues
                                                        e. AI wording + suggestions
6. Show report; save JSON to sessionStorage  ◄──────   result
```

Notes:

- **Progress UI:** steps 3–4 have their own progress (they are free and local). Step 5 streams stages like Views Check.
- **Navigation:** a `beforeunload` warning while the analysis runs.
- **Credits:** charged only at step 5. If extraction or transcription fails, the user pays nothing.
- **Request size:** about 1.5–2 MB (6 hook frames ≈ 0.6 MB, 5 sheets ≈ 1.2 MB). Hard cap at 3.5 MB, below the 4.5 MB serverless body limit.
- **Sampling longer Shorts:** body frames are spaced by `max(1 s, duration / 40)`, so a 3-minute Short still sends at most ~40 body frames in 5 sheets.

## Browser-side extraction

New folder `src/lib/viral-engine/` (browser code) with a Web Worker for the heavy maths.

- **Frames:** a hidden `<video>` element, seek to each time, `drawImage` onto a canvas.
  - Works for every format the browser can play.
  - Seeking must happen on the main thread. Pixel maths runs in the worker.
  - Later option: WebCodecs + an MP4 demuxer, fully in a worker. Not needed for v1.
- **Motion:** at 4 samples per second, downscale to 64×114 greyscale and compute the mean absolute difference from the previous sample.
  - Outputs a motion value (0–1) per 0.25 s.
  - A **cut** is a jump above `RULES.cutThreshold`.
  - A **still stretch** is motion below `RULES.stillThreshold` for longer than `RULES.stillMinSec`.
- **Audio:** reuse `decodeToMono` from `audio-encoder.ts` (it decodes the audio track of MP4/MOV/WebM in Chromium, Safari and Firefox).
  - RMS per 0.1 s gives near-silence segments, a rough loudness value and clipping.
  - "No speech" and "no sound" are kept separate. Music and cooking sound count as sound.
- **Transcription:** reuse the client path in `audio-transcriber.ts`, which already splits long audio at silences with `splitAtSilence` and posts to `/api/transcribe-audio`. We need word or segment timestamps and the detected language.
- **Black bars and aspect ratio:** checked from the pixels of a few frames.
- **Loop:** similarity between the first and last frame, using the same tiny greyscale images.

Output, `ExtractedSignals`:

```ts
interface ExtractedSignals {
  durationSec: number;
  width: number; height: number;
  letterboxed: boolean;
  motion: number[];            // per 0.25 s, 0–1
  cuts: number[];              // seconds
  loudness: number[];          // per 0.1 s, dBFS
  clippingPct: number;
  loopSimilarity: number;      // 0–1
  speech: { start: number; end: number; text: string }[];
  speechLanguage: string | null;
}
```

## Server-side analysis

New folder `src/lib/viral-engine/ (server parts in `server/`)`:

- **`vision.ts`:** calls the admin vision models (`settings.visionModels`, currently Qwen3-VL-30B → Gemma-3-27B fallback).
  - **Hook call:** one call with the 6 hook frames. It returns, per frame: main subject, faces, on-screen text, text position (top / middle / bottom; left / centre / right), text size (small / readable / large), and whether anything is happening.
  - **Sheet calls:** one call per contact sheet, run in parallel (concurrency 3). Each cell is labelled with its timestamp. Same fields per cell, plus:
    - `watermark` (none / TikTok / CapCut / other logo).
    - `looksReused` (e.g. TV or film footage): a low-confidence flag.
    - `showsResult` (a finished dish, a reveal, a punchline moment).
  - **Format:** the first sheet call also returns `format`: `talking | tutorial | process | visual | skit | music | other`.
  - **Validation:** every answer is checked with a zod schema. Invalid → next model. All fail → that part becomes a limitation, not a failure.
  - **Images:** sent as base64 data URLs (see open question 1). Unlike `analysis/thumbnails.ts` there is no outbound URL to restrict, but data URLs are size- and type-checked (JPEG only, max size per image).
- **`channel.ts`** (connected only):
  - **This Short's retention:** if a video link is given, check ownership with the same rule as `video-analysis.ts` (`VideoNotOwnedError`), then fetch its retention with `fetchRetention`.
    - Map `elapsedVideoTimeRatio` × duration to seconds.
    - Skip if the Short is under 3 days old: "too early, retention not ready".
    - If the YouTube duration and the file's duration differ by more than 1 s, warn that the file may not be the same video and don't overlay.
  - **Baseline:** the last N eligible Shorts (admin cap, default 8). For each, `fetchRetention`, then the median curve per ratio bucket gives "your usual Short". Fewer than 3 → no baseline, said in the report.
  - **Swipe-away and daily views:** reuse the Views Check fetch helpers for this Short.
- **`rules-config.ts`:** every threshold in one `RULES` object (same pattern as `views-check/rules-config.ts`).
- **`engine.ts`:** `analyzeShort(input) → ShortsCheckReport`. Pure, no I/O. Builds the issues, then applies the retention override.
- **`ai.ts`:** wording and suggestions with `callLLM` (text models). Same contract as `views-check/ai.ts`:
  - The AI may reword findings. It may not add causes or numbers.
  - The transcript and title are the creator's content, never instructions.
  - A deterministic fallback text is used if every model fails.
  - **Suggestions** (labelled "AI suggestions"): 3 alternative opening lines, 3 titles, up to 3 hashtags.
  - Report language comes from `audit/language.ts`.
- **`run.ts`:** wires the stages for `streamAnalysis`.

## Rules

Each rule produces `TimelineIssue`s:

```ts
type Level = 'bad' | 'warn' | 'good';
type Evidence = 'motion' | 'sound' | 'speech' | 'vision' | 'retention' | 'baseline';

interface TimelineIssue {
  id: string;
  kind: IssueKind;
  startSec: number;
  endSec: number;
  level: Level;
  title: string;
  saw: string;       // what we observed, with numbers
  fix: string;       // what to do (or, for good, why it works)
  evidence: { source: Evidence; measured: boolean }[];
}
```

### Video rules (always run)

| Kind | Level | Fires when (defaults in `RULES`) | Evidence |
|---|---|---|---|
| `slow_hook` | bad | Nothing changes before 1.0 s (motion low), no speech before 1.0 s, and no on-screen text in the first frame | motion, speech, vision |
| `quiet_open` | warn | Speech starts after 1.5 s and sound is near silent in the first second (format ≠ visual/music) | speech, sound |
| `strong_hook` | good | Motion or on-screen text in the first frame, and speech or text within 0.8 s | motion, speech, vision |
| `dead_zone` | bad | A stretch ≥ 2.5 s with no speech, near-silent sound, low motion and no new on-screen text | speech, sound, motion, vision |
| `quiet_stretch` | warn / none | No speech ≥ 3 s, but sound or motion present. **warn** for talking/tutorial formats; **no issue** for process/visual/music | speech, sound, motion |
| `static_shot` | warn | One shot longer than 4 s (6 s for talking) with low motion | motion |
| `safe_zone` | warn | On-screen text or the main subject in the bottom 20% or right 15% of the frame | vision |
| `no_captions` | warn | Talking/tutorial format, speech > 50% of the duration, no on-screen captions seen | speech, vision |
| `small_text` | warn | On-screen text marked "small" | vision |
| `long_tail` | warn | Time after the payoff > max(3 s, 10% of duration). Payoff = the last `showsResult` frame, or the end of the main point in the transcript | vision, speech |
| `no_loop` | warn | `loopSimilarity` below threshold and the video ends on an outro/end card | motion, vision |
| `watermark` | bad | Another app's watermark seen in ≥ 2 frames | vision |
| `reused_content` | warn | `looksReused` in ≥ 2 frames. Wording: "may count as reused content", never "is reused" | vision |
| `loudness` | warn | Average speech loudness very low, or clipping > 1% | sound |
| `format` | warn | Not vertical, or letterboxed | measured |
| `language_mismatch` | warn | Speech language differs from the title language (and, if connected, from the main audience country's language) | speech, baseline |

Videos longer than 3 minutes are rejected before anything is charged.

### Retention override (connected and published only)

Retention is real viewer behaviour, so it is applied last and wins:

| Situation | Result |
|---|---|
| A **warn** stretch where retention stays flat (drop below `RULES.flatDrop` per second, or no worse than the usual Short) | Becomes **good**: "No talking here, but viewers stayed". This is how a silent but strong visual is judged correctly. |
| A **warn** stretch with a steep drop | Becomes **bad**, with the drop in numbers |
| A **bad** stretch with no drop | Stays **warn**: "Risky by our rules, but your viewers stayed" |
| A steep drop **with no issue** explaining it | New **bad** `retention_drop`: "Viewers left here (75% → 54%). We couldn't see a clear reason; watch this part." |
| Hook: retention at 2 s vs the usual Short | Shown on `strong_hook` / `slow_hook` with both numbers |

"Steep drop" is measured against the usual Short's slope at the same point when a baseline exists. Otherwise a fixed threshold is used.

### Video type decides which rules apply

The detected format is shown at the top ("We think this is a cooking / process Short — change"). Changing it re-runs the rules in the browser (the engine is pure and the inputs are in the report), so it costs nothing. The "It's intentional" button on a finding hides it in this tab only.

## Metadata (low weight)

Optional fields: title, hashtags, description. They are filled from the video if a link is given.

**Checks:**
- The topic is clear in the title.
- The title matches what is shown (a mismatch raises swipe-away).
- 1–3 relevant hashtags, not more.
- The title is not only hashtags.

**Shown as:** a small "Title & hashtags" card, below the timeline. The report says plainly that in the Shorts feed the opening seconds matter far more than the title.

**Cover frame:** for search, the channel's Shorts tab and Shorts shelves. We check one frame the user picks, or the frame at 0 s: is the subject clear and is the text readable at small size.

## The report (UI)

As in the mockup, under `src/components/viral-engine/`:

1. **Header:** title, duration, format (editable), "with channel data" / "without channel data".
2. **Summary:** counts (to fix, to check, working) and the biggest fix.
3. **Player:**
   - The user's own file through `URL.createObjectURL` (never uploaded).
   - Current-issue badge.
   - "Show Shorts UI" overlay for the safe zone.
4. **Detail panel:** what we saw, how to fix, "Based on" with measured/estimated tags, "Play this part", "It's intentional".
5. **Timeline tracks:** frames, health, retention (+ usual Short), speech, sound, cuts.
   - Clicking a frame or an issue jumps there.
   - Frames and issue blocks are real buttons.
   - Warn blocks are striped, so the colours don't rely on hue alone.
6. **Findings list:** in time order.
7. **Title & hashtags card** and **AI suggestions**.
8. **What this report can't see.**

**After a reload:**
- The report JSON comes back from sessionStorage.
- Frames and the player don't, because sessionStorage is too small for images. The page shows "Select the same file again to see the video" and re-extracts locally (free, no AI calls).
- File identity is matched on name + size + duration.

**Where it lives:** see open question 3.

## Admin settings

New fields in the Channel Doctor admin page, stored as columns on `channel_doctor_settings`. This is configuration, not user data. The loader uses `?? default`, so the app works before the migration.

| Setting | Default |
|---|---|
| `viral_engine_enabled` | false (admins can test while off, as in Views Check) |
| `viral_engine_credit_cost` | 10 |
| `viral_engine_runs_per_user_day` | 5 |
| `viral_engine_max_duration_sec` | 180 |
| `viral_engine_max_body_frames` | 40 |
| `viral_engine_max_baseline_shorts` | 8 |

If you want zero schema changes, these could be constants in code for v1, with admin control added later.

## Cost per run (60 s Short)

DeepInfra prices checked on 5 Nov 2026. Image tokens are estimated at ~1 token per 32×32 px.

| Part | Approx. |
|---|---|
| Vision: 6 hook frames at 720p | ~$0.002 |
| Vision: 4–5 contact sheets | ~$0.003 |
| Transcription (existing Groq/OpenAI route) | < $0.001 |
| Text model: wording + suggestions | ~$0.001 |
| **Total** | **≈ $0.006–0.01**, up to ~$0.02 with retries |
| YouTube | Analytics calls only (1 + up to 8 retention calls), no Data API search |

## Phases

### Phase 0: checks (½ day)
- Confirm DeepInfra's vision models accept base64 data URLs and multiple images per message, and measure real token use (`usage`) for one hook call and one sheet.
- Confirm `decodeToMono` decodes the audio from MP4 and MOV files in Chrome and Safari.
- Check on a real channel how `audienceWatchRatio` behaves for Shorts (values above 1 from loops; whether swiped plays are included) and normalise accordingly.
- Baseline: the test suite and `next build` pass.

### Phase 1: browser extraction (2 days)
- `src/lib/viral-engine/extract.ts` (video element, seeking, frames, contact sheets) and `signals.worker.ts` (motion, cuts, stills, loop, loudness).
- Unit tests on synthetic data: frame arrays with known cuts, audio with known silences.

### Phase 2: rules engine (2 days)
- `rules-config.ts`, `engine.ts`, `types.ts` under `src/lib/viral-engine/ (server parts in `server/`)`.
- `engine.test.ts`: one fixture per rule, format-dependent behaviour (silent cooking vs silent talking), all four retention-override cases, and a "silent but strong visual" fixture that must come out good.

### Phase 3: vision, channel data, AI (2 days)
- `vision.ts` with zod schemas and model fallback.
- `channel.ts`: ownership check, retention mapping, baseline median.
- `ai.ts`: wording, deterministic fallback and suggestions.
- `route.ts` at `src/app/api/viral-engine/route.ts`:
  - `requireUser` + `streamAnalysis`.
  - `needsYouTube: false` when no video link is given and the channel isn't connected, so unconnected users can run it.
  - Body size and type checks.
- Tests: schema validation and the retention-to-seconds mapping.

### Phase 4: UI (2½–3 days)
- Picker (file + optional link, title, hashtags).
- Local progress and stage progress.
- Report components per the mockup.
- sessionStorage save and restore, with "select the file again".
- Admin fields and migration.

### Phase 5: testing and release (1 day)
- Manual tests:
  - 5 real Shorts: talking, cooking (silent parts), a visual one, one with a TikTok watermark, and one published Short on a connected channel.
  - Safari and Chrome; a 3-minute Short.
- Regression: the full suite, `next build`, and Channel Doctor / Views Check unchanged.
- Privacy policy line: frames and audio are sent to AI providers for processing and not stored by us.

**Estimate:** about 10–11 working days.

## Risks

- **The vision model misreads frames.** It is labelled "estimated". Rules need ≥ 2 frames for serious flags (watermark, reused). The user can mark a finding as intentional.
- **Wrong format guess** changes which rules apply. It is shown and editable, and a change re-runs for free.
- **Short too new** for retention (2–3 day lag). The report says "come back in X days for the retention view".
- **Small channels** have fewer than 3 Shorts for a baseline. The report shows no comparison and says so.
- **Tab closed mid-run:** local steps are lost, but no credits were charged before step 5. If the tab closes during step 5, the existing `streamAnalysis` refund-on-failure behaviour applies.
- **Low-power phones:** extraction is slower. Show the estimated time and allow cancel before the charge.
- **Provider data handling:** frames and audio go to DeepInfra and Groq/OpenAI. Check their retention terms and state them in the privacy policy.

## Open questions

1. **Data URLs:** does DeepInfra accept base64 images for both vision models? (Phase 0.) If not, we would have to upload frames somewhere temporarily, which conflicts with "nothing stored". Then we'd use short-lived signed URLs deleted right after the call, or pick another provider.
2. **Admin settings:** columns on `channel_doctor_settings` (recommended) or constants for v1?
3. **Where the page lives:**
   - **Option A (recommended):** a new page, `/viral-engine`, open to unconnected users, plus a link from Channel Doctor.
   - **Option B:** a tab inside Channel Doctor, which today needs a connected channel.
4. **Auto-fix** (trim dead zones and the tail, add captions with the export engine) is out of scope for v1. It's a good v2 because the timeline already has the cut points.
