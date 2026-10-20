# Audit — Implementation Plan

Analyze any channel or video and say, with evidence, what works and where it is weak: packaging (title and thumbnail), performance against that channel's own usual, and what viewers say. Built on Phase 1 (Channel Doctor) and Phase 2 (Discover).

## 0. Scope decision (20 Oct 2026)

- **One analysis engine, two entry points:**
  - **Other channels and videos** (competitors, any public link): inside **Discover**.
    - **Competitors tab:** "Analyze channel" on each competitor, plus a box to paste any channel or video link.
    - **Market tab:** "Why did this work?" on each standout video.
  - **Your own channel and videos:** inside **Channel Doctor's video check-up**, which already has CTR, retention and traffic. The audit adds its packaging and comment sections there.
- No new page or sidebar item.
- **V1:** video audit (public) and the Market tab entry. **V2:** channel audit. **V3:** own-video extras. **V4:** compare mode.

---

## 1. What we can know (and what we can't)

| Signal | Own (connected) | Other channels |
|---|---|---|
| Title, description, tags, thumbnail, duration, publish date | ✅ Data API | ✅ Data API |
| Views, likes, comment count | ✅ | ✅ |
| Viewer comments | ✅ `commentThreads.list` | ✅ `commentThreads.list` |
| Impressions, CTR | ✅ reach report | ❌ |
| Retention, traffic sources | ✅ Analytics | ❌ |
| Transcript | ❌ (needs the `youtube.force-ssl` scope) | ❌ (owner only) |

**Rules:**
- No scraping or unofficial transcript tools. The API project must survive its audit.
- Data from other channels is processed in memory for one request and never stored (30-day rule). Results live in the browser tab, as in Discover.
- Every report states what can't be known: *"YouTube doesn't share another channel's click rate or retention; this part is estimated from public signals."*
- Scores and ratios are our calculations, labelled as such, never presented as YouTube metrics.

---

## 2. Video audit (V1)

**Input:** a video link (`parseVideoId`, C5).

**Fetch** (about 5 quota units, no search):
1. `videos.list` (snippet, contentDetails, statistics) for the video.
2. Its channel: the uploads playlist (`UU…`), `playlistItems.list`, then `videos.list` for up to 50 recent uploads (the baseline).
3. `commentThreads.list` (`order=relevance`, `maxResults=100`, `textFormat=plainText`). Comments disabled → `403 commentsDisabled` → the comment section says so.
   - **Comments need a server API key** (`YOUTUBE_API_KEY`, same Google Cloud project, restricted to the YouTube Data API v3). Tested on 20 Oct 2026: `commentThreads.list` returns `403 insufficientPermissions` with the user's `youtube.readonly` token. The scope that allows it (`youtube.force-ssl`) can also change the channel, which isn't worth asking users for.
   - Without the key, the comment section is skipped, and the report says so.

**Analysis.** Deterministic, reusing existing code; every finding carries its evidence and a confidence.

| Section | What | Reuses |
|---|---|---|
| **Performance vs its channel** | Views ÷ the channel's median for the same format at age 7–365 days → outlier / typical / under. Like and comment rates vs the channel's medians. Too new or too few videos → "can't compare yet". | `publicBaselines`, `judgeVideo` (Phase 2) |
| **Title** | Mechanism(s); length and the 70-character cut; whether the subject comes in the first 40 characters; numbers, question, all-caps; hype words. | `titleMechanisms`, `titleFeatures` |
| **Thumbnail** | Subject and its size, face, text and word count, contrast, background clutter, readable at phone size. | `describeThumbnail` (Phase 1 vision, allow-listed hosts) |
| **Title × thumbnail** | Repeated words (wasted space); whether the thumbnail shows what the title promises (the AI judges, but only from the two descriptions). | new, small |
| **Description and metadata** | First two lines (the visible part), chapters present, links, hashtags, tag count. | new, deterministic |
| **Viewers (comments)** | The AI groups comments into: what viewers liked, what they complained about (too long, clickbait, audio…), and questions the video didn't answer (→ "ideas for your next video"). Counts per group; short quotes **without author names**. | new: `ai/comments.ts` |
| **Format and length** | Duration vs the channel's usual for that format; Shorts vs long-form. | `publicFormat` |

**Output** (`AuditReport`, zod):
- `verdict`: one sentence.
- `strengths[]` and `weaknesses[]`, each `{ area, statement, evidence, confidence }`, ranked by impact.
- `lessons[]`: what to copy or avoid on your channel. Written by the AI from the findings only, with the existing number guard.
- `limitations[]`.

---

## 3. Channel audit (V2)

**Input:** a channel link or @handle (`fetchChannelByHandle`), or a competitor from the watchlist.

**Fetch:** channel info and up to 100 uploads with statistics (about 5 units).

**Analysis:**
- **What works there:** outliers vs underperformers, compared by format, title mechanism and length (`findOutliers`, `titleMechanisms`, `ruleFormats`).
- **Thumbnail style:**
  - vision on their top 4 and weakest 4 (8 calls, admin-capped);
  - what the winners share (face, text, contrast);
  - whether the style is consistent across the channel.
- **Rhythm:** uploads per month, gaps, Shorts share (`profileChannel`).
- **Hit rate:** outliers ÷ eligible videos.
- **If the user is connected,** a "vs you" line for each finding (e.g. *"their standouts use a question title; 2 of your last 10 do"*).

No topic clustering in V2: it needs embeddings and adds cost. It may come later.

---

## 4. Own videos (V3, in Channel Doctor's video check-up)

- Adds the V1 **packaging** and **comments** sections to the existing check-up.
- **Retention mapped to the script:** for a video made with Create, the script's sections are placed on the timeline using estimated durations, so a drop reads *"22% left at 1:40, during 'Context'"*. This is unique to us, because we have the script.
- **Paste a transcript or SRT** for videos not made with Create. The user provides it, so no new scope is needed. It is used in memory only.
- Hook check: whether the first 15 seconds of the script or transcript deliver the title's promise.

## 5. Compare mode (V4)

Your video next to a competitor's standout on the same topic: packaging side by side, performance relative to each channel's usual, and the comment themes of each.

---

## 6. Architecture

```
Link → resolve (video | channel | handle) → own channel? ─ yes → Channel Doctor video check-up (V3)
                                                       └ no  → Audit pipeline
Audit pipeline (streamAnalysis: credits up front, refund on failure, NDJSON stages):
  fetch (Data API, user's token) → deterministic analysis → vision (thumbnails) → AI (comments + lessons) → AuditReport
```

- **Modules** (`src/lib/youtube/audit/`):
  - `resolve.ts`
  - `fetch.ts`
  - `video-audit.ts` (deterministic)
  - `channel-audit.ts`
  - `ai/comments.ts`
  - `ai/lessons.ts`
  - `report-schema.ts`
- **Routes:**
  - `POST /api/youtube/audit/video` (stream)
  - `POST /api/youtube/audit/channel` (stream)
  - Both are gated like Discover (plan and admin switch), with a per-user daily cap.
- **UI** (`src/components/audit/`): `AuditReportView`, used in a drawer or page from the Competitors and Market tabs, and as sections in the video check-up.
- **Storage:** none on the server. The report is kept in sessionStorage for the tab and cleared on sign-out and disconnect (`clearAllReports`).
- **AI:**
  - Comment text goes to DeepInfra without author names or ids, capped at 100 comments of 500 characters each.
  - Thumbnails go only via the allow-listed `i.ytimg.com` URLs.
  - Nothing is logged except operation names and error codes.

## 7. Settings (admin → Discover section)

| Setting | Default |
|---|---|
| `audit_enabled` | false |
| `video_audit_credit_cost` | 5 |
| `channel_audit_credit_cost` | 10 |
| `audit_runs_per_user_day` | 20 |
| `audit_max_comments` | 100 |
| `audit_max_thumbnails` (channel audit) | 8 |

Access follows Discover's plans, because the entry points live in Discover. Own-video extras follow Channel Doctor's plans.

## 8. Privacy page

Add to section 4: other channels' public data, including comment text, is read on request for an audit, processed in memory, and not stored. Comment text (without names) is sent to the AI provider to group themes.

---

## 9. Milestones

| # | Scope | Done when |
|---|---|---|
| **A1** | Resolver, fetch (video and its channel baseline, comments), deterministic video findings, settings and admin, route | A real video link gives the performance, title, metadata and format findings, with tests |
| **A2** | Thumbnail (vision), title × thumbnail check, comment themes (AI), lessons (AI with number guard), report schema | A real video gives a full report in English and Bangla |
| **A3** | UI: report view; "Why did this work?" in the Market tab; paste box in the Competitors tab | Usable from both tabs |
| **A4** | Channel audit (V2) and "Analyze channel" on competitors | A real competitor channel gives a report |
| **A5** | Own-video extras in the video check-up (V3): packaging, comments, retention on the script, transcript paste | A Create video shows drops by script section |
| **A6** | Compare mode (V4), privacy page, hardening | Checklist complete |

## 10. Risks

- **Comments can be spam or off-topic:** themes need at least 3 comments each, and spam-like lines (links, repeated text) are dropped first.
- **Small channels have too few videos for a baseline:** the report says "can't compare yet" instead of guessing.
- **Vision can misread thumbnails:** it describes only what is visible, using the existing schema; findings from it are marked medium confidence.
- **Quota:** about 5 units per video audit, no search. A daily cap per user protects the shared quota.

## 11. Decisions (20 Oct 2026)

1. **Plans:** the audit follows Discover's plans (Creator and Studio by default). The admin can change them, as with any feature.
2. **Comment analysis is on by default.** The privacy-page addition (§8) ships in the same milestone as the comment analysis (A2), before the audit is switched on for users.

## 12. A2 notes (20 Oct 2026)

- **Comment themes:** the model returns comment *numbers* per theme, not counts or quotes. Counts and the two example quotes are taken from the real comments, so nothing can be invented. Reused or unknown numbers are dropped, and a theme needs at least 3 comments. Lines with links, repeats and one-word lines are removed before sending.
- **Thumbnail:** rules judge the vision model's description (readable at phone size, words on the image, subject size, contrast, busy background, text repeating the title). Everything from vision is medium confidence at most. Faces aren't reported: in testing the model called animal faces human.
- **Verdict and lessons:** written from the checked findings and themes only. Any number not in the input is rejected; "21,326,354" is read as one number, and rounded millions of an input number are allowed. The model is told not to link findings as cause and effect. Without a usable answer, a plain verdict is built from the performance label, in English or Bangla.
- **Theme kinds:** liked, complaint (about the video itself), question (unanswered, i.e. ideas for the next video), and discussion (debate about the subject). In testing, opinions about the topic were filed as complaints until "discussion" was added.
- Tested with real AI on 20 Oct 2026: two Kurzgesagt videos and one TerraLore video, in English and Bangla, including 100 real comments per video through `YOUTUBE_API_KEY`. Reading the comments takes about 0.5 s; grouping them takes 8–17 s.

## 13. A4 notes (20 Oct 2026)

- **Channel audit:**
  - It reads up to 100 recent uploads (about 4 quota units).
  - Each video is judged against the channel's own usual for its format: standouts at 2× or more, weak below 0.5×.
  - A trait is stated only when it splits the two groups by 40 points or more, with at least 3 videos on each side.
- **Thumbnails:** up to `audit_max_thumbnails` (8) long-form thumbnails, half standouts and half weakest, with at least 3 on each side. Shorts are left out.
- **You vs them:**
  - Their standouts' main title mechanism, and how many of your last 10 titles use it.
  - Their Shorts share vs yours.
  - Their upload frequency vs yours.
- **Lessons:** the channel prompt is the video prompt adapted. Lessons are phrased as things to test, never rules, because the patterns are correlations from a few videos.
- **Entry points:** "Analyze" on each competitor (Competitors tab), and the paste box, which now accepts channel links and @handles too.
- **Pages:** `/discover/channel/[ref]` (channel id or @handle), sharing the run, cache and frame code (`useAudit`, `AuditShell`) with the video page.
- **Tested with real data on 20 Oct 2026:**
  - Kurzgesagt: 100 videos, 3 standouts, about 6 s.
  - Veritasium: 99 judged, 5 standouts (17× "Can you swim in shade balls?"), about 7 s.

## 14. A5 notes (20 Oct 2026)

- **Where:** inside Channel Doctor's existing video check-up (same route and price). After the Analytics analysis, `ownVideoExtras` adds:
  - **Packaging rules:** title and description findings from the video audit, plus thumbnail rules on the check-up's existing thumbnail description. Performance is left out here, because the check-up already has it from Analytics.
  - **What viewers say:** comment themes in the title's language.
  - **Retention on the script:** for a video made with Create and linked, each script part is timed by its share of the script's words, scaled to the real length. The part that lost the most viewers is highlighted, and the times are labelled as estimates.
- **Transcript paste** (videos not made with Create): an SRT/VTT file or plain text is matched to the retention drops in the browser only, never sent or stored. Plain text is placed by word count and the page says so.
- Reports saved before A5 have no `extras`, and the page shows them as before.
- Tested on 20 Oct 2026 on a real TerraLore video: packaging findings correct; it has no comments; it isn't a Create video, so there was no script timeline. The script timeline is tested with fixtures only until a Create video is published and linked.
