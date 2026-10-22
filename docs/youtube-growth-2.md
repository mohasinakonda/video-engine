# PHASE 2 — DISCOVER

## YouTube Growth Intelligence Platform

You are a senior full-stack product engineer, product architect, data engineer, and product designer.

We have already completed **Phase 1 — Diagnose** of this application.

Phase 1 currently provides the foundation for:

- User authentication
- Google/YouTube OAuth connection
- Connected YouTube channel
- YouTube Data API integration
- YouTube Analytics API integration
- Channel analytics/audit
- Video-level analysis
- Retention analysis where supported
- Packaging/title/thumbnail analysis
- Evidence-based diagnosis
- DeepInfra AI analysis
- Privacy-first handling of audit data
- Persistent storage of OAuth credentials/connection data only

Now implement:

# PHASE 2 — DISCOVER

The goal of Phase 2 is NOT simply to display competitor statistics.

The goal is:

> Discover what the creator should make next by combining their own channel data, public competitor data, market signals, content gaps, and AI-assisted opportunity analysis.

The final product flow should become:

**Diagnose → Discover → Create → Publish → Learn**

Phase 2 should prepare the system for Phase 3 without implementing Phase 3's video-generation workflow yet.

---

# 1. IMPORTANT: INSPECT THE EXISTING APPLICATION FIRST

Before writing code:

1. Inspect the entire repository.
2. Identify:
   - Framework
   - Routing
   - Authentication
   - Database
   - ORM
   - API architecture
   - Existing YouTube integration
   - OAuth implementation
   - Analytics implementation
   - DeepInfra integration
   - Existing AI service abstraction
   - Design system
   - Existing dashboard components
   - Existing chart components
   - Existing loading/error states
   - Existing state management
   - Existing video engine
   - Existing background/job architecture
   - Existing environment/config handling
   - Existing tests
3. Read the Phase 1 implementation before modifying anything.
4. Reuse existing abstractions wherever possible.
5. Do NOT create duplicate:
   - YouTube clients
   - OAuth clients
   - AI clients
   - API wrappers
   - chart systems
   - authentication systems
   - database models
   - design systems

Do not replace working Phase 1 functionality.

Do not build a separate standalone prototype.

Implement Phase 2 as a natural extension of the existing application.

---

# 2. PHASE 2 PRODUCT OBJECTIVE

The user should be able to answer:

> "What videos should I make next?"

with evidence rather than generic AI suggestions.

Phase 2 should combine:

### First-party data

From the user's connected YouTube channel:

- Channel performance
- Video performance
- Topics/categories inferred from available data
- Format patterns
- Publishing frequency
- Historical outliers
- Audience/analytics information available through YouTube Analytics API
- Phase 1 diagnosis

### Public market data

From YouTube Data API:

- Competitor channels
- Competitor videos
- Search results
- Public view counts
- Likes where publicly available
- Comments where available
- Published dates
- Duration
- Titles
- Channel subscriber count where publicly exposed
- Video/channel metadata
- Public thumbnails

### AI analysis

Using DeepInfra:

- Topic clustering
- Format interpretation
- Content-gap interpretation
- Opportunity explanation
- Recommended angles
- Next-video prioritization

The application must distinguish:

**Observed facts**
vs
**Derived metrics**
vs
**AI interpretation**

Never present AI assumptions as YouTube facts.

---

# 3. COMPETITOR DISCOVERY

Create a Competitor Discovery workflow.

The user should be able to discover relevant YouTube channels without manually researching the internet.

Possible inputs:

- Niche
- Topic
- Keywords
- Existing channel context
- Optional seed channels
- Optional search phrases

Use YouTube Data API public search/discovery capabilities.

Do not require competitors to authenticate with our application.

Competitor OAuth is NOT required.

---

## 3.1 Competitor classification

Classify discovered channels into:

### Direct competitors

Channels targeting substantially the same audience and topic.

### Adjacent competitors

Channels targeting overlapping audiences but different subjects/formats.

### Format competitors

Channels with useful content formats, packaging styles, or storytelling approaches even if the niche differs.

AI may assist with classification, but classification should be explainable.

Example:

```text
Channel A
Type: Direct competitor
Reason:
- Same audience
- Same core topic
- Similar content format
```

Do not expose unsupported certainty.

Use labels such as:

- High relevance
- Medium relevance
- Low relevance

rather than pretending classification is objectively perfect.

---

# 4. COMPETITOR WATCHLIST

Allow users to save selected competitor channels.

Persist ONLY lightweight user preference/configuration such as:

- User ID
- YouTube channel ID
- Competitor channel IDs
- Optional user label
- Date added
- Active/inactive state

Do NOT persist full competitor research snapshots by default.

Competitor metadata should be fetched/refreshed from YouTube when needed, subject to YouTube API policy requirements.

If the product later requires caching for performance, implement an explicit retention policy and verify it against YouTube API terms before doing so.

---

# 5. COMPETITOR CHANNEL OVERVIEW

For each selected competitor, provide an overview using current public data.

Show useful signals such as:

- Channel name
- Channel thumbnail
- Subscriber count if available
- Total/public video information where appropriate
- Recent upload activity
- Recent video performance
- Average/median views for selected recent videos
- Outlier videos
- Publishing frequency
- Common topics
- Common formats

Do NOT use subscriber count as the sole indicator of competitor strength.

A smaller channel with several unusually strong videos may be more strategically useful than a huge channel.

---

# 6. COMPETITOR VIDEO RESEARCH

Build a reusable competitor-video research engine.

For each competitor, analyze a configurable recent video window.

Default:

- Last 30 days
- Last 90 days

Allow the user to switch between windows where API availability permits.

Collect only what is required for analysis.

Useful fields:

- Video ID
- Channel ID
- Title
- Description where needed
- Published timestamp
- Duration
- Public view count
- Public like count where available
- Public comment count where available
- Thumbnail URLs
- Category where available

Do not unnecessarily download or store full video assets.

---

# 7. OUTLIER DETECTION

This is one of the most important parts of Phase 2.

Do NOT simply rank competitor videos by raw views.

A 2M-view video from a 5M-subscriber channel is not necessarily more interesting than a 100K-view video from a 20K-subscriber channel.

Calculate relative performance against the channel's own baseline.

For example:

```text
video_views / competitor_median_recent_views
```

or another statistically defensible relative-performance metric.

Use robust statistics where appropriate.

Avoid misleading ratios when sample sizes are too small.

Each outlier should include:

```text
Observed views
Channel baseline
Relative performance
Sample size
Confidence
```

Example:

```text
Video: X

Views: 182K
Channel recent median: 31K
Relative performance: 5.9×
Sample size: 24 videos
Confidence: High
```

Do not fabricate values.

---

# 8. TOPIC EXTRACTION

Analyze competitor titles and available metadata to identify recurring topics.

Do NOT simply group by individual words.

Example:

Bad:

```text
"car"
"clean"
"vacuum"
```

Better:

```text
Portable car upholstery extraction
Interior deep-cleaning comparisons
Budget detailing equipment
Pet-hair removal
```

Use deterministic preprocessing plus AI-assisted semantic clustering where useful.

The backend should send compact structured data to DeepInfra rather than huge raw datasets.

---

# 9. FORMAT ANALYSIS

Identify recurring content formats.

Examples:

- Product comparison
- Review
- Tutorial
- Before/after
- Experiment
- Challenge
- Myth testing
- List
- Ranking
- Problem/solution
- Explainer
- Case study
- Reaction
- Documentary
- News/update

Do not force every video into a category.

Allow:

- Primary format
- Secondary format
- Confidence

---

# 10. PACKAGING PATTERN ANALYSIS

Analyze competitor titles and thumbnails where legally/technically appropriate.

Identify patterns such as:

### Title mechanisms

- Comparison
- Curiosity
- Strong claim
- Problem
- Transformation
- Number/list
- Question
- Contrarian angle
- "X vs Y"
- "I tested..."
- "Before you buy..."
- "Why..."
- "How..."

### Thumbnail patterns

Only analyze actual thumbnail images if the configured DeepInfra model supports vision/image input.

Never claim visual analysis if a text-only model was used.

Possible visual signals:

- Product prominence
- Human face presence
- Before/after composition
- Object count
- Text presence
- Approximate text density
- Composition
- Subject placement
- Contrast
- Visual simplicity

These are analytical observations, not objective performance guarantees.

Do not generate thumbnails in Phase 2.

---

# 11. CONTENT GAP ENGINE

This is a core feature.

Compare:

### User channel

against

### Competitor ecosystem

Identify:

## Gap Type A — Competitor coverage gap

Competitors are successfully covering a topic that the user's channel has little/no coverage of.

## Gap Type B — Audience/problem gap

A recurring audience problem appears across the market but the user's channel has not adequately addressed it.

## Gap Type C — Format gap

The user covers the topic but not in a format that appears to be working.

## Gap Type D — Packaging gap

The user has relevant content but competitors use stronger packaging mechanisms.

## Gap Type E — Emerging topic

A topic shows recent momentum and has not yet become heavily saturated.

Do not claim a topic is an "untapped niche" simply because our dataset does not contain it.

Use careful language:

- Under-covered in the analyzed sample
- Emerging signal
- Lower observed competition
- Potential opportunity
- Requires validation

---

# 12. USER CHANNEL FIT

Every opportunity must be evaluated against the user's actual channel.

Do not recommend a topic solely because competitors are getting views.

Consider:

- User's existing topics
- Historical successful videos
- Audience alignment
- Existing channel strengths
- Existing formats
- Phase 1 diagnosis
- Production complexity
- Existing video engine capabilities

Example:

```text
Market Demand: High
Competition: Medium
Channel Fit: High
Production Difficulty: Medium
```

---

# 13. OPPORTUNITY SCORING

Build a deterministic opportunity-scoring engine.

Do NOT allow the LLM to invent a score.

The backend should calculate the score from explicit signals.

Potential dimensions:

```text
Channel Fit
Market Momentum
Relative Competitor Performance
Content Gap
Competition
Format Fit
Production Difficulty
Recency
Evidence Confidence
```

Use a transparent weighted scoring model.

Example conceptual output:

```text
Opportunity Score: 87/100

Channel Fit: 92
Momentum: 84
Content Gap: 90
Competition: 61
Production Fit: 88
Evidence Confidence: 82
```

The exact weights should be configurable and documented.

Do not pretend the score is a YouTube metric.

It is an internal decision-support score.

---

# 14. EVIDENCE-FIRST DESIGN

Every recommendation must be traceable to evidence.

Example:

```text
Why this opportunity?

✓ 4 relevant competitor videos significantly exceeded
  their channel's recent baseline.

✓ 3 competitors published similar topics recently.

✓ Your channel has limited coverage of this topic.

✓ The topic matches formats that already perform
  well on your channel.

Confidence: High
```

Each evidence item should identify:

- Source
- Metric
- Time period
- Calculation where relevant

Do not expose internal implementation details unnecessarily.

---

# 15. NEXT VIDEO PLANNER

Create the central Phase 2 experience:

# "What should I make next?"

Return a ranked list of opportunities.

Each opportunity should contain:

```text
Title / Topic
Opportunity Score
Why Now
Channel Fit
Competition
Momentum
Evidence Confidence
Recommended Angle
Suggested Format
Production Difficulty
```

Example:

```text
#1

Topic:
Portable Extractor X vs Y

Opportunity Score:
91

Why now:
Two smaller channels recently produced videos
that significantly outperformed their normal baseline.

Channel fit:
High

Competition:
Medium

Recommended angle:
"Which portable extractor actually removes
embedded dirt from a daily-driven car?"

Suggested format:
Hands-on comparison

Confidence:
High
```

The recommended angle must NOT simply copy a competitor's title.

It must produce an original angle.

---

# 16. AI-ASSISTED OPPORTUNITY INTERPRETATION

Use DeepInfra for:

- Topic interpretation
- Semantic clustering
- Competitor classification
- Format interpretation
- Opportunity explanation
- Original angle generation
- Strategic recommendation

Do NOT use DeepInfra for calculations that can be deterministic.

Backend calculates:

- Median
- Mean
- Ratios
- Outliers
- Scores
- Dates
- Counts
- Performance deltas

AI interprets those facts.

This prevents hallucinated analytics.

---

# 17. DEEPINFRA ARCHITECTURE

Use the existing Phase 1 DeepInfra service.

Do not create a second AI integration.

The API key must remain server-side.

The model must be configurable through environment/configuration.

Use structured JSON responses.

Validate AI output against schemas.

If AI returns malformed data:

1. Retry if appropriate.
2. Otherwise fail gracefully.
3. Never show malformed AI output directly.

Do not send unnecessary user/private information to the model.

Send compact research summaries rather than giant raw API responses.

---

# 18. SEARCH / DISCOVERY API QUOTA

YouTube API quota is important.

Design discovery carefully.

Avoid uncontrolled:

```text
search → channels → videos → comments → thumbnails
```

for hundreds of channels.

Implement:

- Pagination
- Configurable limits
- Deduplication
- Request budgeting
- Graceful quota errors
- Retry only where appropriate
- Clear user-facing errors

Never silently burn huge amounts of quota.

Show meaningful status such as:

```text
Researching 8 channels...
Analyzing 124 videos...
```

Do not fake progress.

---

# 19. DATA RETENTION / PRIVACY

Maintain Phase 1's privacy-first architecture.

By default, DO NOT permanently store:

- Raw competitor video metadata
- Raw competitor channel metadata
- Search results
- Analytics research snapshots
- Thumbnail files
- Transcripts
- AI prompts
- AI raw responses
- Generated reports
- Temporary analysis datasets

Research should be fetched and processed on demand.

Persist only user-owned configuration such as:

- Selected competitor channel IDs
- User labels
- Preferences
- Discovery settings
- Opportunity preferences if needed

Be careful with:

- Server logs
- Error tracking
- Request logging
- AI provider logs
- Temporary files
- Browser caches

Do not accidentally persist raw research data through logging.

Before production, review applicable YouTube API data-storage and deletion requirements.

---

# 20. UI / UX

Use the existing application design system.

Do NOT create a completely different visual language.

Phase 2 should feel like a natural continuation of Phase 1.

Add a new main navigation item:

**Discover**

Possible structure:

```text
Discover

[ Overview ]
[ Competitors ]
[ Content Gaps ]
[ Opportunities ]
[ Next Video ]
```

---

# 21. DISCOVER OVERVIEW

The overview should answer:

> "What's happening in my market?"

Include:

### Market Signals

- Emerging topics
- Strong competitor outliers
- Popular formats
- Recent changes

### Content Gaps

- High-value gaps
- Under-covered topics
- Format opportunities

### Recommended Next Videos

Top 3–5 opportunities.

---

# 22. COMPETITOR UI

Create a competitor management screen.

Example:

```text
Competitors

[ + Add Competitor ]

Direct
────────────────────
Channel A
High relevance
Recent performance...

Channel B
High relevance
Recent performance...

Adjacent
────────────────────
Channel C
Medium relevance
...
```

Allow:

- Add
- Remove
- Refresh research
- View competitor
- Compare competitors

Do not require users to authenticate competitor channels.

---

# 23. CONTENT GAP UI

Display opportunities as cards/table.

Example:

```text
Content Gap

Portable extractor comparison

Gap strength: High
Market momentum: High
Competition: Medium
Channel fit: High

Why:
4 competitors recently covered related topics,
while your channel has limited coverage.

[View Evidence]
[Analyze Opportunity]
```

---

# 24. OPPORTUNITY DETAIL PAGE

Create a detailed page for each opportunity.

Sections:

### Overview

What the opportunity is.

### Evidence

Why the system believes it exists.

### Market

Relevant competitor signals.

### Your Channel

Relevant first-party evidence.

### Gap

What appears missing.

### Recommended Angle

An original content direction.

### Format

Recommended video format.

### Difficulty

Estimated production complexity.

### Confidence

How strong the evidence is.

CTA:

**Create Video Brief**

This CTA should prepare the architecture for Phase 3.

For now, it may route to a placeholder/Phase 3-ready state, but do not implement the full video creation pipeline yet.

---

# 25. COMPARISON VIEW

Allow users to compare selected competitors.

Example:

```text
                    You      Competitor A   Competitor B

Upload frequency    ...
Median views        ...
Outlier rate        ...
Common formats      ...
Topic clusters      ...
```

Avoid vanity metrics.

Focus on insights useful for content decisions.

---

# 26. LOADING STATES

Research may take time.

Build real progress states.

Example:

```text
Finding relevant channels
        ✓

Collecting recent videos
        ✓

Analyzing competitor performance
        ●

Finding content gaps
        ○

Generating opportunities
        ○
```

Progress must reflect actual backend stages.

Do not create fake percentage counters.

---

# 27. ERROR HANDLING

Handle:

- YouTube quota exceeded
- Invalid channel
- Private/deleted channel
- Missing public metadata
- API timeout
- OAuth expiration
- DeepInfra failure
- AI schema validation failure
- No competitors found
- Insufficient data
- Too-small sample size

Errors should be actionable.

Example:

Instead of:

```text
Something went wrong
```

Use:

```text
We couldn't complete competitor research because
YouTube API quota is currently unavailable.

Try again later or reduce the research scope.
```

---

# 28. SMALL DATASETS

Do not make strong recommendations when there is insufficient evidence.

For example:

If competitor has only 3 recent videos:

```text
Insufficient sample size
```

rather than:

```text
This is their typical performance.
```

Confidence should decrease automatically with small samples.

---

# 29. NO FAKE DATA

This requirement is strict.

Do NOT:

- Create fake competitor channels
- Generate placeholder analytics that look real
- Invent views
- Invent search demand
- Invent trends
- Invent API responses
- Pretend AI saw an image it did not receive
- Pretend a recommendation is statistically proven when evidence is weak

Development fixtures must be clearly isolated from production.

---

# 30. API DESIGN

Follow the existing API architecture.

Conceptually the backend may need endpoints/services such as:

```text
GET  /api/discover/competitors
POST /api/discover/competitors
DELETE /api/discover/competitors/:channelId

POST /api/discover/research
GET  /api/discover/opportunities

GET  /api/discover/gaps
GET  /api/discover/competitors/:channelId

POST /api/discover/opportunities/:id/analyze
```

Do NOT blindly create these exact routes.

Adapt them to the existing application's conventions.

---

# 31. DOMAIN SERVICE ARCHITECTURE

Keep responsibilities separated.

Recommended conceptual services:

```text
YouTubePublicResearchService
CompetitorDiscoveryService
CompetitorAnalysisService
TopicClusteringService
OutlierDetectionService
ContentGapService
OpportunityScoringService
OpportunityAIService
NextVideoPlannerService
```

Reuse Phase 1 YouTube and AI infrastructure.

Do not duplicate provider clients.

---

# 32. RESEARCH PIPELINE

The pipeline should conceptually work like:

```text
User Request
     ↓
Validate Scope
     ↓
Discover Competitors
     ↓
Collect Public Metadata
     ↓
Normalize Data
     ↓
Calculate Baselines
     ↓
Detect Outliers
     ↓
Extract Topics
     ↓
Analyze Formats
     ↓
Compare With User Channel
     ↓
Find Gaps
     ↓
Calculate Opportunity Scores
     ↓
DeepInfra Interpretation
     ↓
Rank Opportunities
     ↓
Return Evidence-backed Results
```

Raw intermediate data should remain ephemeral.

---

# 33. TOPIC NORMALIZATION

Normalize similar topics.

For example:

```text
"Best car vacuum"
"Best vacuum for car"
"Top car vacuums"
```

should potentially belong to the same semantic topic cluster.

But do not over-cluster unrelated content.

Use deterministic normalization + AI semantic interpretation.

---

# 34. MOMENTUM

Do not define momentum simply as:

```text
Most views
```

Consider:

- Recent publication
- Relative performance
- Frequency of related uploads
- Multiple channels covering the topic
- Recent outliers

Distinguish:

### Durable demand

Long-running topic interest.

### Recent momentum

Topic showing recent activity.

### One-off spike

Single unusual video.

These should not receive identical treatment.

---

# 35. COMPETITION ESTIMATION

Competition is an internal analytical estimate.

Possible signals:

- Number of relevant recent videos
- Number of relevant channels
- Strength of established competitors
- Recent upload frequency
- Relative outlier density

Use labels:

- Low
- Medium
- High

Explain why.

Do not claim exact YouTube competition numbers unless YouTube provides such a metric.

---

# 36. OPPORTUNITY CONFIDENCE

Every opportunity should have:

```text
High
Medium
Low
```

Confidence should depend on:

- Sample size
- Data completeness
- Strength of observed signal
- Agreement between multiple signals
- Recency
- Reliability of classification

This is separate from Opportunity Score.

---

# 37. ORIGINALITY SAFEGUARD

The system should NEVER simply copy competitor titles.

Bad:

Competitor:
"Best Portable Carpet Cleaner 2026"

Our output:
"Best Portable Carpet Cleaner 2026"

Good:

Competitor evidence:
Portable cleaners are generating strong relative performance.

Our recommendation:
"Which Portable Extractor Actually Removes Deep Car Dirt?"

The system should use competitor evidence to discover opportunities, not reproduce content.

---

# 38. PHASE 1 INTEGRATION

Use Phase 1 diagnosis as a direct input.

Examples:

If Phase 1 finds:

```text
Strong topic fit
Weak packaging
Strong retention
```

Phase 2 should prioritize opportunities where:

- topic fits the channel
- packaging can be improved

If Phase 1 finds:

```text
Weak retention
```

do not blindly recommend more videos.

Opportunity recommendations should consider whether the format matches the channel's current strengths.

---

# 39. PREPARATION FOR PHASE 3

Do not build the complete Phase 3 system yet.

But define a clean Opportunity object that can later become:

```text
Opportunity
      ↓
Video Brief
      ↓
Script
      ↓
Scene Plan
      ↓
Existing Video Engine
      ↓
Thumbnail / Packaging
      ↓
Publish
```

The opportunity should contain enough structured information for Phase 3 to consume later.

Possible fields:

```text
topic
problem
audience
recommendedAngle
recommendedFormat
evidence
competitorSignals
contentGap
channelFit
opportunityScore
confidence
productionDifficulty
```

Do not store unnecessary raw research.

---

# 40. TESTING

Add tests for:

### Competitor discovery

- Valid search
- Pagination
- Deduplication
- Relevance filtering

### Outlier detection

- Normal dataset
- Small sample
- Extreme outlier
- Missing values

### Topic clustering

- Similar topics
- Unrelated topics
- Empty data

### Opportunity scoring

- Expected weighting
- Missing signals
- Confidence calculation

### Content gaps

- User covered topic
- User missing topic
- Competitor-only topic
- Insufficient evidence

### API

- Authentication
- Authorization
- Quota failure
- Provider failure

### Privacy

- Research data is not persisted unintentionally
- User competitor preferences are scoped to the correct user
- Logs do not contain sensitive/raw research payloads

### AI

- Valid structured output
- Invalid JSON
- Missing fields
- Hallucinated unsupported fields

---

# 41. SECURITY

Maintain Phase 1 security standards.

Ensure:

- All Discover routes require authentication.
- Users can only access their own saved competitor configuration.
- OAuth tokens never reach the browser unnecessarily.
- YouTube API credentials remain server-side.
- DeepInfra API key remains server-side.
- Validate all external API responses.
- Validate user input.
- Protect against arbitrary channel/query abuse.
- Rate-limit expensive research operations if the existing application supports rate limiting.
- Do not expose internal provider errors containing secrets.

---

# 42. PERFORMANCE

Avoid making every page load trigger a complete market research operation.

Use explicit research actions such as:

**Run Research**

rather than silently consuming API quota.

Where appropriate:

- parallelize independent requests
- paginate
- limit result counts
- deduplicate requests
- reuse in-memory request context during a single research run
- abort/cancel expensive operations when supported

Do not introduce persistent research caching unless there is a clear product need and YouTube policy requirements have been reviewed.

---

# 43. BILLING / FUTURE READINESS

Do not implement billing in Phase 2 unless the existing application already requires it.

But structure expensive operations so future plans can enforce limits.

Potential future usage dimensions:

```text
Competitor research runs
Videos analyzed
Opportunity analyses
AI analysis calls
```

Do not hardcode business pricing into the research engine.

---

# 44. DESIGN PRINCIPLES

The UI should feel:

- Professional
- Data-driven
- Calm
- Premium
- Fast
- Trustworthy

Avoid:

- Excessive gradients
- Generic AI dashboard aesthetics
- Huge unnecessary cards
- Fake-looking charts
- Excessive animations
- AI-generated-looking visual noise
- Overuse of "AI" labels

The user should feel:

> "This is a serious YouTube growth research tool."

not:

> "This is a chatbot wrapped in a dashboard."

---

# 45. PRODUCT LANGUAGE

Prefer:

- Opportunity
- Evidence
- Market signal
- Content gap
- Channel fit
- Momentum
- Confidence
- Recommended angle

Avoid exaggerated language such as:

- Guaranteed viral
- Viral score
- Guaranteed views
- Secret hack
- Algorithm exploit
- 100% winning topic

The product is a decision-support system, not a prediction oracle.

---

# 46. IMPLEMENTATION WORKFLOW

Follow this sequence:

## STEP 1

Inspect repository and Phase 1.

## STEP 2

Produce an implementation plan based on the actual architecture.

## STEP 3

Identify reusable Phase 1 services.

## STEP 4

Implement competitor discovery.

## STEP 5

Implement competitor watchlist/preferences.

## STEP 6

Implement public competitor research.

## STEP 7

Implement normalization and outlier analysis.

## STEP 8

Implement topic/format analysis.

## STEP 9

Implement content-gap engine.

## STEP 10

Implement deterministic opportunity scoring.

## STEP 11

Implement DeepInfra interpretation.

## STEP 12

Implement Next Video Planner.

## STEP 13

Implement Discover UI.

## STEP 14

Implement Opportunity Detail.

## STEP 15

Integrate Phase 1 diagnosis.

## STEP 16

Add tests.

## STEP 17

Review privacy, API quota, and security.

## STEP 18

Run lint/typecheck/tests/build.

---

# 47. IMPORTANT IMPLEMENTATION RULE

Do NOT immediately start generating dozens of files.

First inspect the repository and explain:

1. Current architecture
2. Relevant Phase 1 modules
3. Existing YouTube services
4. Existing AI services
5. Existing DB schema
6. Existing routing
7. Existing dashboard structure
8. What must be added
9. What can be reused
10. Any architectural risks

Then implement incrementally.

Do not ask me unnecessary questions if the repository already contains the answer.

Only ask if a decision genuinely cannot be determined from the codebase.

---

# 48. DEFINITION OF DONE

Phase 2 is complete when:

### Competitors

- Users can discover relevant competitors.
- Users can save/remove competitors.
- Competitor research uses public YouTube data.
- Competitor OAuth is not required.

### Research

- Recent competitor videos can be analyzed.
- Relative performance/outliers are detected.
- Topics and formats are identified.
- Public packaging signals can be analyzed when technically supported.

### Gaps

- User channel is compared against competitor ecosystem.
- Meaningful content gaps are identified.
- Weak evidence is clearly labeled.

### Opportunities

- Opportunities have deterministic scores.
- Scores are explainable.
- Confidence is separate from score.
- Recommendations are evidence-backed.
- Recommended angles are original rather than copied.

### AI

- DeepInfra is used for interpretation, not basic arithmetic.
- Structured outputs are validated.
- No unsupported claims are presented as facts.

### Privacy

- Raw research data is not permanently stored by default.
- User competitor configuration is stored safely.
- Logs do not accidentally persist raw research payloads.

### UX

- Discover dashboard works.
- Competitor management works.
- Content gaps work.
- Opportunity detail works.
- Next Video Planner works.
- Loading/error/empty states are polished.

### Integration

- Phase 1 remains functional.
- Phase 1 diagnosis influences recommendations.
- Phase 3 can consume structured opportunity objects later.

### Quality

- Tests pass.
- Typecheck passes.
- Lint passes.
- Production build passes.
- No fake production data.
- No duplicated YouTube/AI infrastructure.

---

# FINAL PRODUCT PRINCIPLE

The central question Phase 2 must answer is:

> "Given what is working in my channel and what is happening in my market, what is the strongest evidence-backed opportunity for my next video?"

Everything in Phase 2 should serve that question.

Do not build a generic competitor analytics dashboard.

Build a **YouTube Opportunity Discovery Engine** that turns:

**My Channel + Competitors + Market Signals + Content Gaps + Phase 1 Diagnosis**

into:

**Evidence → Opportunity → Original Angle → Next Video Recommendation**

while preserving the architecture and privacy principles established in Phase 1.
