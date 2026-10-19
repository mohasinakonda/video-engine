# Phase 1 — YouTube Channel Diagnosis

## Master Implementation Prompt for an AI Coding Editor

Act as a senior product engineer, solution architect, full-stack developer, and UI/UX designer.

Your task is to implement **Phase 1: YouTube Channel Diagnosis** as a new module inside my existing AI video engine application.

This is not a standalone prototype. You must integrate the feature into the existing project, preserve the current application, follow its architecture, and deliver a functional, production-oriented implementation.

Do not stop after creating mockup screens. Authentication, YouTube connection, API integration, data processing, AI analysis, error handling, and the complete user journey must be implemented.

---

# 1. Product Vision

Build a YouTube Channel Diagnosis system that answers:

**"Why is my YouTube channel not growing, what is limiting its performance, and what should I fix first?"**

The application should connect to a creator's YouTube channel, retrieve available channel and analytics data, analyze video performance, detect potential growth bottlenecks, and generate evidence-based recommendations.

The product must distinguish between:

- Problems attracting viewers.
- Problems retaining viewers.
- Problems with topic selection.
- Problems with title and thumbnail packaging.
- Problems with audience acquisition and traffic sources.
- Problems with publishing consistency.
- Areas where there is insufficient evidence to make a reliable conclusion.

Every diagnosis must be supported by available data. Never invent metrics, claim access to unavailable information, or present unsupported assumptions as facts.

## Phase 1 scope

Implement:

1. Application authentication integration.
2. Google OAuth 2.0.
3. YouTube channel connection and account selection.
4. YouTube Data API v3 integration.
5. YouTube Analytics API integration.
6. Channel overview and performance dashboard.
7. Video performance analysis.
8. Audience retention analysis where available.
9. Title and thumbnail analysis.
10. Growth bottleneck detection.
11. Evidence-based AI recommendations using DeepInfra.
12. Responsive UI, loading states, error handling, security, and privacy controls.

Competitor discovery, large-scale competitor research, content gap discovery, low-competition niche research, and automated video generation are explicitly outside this phase. Keep the architecture extensible for these future phases without implementing them now.

---

# 2. Start by Inspecting the Existing Project

Before changing any files, inspect the existing repository.

Identify:

- Frontend framework and version.
- Backend framework and API architecture.
- Existing routing and application layout.
- Existing authentication system.
- Database and ORM.
- Existing design system and UI component library.
- Current styling conventions.
- Existing state management and data-fetching patterns.
- Existing AI/LLM integrations.
- Existing video generation modules.
- Existing environment variable conventions.
- Current testing and build setup.

Create a short implementation plan based on the actual repository.

Do not assume that the application uses a particular framework, ORM, database, or CSS library. Reuse the existing stack and conventions.

If an existing authentication system is available, integrate with it instead of creating a competing authentication system.

If the project is incomplete, identify what is missing and implement the smallest compatible solution.

Do not replace working components or refactor unrelated modules without a clear technical reason.

Before modifying files, identify potential integration risks and explain the proposed changes.

Then proceed with implementation in logical steps.

---

# 3. Application Authentication

Integrate the feature with the application's existing user authentication system.

Requirements:

- Users must sign in to the application before connecting YouTube.
- Every YouTube connection must belong to the authenticated application user.
- Users must not be able to access another user's tokens or channel connection.
- Enforce authorization on the server for every protected endpoint.
- Do not trust a user ID supplied by the frontend.
- Use the authenticated server-side session to identify the current user.
- Provide appropriate sign-in, sign-out, expired-session, and unauthorized-access handling.

Do not require users to manually provide YouTube API keys.

Application authentication and Google/YouTube authorization are separate concerns and must be implemented accordingly.

---

# 4. Google OAuth 2.0 and YouTube Connection

Implement the appropriate Google OAuth 2.0 web-server flow for the existing application.

Use the minimum permissions required for Phase 1.

Recommended scopes:

- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

The first supports authorized read access to the user's YouTube account data. The second supports authorized access to YouTube Analytics reports.

Request additional scopes only if an implemented feature genuinely requires them.

## OAuth requirements

Implement:

1. Connect YouTube button.
2. Server-side authorization URL generation.
3. Secure OAuth state generation and validation.
4. CSRF protection.
5. Google OAuth callback.
6. Authorization-code exchange on the server.
7. Access token and refresh token handling.
8. Token expiry tracking.
9. Refresh-token handling when a valid refresh token is available.
10. OAuth failure and cancellation handling.
11. YouTube connection status.
12. Disconnect YouTube functionality.
13. Reconnection and reauthorization when necessary.

Use exact registered redirect URIs and appropriate OAuth client configuration.

Never expose client secrets, access tokens, refresh tokens, or other credentials to frontend JavaScript.

Do not assume Google will return a refresh token on every authorization. Handle initial authorization and reauthorization correctly.

Use secure, HTTP-only, appropriately configured cookies for application sessions where applicable.

## Channel identification

After successful authorization, identify the authenticated user's accessible YouTube channel using the appropriate authenticated YouTube Data API request, such as `channels.list` with `mine=true`.

If the account exposes multiple relevant channels or channel identities, handle the result explicitly. Never silently associate the connection with an arbitrary channel.

Display the selected channel's:

- Channel name.
- Profile image.
- Channel ID.
- Channel URL when available.
- Subscriber count when available.
- Total public video count when available.
- Connection status.

If the API response does not establish a reliable channel selection, ask the user to resolve it instead of guessing.

---

# 5. Database and Privacy Architecture

A core product requirement is that **YouTube audit and research data must not be permanently stored in the application's database by default**.

OAuth credentials and application configuration are persistent. Channel analysis data is transient.

## Persistent database records

Store only the information needed to operate the application, such as:

- Application user ID.
- YouTube connection record.
- YouTube channel ID.
- Encrypted access token when needed.
- Encrypted refresh token.
- Token expiry metadata.
- Authorized OAuth scopes.
- Connection status.
- Creation and update timestamps.
- Existing subscription or billing records.
- Necessary application preferences.

Adapt the schema to the existing database.

Use encryption at rest for sensitive OAuth credentials, ideally with encryption keys managed separately from the database. Never store plaintext credentials in logs.

## Do not permanently persist

- Raw YouTube channel responses.
- Raw video metadata collected for an audit.
- Daily analytics reports.
- CTR and watch-time datasets.
- Retention time-series data.
- Public competitor research results.
- Downloaded thumbnail files.
- Transcript content collected for analysis.
- Intermediate LLM prompts containing channel data.
- Generated audit reports or audit snapshots.

Do not create permanent audit-history tables for Phase 1 unless a future, explicitly consented feature requires them.

## Transient processing

Use request-scoped memory or a suitably configured temporary processing layer.

The intended workflow is:

YouTube API → temporary data → metric calculations → AI analysis → dashboard response → discard temporary data.

Avoid persistent caches for YouTube-derived data in this phase.

If temporary caching becomes necessary for performance, make it short-lived, isolate it by user/session, document its purpose, and ensure it cannot accidentally become permanent storage.

Do not write raw data to temporary files unless strictly necessary. If files are required, use controlled temporary storage and delete them after processing.

Configure application logs, error reporting, tracing, and analytics to redact tokens, transcripts, raw YouTube responses, and sensitive prompts.

Treat the privacy requirement as an end-to-end requirement, not merely a database-schema requirement.

Review applicable YouTube API developer policies, including data storage, refresh, deletion, and user consent requirements, before deployment.

---

# 6. YouTube API Integration

Use server-side API services.

## A. YouTube Data API v3

Use the application's server-side API key for supported public-data requests.

Store the API key in an environment variable, never in frontend code.

Example configuration:

`YOUTUBE_API_KEY`

Use Data API requests for the public and authorized metadata needed by the implemented features, including:

- Channel metadata.
- Video metadata.
- Video titles and descriptions.
- Publication dates.
- Duration.
- Available public statistics.
- Thumbnail URLs.
- Video and channel identifiers.

Use authenticated requests where required.

Avoid unnecessary repeated requests. Fetch only the fields needed, handle pagination, and account for quota limitations.

Do not implement aggressive competitor searches in Phase 1.

## B. YouTube Analytics API

Use the authenticated user's OAuth access token.

Use `yt-analytics.readonly` for read-only analytics.

Retrieve supported metrics and dimensions where available, including:

- Views.
- Estimated minutes watched.
- Average view duration.
- Average percentage viewed.
- Subscribers gained and lost where supported.
- Impressions and impressions click-through rate where supported.
- Traffic sources.
- Video-level performance.
- Audience retention reports.
- Other relevant supported reports when justified.

Choose valid combinations of metrics, dimensions, filters, and date ranges according to the API documentation.

Do not assume every metric is available for every report, channel, video, date range, or account.

If a report is unsupported or unavailable, explain the limitation in the UI and continue with the remaining available data.

Never substitute public view counts for private analytics metrics such as impressions CTR.

## Date ranges

Support at least:

- Last 28 days.
- Last 90 days.
- Previous comparable period where valid.

Use the channel's reporting timezone when available and clearly label the selected reporting period.

Avoid comparing unequal periods without explicitly accounting for their lengths.

## API reliability

Implement:

- Request timeouts.
- Bounded retries for transient failures.
- Rate-limit and quota error handling.
- Token refresh and retry where appropriate.
- Pagination.
- Partial-data handling.
- Clear error messages.
- Server-side request validation.

Do not repeatedly retry authorization failures or invalid requests.

---

# 7. Channel Diagnosis Dashboard

Build a polished, responsive dashboard that feels like a serious creator analytics product.

Use the existing design system.

If the project does not have a consistent design system, establish a minimal one with reusable components, typography, spacing, colors, and accessible interaction states.

Avoid unnecessary gradients, excessive decoration, oversized cards, fake charts, and generic AI-dashboard aesthetics.

The design should prioritize clarity, evidence, and actionable information.

## Dashboard layout

### A. Channel header

Display:

- Channel avatar.
- Channel name.
- Channel URL.
- Connected status.
- Last analysis time for the current session.
- Date-range selector.
- Refresh/reanalyze action.

Do not persist the analysis timestamp or report unless explicitly required. A session-only timestamp is sufficient.

### B. Key metrics

Display supported metrics such as:

- Views.
- Watch time.
- Subscribers gained.
- Impressions.
- Impressions CTR.
- Average view duration.
- Average percentage viewed.

Show percentage changes only when a valid comparable period is available.

Each metric must have:

- Human-readable label.
- Actual value.
- Comparison period where applicable.
- Explanation or tooltip.
- An appropriate unavailable-data state.

Do not fabricate values or display placeholder statistics as real channel performance.

### C. Performance trends

Show meaningful charts for supported data:

- Views over time.
- Watch time over time.
- Subscriber changes.
- CTR over time when available.

Use clear axes, units, dates, and tooltips.

Do not render misleading graphs when the dataset is missing or incomplete.

### D. Top and underperforming videos

Rank videos using explicitly defined, data-supported criteria.

Show:

- Thumbnail.
- Title.
- Publication date.
- Views.
- CTR where available.
- Average view duration.
- Average percentage viewed.
- Performance relative to an appropriate channel baseline.

Distinguish absolute reach from performance relative to the channel's own history.

Avoid ranking videos by raw views alone when video age and exposure differ substantially.

### E. Growth diagnosis

Present:

- Primary bottleneck.
- Secondary bottlenecks.
- Strengths.
- Uncertain findings.
- Top recommended actions.

Each diagnosis must be expandable to show the supporting evidence.

---

# 8. Video Performance Analysis

Implement an analysis view for an individual video.

The user should be able to select a video from the connected channel and inspect its performance.

Analyze, where supported:

- Views and watch time.
- Impressions and CTR.
- Average view duration.
- Average percentage viewed.
- Subscriber gains.
- Traffic sources.
- Retention data.
- Title and thumbnail.
- Performance relative to comparable videos.

Use a suitable comparison baseline.

For example, compare a video against videos with similar publication ages or comparable formats when enough data exists.

Clearly distinguish:

- Absolute performance.
- Relative performance.
- Statistical evidence.
- AI interpretation.

Do not conclude that a video failed solely because its lifetime view count is low.

Do not conclude that packaging caused low performance solely from low CTR without considering impressions, audience, topic, traffic source, and sample size.

---

# 9. Audience Retention Analysis

Implement retention analysis using the supported YouTube Analytics API retention metrics and dimensions.

Investigate the documented retention report and use available fields such as:

- `elapsedVideoTimeRatio`
- `audienceWatchRatio`
- `relativeRetentionPerformance`

Only use these fields where the report and channel permissions support them.

## Retention engine

Implement deterministic backend logic to:

1. Validate retention points.
2. Order points by elapsed video time.
3. Normalize the time positions.
4. Detect unusually large local declines.
5. Identify potential rewatch spikes.
6. Compare with an appropriate baseline where available.
7. Estimate the relevant timestamp from the video's duration.
8. Attach confidence and sample limitations.

Do not interpret every decline as a content failure. Normal retention decay is expected.

Distinguish a local anomaly from a general downward trend.

## Transcript and scene analysis

Do not assume YouTube provides a transcript for every video.

If an authorized transcript source is available and legally usable, analyze only the relevant segment. Otherwise, provide the retention finding without pretending to know what was said or shown.

For each detected issue, show:

- Timestamp.
- Retention signal.
- Severity.
- Supporting evidence.
- Possible explanation.
- Suggested investigation or improvement.
- Confidence.

Label explanations as hypotheses unless corroborated by sufficient evidence.

Do not generate fabricated transcripts, timestamps, or scene descriptions.

---

# 10. Title and Thumbnail Intelligence

Implement a title and thumbnail analysis module for videos owned by the connected channel.

## Title analysis

Extract and evaluate:

- Topic clarity.
- Audience intent.
- Specificity.
- Promise clarity.
- Curiosity.
- Relevance to the video.
- Similarity to the channel's own successful title patterns.

Avoid simplistic rules such as assuming that shorter titles are always better or that emotional wording always increases CTR.

## Thumbnail analysis

Use actual thumbnail images and a supported image-capable model or image-analysis pipeline.

Evaluate:

- Main subject visibility.
- Subject size.
- Composition.
- Visual hierarchy.
- Background complexity.
- Contrast.
- Text density.
- Visual clarity.
- Consistency across the channel.
- Similarities and differences between successful and weaker videos.

Use thumbnails as evidence, not as proof of causality.

Do not recreate thumbnails or generate new thumbnails in this phase.

If the chosen DeepInfra model does not support image input, use a compatible image-capable model or a separate image-analysis service. Do not send image URLs to a text-only model and pretend it has seen the images.

Use supported image inputs and secure URL handling.

---

# 11. Deterministic Diagnosis Engine

The backend must calculate facts before invoking the LLM.

Implement reusable services for:

- Metric normalization.
- Channel baselines.
- Video performance comparisons.
- Outlier detection.
- Retention anomaly detection.
- Title feature extraction.
- Thumbnail analysis inputs.
- Topic and format grouping where supported.
- Evidence generation.
- Confidence estimation.

Do not use a single arbitrary formula to declare a channel healthy or unhealthy.

Use multiple evidence signals to identify possible bottlenecks.

Examples:

### Potential packaging problem

CTR is weak relative to an appropriate baseline, with sufficient impressions and contextual evidence.

### Potential retention problem

Early or mid-video retention is unusually weak compared with a suitable baseline.

### Potential topic-selection problem

Several recent videos underperform comparable channel videos and lack positive demand or audience-fit signals. Do not make this claim from low views alone.

### Potential audience-acquisition problem

Traffic sources or impressions show limited discovery, subject to the reports available.

### Insufficient evidence

The dataset is too small, incomplete, or inconsistent to make a confident diagnosis.

A channel can have multiple bottlenecks or no clearly identifiable bottleneck.

Make the rules configurable and testable.

---

# 12. DeepInfra AI Integration

Use DeepInfra for interpretation and recommendation generation.

Store the API credential server-side:

`DEEPINFRA_API_KEY`

Make the model configurable:

`DEEPINFRA_MODEL`

Do not hardcode a model that has not been verified to support the required task.

Use a server-side AI service with:

- Structured inputs.
- Explicit system instructions.
- Structured output validation.
- Request timeout.
- Bounded retry policy.
- Token limits.
- Error handling.
- Safe handling of untrusted text.
- No secrets in prompts.

## AI responsibilities

The LLM may:

- Explain statistical findings.
- Summarize the channel's strengths and weaknesses.
- Interpret supported title and thumbnail findings.
- Explain retention anomalies using available transcript context.
- Prioritize actionable improvements.
- Generate a readable diagnosis report.

The LLM must not calculate authoritative analytics metrics from scratch when the backend can calculate them accurately.

It must not invent metrics, citations, competitor research, or unavailable audience data.

## Input strategy

Do not dump the entire raw API response into the LLM.

Send a compact structured payload containing:

- Reporting period.
- Channel baselines.
- Top and underperforming videos.
- Relevant performance comparisons.
- Retention anomalies.
- Title and thumbnail findings.
- Data limitations.
- Evidence references.

Minimize the amount of potentially sensitive channel data sent to the AI provider.

Validate all generated JSON before rendering it.

If the LLM response is invalid or unavailable, show deterministic findings and a clear partial-result message instead of failing the entire audit.

---

# 13. Structured Diagnosis Output

Define a schema similar to the following, adapted to the application's language and validation library:

{
"reportTitle": "Channel Growth Diagnosis",
"reportingPeriod": {
"startDate": "YYYY-MM-DD",
"endDate": "YYYY-MM-DD"
},
"primaryBottleneck": {
"category": "packaging",
"summary": "Short explanation",
"evidenceIds": ["evidence_1"],
"confidence": "medium"
},
"secondaryBottlenecks": [],
"strengths": [],
"recommendedActions": [
{
"priority": 1,
"title": "Action title",
"reason": "Why this action matters",
"evidenceIds": ["evidence_1"],
"expectedImpact": "potentially_high",
"effort": "low",
"confidence": "medium"
}
],
"limitations": []
}

This is an illustrative schema, not permission to invent values.

Define enums, required fields, length limits, and validation rules.

Every `evidenceId` must reference a real finding produced by the backend.

Confidence must be evidence-based, not a number invented by the model.

Clearly distinguish a measured finding from an AI-generated hypothesis.

---

# 14. API and Service Architecture

Keep the feature modular.

Use the repository's existing conventions. A conceptual separation could be:

- YouTube OAuth service.
- YouTube connection service.
- YouTube Data API client.
- YouTube Analytics API client.
- Channel data fetcher.
- Analytics normalizer.
- Metric calculation service.
- Retention analysis service.
- Title analysis service.
- Thumbnail analysis service.
- Diagnosis engine.
- DeepInfra AI service.
- Report validation service.

Create appropriate server endpoints or actions for:

- Starting OAuth.
- Handling the OAuth callback.
- Getting connection status.
- Retrieving the connected channel.
- Disconnecting the channel.
- Fetching current channel data.
- Fetching supported analytics.
- Starting a diagnosis.
- Retrieving video details for analysis.

Use the existing backend routing architecture instead of blindly creating these exact routes.

Protect all authenticated endpoints.

Validate request parameters and enforce sensible date ranges, pagination limits, and resource limits.

Do not expose internal access tokens or refresh tokens in any API response.

---

# 15. UI Pages and User Journey

Implement the following complete flow.

## Screen 1: Feature introduction

Title:

**Understand Why Your Channel Isn't Growing**

Supporting text:

"Connect your YouTube channel to identify performance bottlenecks and get practical, evidence-based recommendations."

Primary action:

**Connect YouTube**

Include a short privacy explanation that YouTube audit data is processed on demand and not permanently stored by this feature.

Do not make unverified privacy promises about Google's or DeepInfra's independent data-handling practices.

## Screen 2: Google authorization

Redirect to Google's consent screen.

Handle cancellation, permission denial, callback errors, and successful connection.

## Screen 3: Connected channel

Display the resolved channel identity and available channel information.

Actions:

- Analyze Channel.
- Disconnect YouTube.

## Screen 4: Analysis configuration

Allow the user to select:

- Last 28 days.
- Last 90 days.

Explain that the report uses available channel data and that some metrics may be unavailable.

## Screen 5: Analysis progress

Show meaningful progress states:

- Connecting to YouTube.
- Fetching channel data.
- Loading analytics.
- Comparing video performance.
- Analyzing retention.
- Evaluating titles and thumbnails.
- Generating diagnosis.

Progress must reflect actual backend stages. Do not fake percentage completion.

## Screen 6: Diagnosis dashboard

Display:

- Channel header.
- Key metrics.
- Performance trends.
- Top and underperforming videos.
- Primary bottleneck.
- Secondary bottlenecks.
- Strengths.
- Evidence.
- Prioritized actions.
- Limitations.

## Screen 7: Individual video analysis

Allow users to select a video and view its supported metrics, retention findings, packaging analysis, and recommendations.

## Screen 8: Disconnect confirmation

Explain that disconnecting revokes or removes the application's local authorization as appropriate.

Handle local credential deletion and Google authorization revocation according to the implemented flow. Do not claim that Google's authorization has been revoked unless that operation succeeds.

---

# 16. Design Requirements

The interface must look like a polished analytics product, not a generic AI-generated dashboard.

Design principles:

- Clean and restrained visual language.
- Strong information hierarchy.
- Consistent spacing.
- Readable charts.
- Compact metric cards.
- Clear section headings.
- Useful tooltips.
- Accessible color contrast.
- Keyboard navigation.
- Responsive layouts.
- Clear loading and empty states.
- Good desktop and mobile experiences.

Avoid:

- Excessive gradients.
- Decorative charts with fake data.
- Arbitrary health scores without defined formulas.
- Too many cards competing for attention.
- Repeated AI-generated summaries.
- Unexplained red/green status indicators.
- Unsupported performance percentages.
- Placeholder recommendations presented as real findings.

Use skeletons only during genuine loading states.

For demo mode, if implemented, explicitly label all synthetic data as demo data and never mix it with a real connected channel.

---

# 17. Error Handling and Partial Results

The application must handle:

- User not signed in.
- YouTube not connected.
- OAuth cancellation.
- Invalid or expired credentials.
- Revoked authorization.
- Missing refresh token.
- No accessible channel.
- Unsupported analytics report.
- Missing CTR or retention data.
- Empty channel.
- Insufficient sample size.
- API quota exhaustion.
- Network timeout.
- DeepInfra errors.
- Invalid AI output.
- Missing thumbnail.
- Partial data availability.

Do not fail the whole diagnosis because one optional metric is unavailable.

Display what was successfully analyzed and explain what could not be analyzed.

Never silently substitute fabricated values.

---

# 18. Security and Privacy Requirements

Implement:

- Server-side secrets.
- Encrypted OAuth token storage.
- OAuth state validation.
- CSRF protection.
- User-level authorization.
- Secure session handling.
- Input validation.
- Safe API error handling.
- Log redaction.
- No token exposure to frontend code.
- No permanent audit-data persistence.
- No persistent raw-data caching.
- No unnecessary transcript or image downloads.
- Proper handling of disconnect and revocation.
- Appropriate safeguards for outbound image URLs and any temporary processing resources.

Review how hosting providers, request logs, observability systems, queues, and AI-provider requests may retain data.

Do not claim that the system is fully private solely because audit records are absent from the main database.

---

# 19. Testing Requirements

Write tests appropriate to the existing project.

At minimum, test:

### Authentication

- Unauthenticated requests are rejected.
- OAuth state validation works.
- Callback errors are handled.
- Tokens are never returned to the frontend.
- One user cannot access another user's connection.

### YouTube integration

- Successful API response normalization.
- Empty API results.
- Pagination.
- Unsupported analytics reports.
- Expired access tokens.
- Quota and network errors.

### Diagnosis

- Metrics are calculated correctly.
- Baselines handle small samples.
- Retention points are normalized correctly.
- Missing metrics do not become zero.
- Recommendations reference valid evidence.
- AI output is schema-validated.
- Partial results are preserved.

### Privacy

- Audit data is not inserted into permanent database tables.
- Raw API responses are not logged.
- Temporary processing data is discarded after use.
- Tokens are encrypted and access-controlled.

Use mocked API responses for automated tests. Do not require real Google credentials for the standard test suite.

---

# 20. Environment Configuration

Add a documented environment example consistent with the current project.

Include the appropriate configuration for:

- Google OAuth client ID.
- Google OAuth client secret.
- Registered OAuth redirect URI.
- YouTube Data API key.
- DeepInfra API key.
- DeepInfra model identifier.
- Database connection.
- Token encryption key or key-management configuration.
- Existing application authentication secrets.

Never commit actual credentials.

Validate required configuration on the server and provide actionable setup errors.

Document Google Cloud setup, enabled APIs, OAuth consent configuration, authorized redirect URIs, required scopes, testing users where applicable, and production verification requirements.

Do not claim that OAuth production access is approved until it actually is.

---

# 21. Implementation Workflow

Follow this order.

### Step 1 — Inspect

Inspect the repository and summarize the current architecture.

### Step 2 — Plan

Identify the files, services, database changes, routes, and screens needed.

### Step 3 — Foundation

Implement or integrate authentication, OAuth, secure token persistence, and channel connection.

### Step 4 — Data integration

Implement the YouTube API clients and data normalization.

### Step 5 — Analysis engine

Implement deterministic metrics, video comparisons, retention findings, and evidence generation.

### Step 6 — AI integration

Implement the DeepInfra service and structured report validation.

### Step 7 — UI

Implement the complete connection-to-diagnosis journey using the existing design system.

### Step 8 — Privacy and testing

Verify that audit data is transient and credentials are protected.

### Step 9 — Verification

Run the available test suite, type checks, linting, and production build.

Fix implementation errors rather than merely reporting them.

### Step 10 — Handoff

Provide:

- What was implemented.
- Files created or modified.
- Architecture decisions.
- Required environment variables.
- Google Cloud setup instructions.
- Database migrations.
- Tests performed and their results.
- Remaining blockers.
- Features intentionally deferred to Phase 2.

Do not mark any feature as complete unless it has actually been implemented and verified.

---

# 22. Definition of Done

Phase 1 is complete when:

1. An application user can sign in.
2. The user can connect YouTube through Google OAuth without manually supplying an API key.
3. The application securely stores the necessary OAuth credentials.
4. The application can identify the correct connected channel.
5. The backend can fetch supported YouTube Data API and Analytics API data.
6. The dashboard displays real data without fabricated metrics.
7. The user can select a reporting period and run a fresh analysis.
8. The system can compare video performance against an appropriate baseline.
9. Available retention data is analyzed using deterministic logic.
10. Titles and thumbnails are analyzed using actual available inputs.
11. DeepInfra generates a structured, evidence-grounded diagnosis.
12. The report prioritizes actionable recommendations.
13. Missing data and partial failures are handled transparently.
14. Raw audit and research data are not permanently stored by the feature.
15. OAuth credentials are encrypted and protected.
16. Disconnecting the channel is handled correctly.
17. The UI works on desktop and mobile.
18. Tests, type checks, linting, and the production build pass to the extent supported by the project.
19. Existing video engine functionality remains intact.

**Final instruction:** Begin by inspecting the existing repository. Then implement Phase 1 end to end, respecting the current stack, the privacy requirements, and the scope boundaries. Do not implement Phase 2 or Phase 3 features yet. Prioritize correctness, real data, explainable diagnosis, and a polished user experience over the number of features.
