# PHASE 3 — EXECUTE & LEARN

## YouTube Growth Intelligence + AI Video Production

You are a senior full-stack engineer, AI product architect, data engineer, and product designer.

We have already completed:

- Phase 1 — Diagnose
- Phase 2 — Discover

The application now has:

### Phase 1

- User authentication
- Google/YouTube OAuth
- Connected YouTube channel
- YouTube Data API
- YouTube Analytics API
- Channel audit
- Video analysis
- Retention analysis where supported
- Title/thumbnail analysis
- Evidence-based diagnosis
- DeepInfra integration
- Privacy-first research handling

### Phase 2

- Competitor discovery
- Competitor watchlist
- Public competitor research
- Competitor video analysis
- Outlier detection
- Topic clustering
- Format analysis
- Content-gap analysis
- Opportunity scoring
- Opportunity ranking
- Next Video Planner
- Evidence-backed opportunity recommendations

The existing application also contains an AI/video-generation engine.

Phase 3 must connect these systems into one complete workflow:

# Diagnose → Discover → Create → Package → Publish → Measure → Learn

The goal is NOT to build another generic AI video generator.

The goal is to build a system where YouTube intelligence directly influences video creation, and real published-video performance feeds back into the intelligence system.

---

# 1. INSPECT THE EXISTING REPOSITORY FIRST

Before changing code:

Inspect:

- Phase 1 implementation
- Phase 2 implementation
- Existing video-generation engine
- Existing Remotion architecture
- React components
- TypeScript types
- Script generation
- Scene generation
- Asset management
- Timeline generation
- Rendering pipeline
- Project/document structure
- Existing AI services
- DeepInfra integration
- YouTube integration
- Authentication
- Database
- Background jobs
- Storage
- Existing packaging/thumbnail functionality
- Existing export functionality

Do NOT create a parallel video-generation system.

Reuse the existing engine.

Do NOT rewrite Phase 1 or Phase 2.

---

# 2. CORE PRODUCT LOOP

The final product should work like this:

```text
PHASE 1
Diagnose
   ↓
PHASE 2
Discover
   ↓
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
Render
   ↓
Packaging
   ↓
Publish
   ↓
Connect Published Video
   ↓
Performance Tracking
   ↓
Learning Analysis
   ↓
Phase 1 + Phase 2
```

Every stage should preserve structured information so the next stage can consume it.

---

# 3. OPPORTUNITY → VIDEO BRIEF

The first Phase 3 feature is:

## Create Video Brief

When the user selects an opportunity from Phase 2, provide:

**Create Video Brief**

The system should transform the opportunity into a structured Video Brief.

---

## 3.1 Video Brief structure

Conceptually:

```text
VideoBrief

id
userId
opportunityId

topic
audience
problem
intent

corePromise
recommendedAngle
recommendedFormat

keyPoints
supportingEvidence

competitorInsights
contentGap

recommendedStructure

titleDirections
thumbnailDirection

productionDifficulty

confidence

createdAt
```

Do NOT copy raw competitor research into the brief unnecessarily.

The brief should contain the useful conclusions/evidence references needed for production.

---

# 4. VIDEO BRIEF UI

Create a polished Video Brief screen.

Example:

```text
Create Video Brief

Topic
Portable Extractor Comparison

Audience
Car owners who want to deep-clean vehicle interiors

Core Promise
Find out which portable extractor actually performs
better on real car interiors.

Recommended Angle
Hands-on comparison rather than generic specification review.

Format
Test / Comparison

Why this opportunity exists
• Strong relative performance across competitors
• Medium competition
• High channel fit
• Existing audience interest

Key questions
1. Which machine removes embedded dirt?
2. Which is easier to use?
3. Which gives better value?

Production difficulty
Medium

Confidence
High

[ Generate Script ]
```

The user should be able to edit the brief before generating the script.

---

# 5. HUMAN CONTROL

Do NOT make the workflow completely automatic.

The user must be able to edit:

- Topic
- Audience
- Core promise
- Angle
- Format
- Key points
- Structure
- Title direction
- Thumbnail direction

The AI should assist, not silently make irreversible decisions.

---

# 6. SCRIPT GENERATION

Create a structured script-generation workflow.

Input:

```text
Video Brief
+
Phase 1 channel insights
+
Phase 2 opportunity evidence
+
User edits
```

Output:

```text
Script
```

The script should have structured sections/scenes rather than being only a large text blob.

Conceptually:

```text
Script
 ├── Hook
 ├── Context
 ├── Main Section 1
 ├── Main Section 2
 ├── Main Section 3
 ├── Conclusion
 └── CTA
```

Do not force every video into this exact structure.

The structure should depend on the selected format.

---

# 7. SCRIPT QUALITY

The system should optimize for:

- Clear hook
- Strong viewer promise
- Fast context
- Logical progression
- No unnecessary repetition
- Natural narration
- Evidence-backed claims
- Appropriate pacing
- Strong payoff
- Natural conclusion

Avoid:

- Generic AI language
- Repetitive transitions
- Excessive headings
- Fake excitement
- Unsupported claims
- Keyword stuffing
- Robotic phrasing

---

# 8. SCRIPT FACTUALITY

This is important.

The AI must distinguish:

### Evidence

Verified data from YouTube/API/user-provided information.

### Research

External/public information available to the application's research pipeline.

### Creative suggestion

AI-generated wording or framing.

Do not turn speculation into fact.

If factual claims require external research, the system should identify them as research requirements instead of inventing information.

---

# 9. SCRIPT → SCENE PLAN

After script approval:

Create:

# Scene Planner

The system should break the narration into visual scenes.

Conceptually:

```text
Scene 01
Narration:
"..."

Duration:
5.4s

Visual Goal:
Establish the problem

Visual Type:
Product footage

Asset Requirement:
Portable extractor in car interior

Motion:
Slow push-in

Text:
Optional lower-third

SFX:
Vacuum sound

Transition:
Cut
```

---

# 10. SCENE TYPES

Support the existing engine's capabilities.

Potential types:

- Video
- Image
- Image sequence
- Product shot
- Background video
- Text
- Statistic
- Comparison
- Timeline
- Map
- Diagram
- Screenshot
- Quote
- Lower third
- Before/after
- Chart
- Blank/transition

Do NOT add scene types that the existing renderer cannot actually support.

---

# 11. VISUAL INTENT VS ASSET

Keep these separate.

Example:

```text
Visual Intent:
Show dirt extraction from a car seat.

Asset Requirement:
Close-up footage of dirty fabric being extracted.
```

The AI should not assume an asset already exists.

This distinction will be important for future asset-search automation.

---

# 12. ASSET PLANNING

Create an asset requirement layer.

For each scene:

```text
AssetRequirement

type
description
keywords
preferredSource
duration
aspectRatio
usage
status
```

Possible sources:

- User upload
- Existing project asset
- Stock API
- Generated image
- Generated vector
- Screenshot
- Product image
- Placeholder

The architecture must support future stock APIs.

Do not implement every external asset provider in Phase 3 unless already available.

---

# 13. USER ASSET CONTROL

Users should be able to review scene requirements.

Example:

```text
Scene 04

Needed:
"Close-up of portable extractor removing dirty water"

[ Find Asset ]
[ Upload ]
[ Generate Visual ]
[ Skip ]
```

Do not automatically generate expensive assets without user control.

---

# 14. EXISTING VIDEO ENGINE INTEGRATION

This is critical.

Do NOT build another renderer.

Convert the approved scene plan into the existing engine's project representation.

Conceptually:

```text
VideoBrief
    ↓
Script
    ↓
ScenePlan
    ↓
Existing Project Model
    ↓
Existing Remotion Components
    ↓
Render
```

Reuse:

- Existing components
- Existing timeline
- Existing animation system
- Existing asset system
- Existing rendering system

---

# 15. REMOTION INTEGRATION

If the existing engine uses Remotion:

The integration must produce valid Remotion project/timeline data.

Do not allow AI-generated arbitrary React/Remotion code to execute directly.

Prefer structured data:

```text
{
  type: "image",
  src: "...",
  startFrame: 120,
  durationInFrames: 150,
  animation: "slowZoom"
}
```

Then deterministic renderer components interpret that data.

This is safer and more reliable than letting an LLM write arbitrary rendering code.

---

# 16. TIMING

Scene duration should be derived from:

- Narration duration
- Target pacing
- Scene importance
- Visual complexity

Do not randomly assign durations.

If TTS is available:

```text
Narration
   ↓
Actual audio duration
   ↓
Scene timing
```

Use actual audio duration whenever available.

---

# 17. AUDIO

Reuse the existing audio/TTS architecture.

Support:

- Voice selection
- Voice generation
- Audio preview
- Regeneration
- Scene-level or paragraph-level audio
- Background music
- SFX

Do not lock the product to one TTS provider.

Use the existing provider abstraction.

---

# 18. SCRIPT / AUDIO / VISUAL SYNCHRONIZATION

The pipeline should support:

```text
Script
 ↓
TTS
 ↓
Actual audio duration
 ↓
Scene timing
 ↓
Visual timeline
 ↓
Render
```

If narration changes:

The system should be able to regenerate affected timing instead of manually recalculating everything.

---

# 19. VIDEO EDITOR / REVIEW

Before final render, provide a review state.

The user should be able to see:

- Script
- Scene list
- Visual requirements
- Assets
- Narration
- Timeline
- Estimated duration

Allow:

- Edit scene
- Replace asset
- Regenerate narration
- Reorder scenes where safe
- Regenerate scene plan
- Preview

---

# 20. RENDERING

Reuse the existing rendering infrastructure.

Support:

- Preview render
- Final render
- Render progress
- Error state
- Retry
- Cancellation if existing infrastructure supports it

Do not fake render progress.

---

# 21. PACKAGING STUDIO

After the video is ready, create a packaging workflow.

Generate multiple:

## Title concepts

Each should have:

- Title
- Mechanism
- Intended audience
- Risk
- Rationale

Do not call them "viral titles."

---

# 22. THUMBNAIL CONCEPTS

Create thumbnail concepts based on:

- Video topic
- Recommended angle
- Audience
- Existing channel packaging patterns
- Competitor packaging evidence

Each concept should define:

```text
Main subject
Supporting object
Composition
Emotion/action if applicable
Background
Text if needed
Visual contrast
Information hierarchy
```

Do NOT automatically generate low-quality AI thumbnails just to fill a gallery.

If image generation is available, integrate through an existing abstraction.

If not, provide a clear visual brief that can be executed manually.

---

# 23. PACKAGING COMPARISON

Allow the user to compare title/thumbnail concepts.

Example:

```text
Concept A
Title: ...
Thumbnail: ...
Mechanism: Curiosity

Concept B
Title: ...
Thumbnail: ...
Mechanism: Comparison

Concept C
Title: ...
Thumbnail: ...
Mechanism: Strong claim
```

User selects one.

---

# 24. PUBLISHING

Do NOT automatically publish videos without explicit user action.

Create:

# Publish

Possible flow:

```text
Video
 ↓
Packaging selected
 ↓
Metadata review
 ↓
Publish settings
 ↓
User confirms
 ↓
YouTube upload
```

If YouTube upload integration already exists, reuse it.

If not, build the architecture so it can be added cleanly.

---

# 25. YOUTUBE UPLOAD

If implementing YouTube upload:

Use the authenticated user's OAuth connection.

Support:

- Title
- Description
- Tags if appropriate
- Thumbnail
- Privacy status
- Scheduled publishing where supported
- Playlist where supported

Never upload automatically without explicit user confirmation.

---

# 26. PUBLISHED VIDEO LINKING

After publishing, create a persistent lightweight record:

```text
PublishedVideo

id
userId
youtubeVideoId
projectId
opportunityId
videoBriefId

publishedAt

status
```

This is not the same as permanently storing raw YouTube analytics.

It is the relationship between the user's project and their YouTube video.

---

# 27. PERFORMANCE TRACKING

After publishing, allow:

# Track Performance

Use YouTube Analytics API and Data API as appropriate.

Track supported metrics such as:

- Views
- Watch time
- Average view duration
- Retention-related metrics where available
- Impressions
- CTR where available
- Subscribers gained
- Traffic sources where available

Do not assume every metric is available for every video/account/report.

---

# 28. PERFORMANCE WINDOWS

Analyze performance at meaningful ages.

Potential checkpoints:

```text
6 hours
24 hours
48 hours
7 days
28 days
```

These should be configurable.

Do not permanently store every raw API response.

Fetch current data when analysis is requested, subject to API policies and practical constraints.

---

# 29. BASELINE COMPARISON

Never judge a video using raw views alone.

Compare against:

### Channel baseline

Comparable videos at similar publication age.

Example:

```text
This video:
24h views = 18,400

Comparable channel median:
24h views = 7,200

Relative performance:
2.56×
```

Use robust statistics and adequate sample sizes.

---

# 30. OPPORTUNITY THESIS TEST

This is one of the most important Phase 3 features.

Every generated video originated from a Phase 2 opportunity.

After publishing, test:

> Was the original opportunity thesis correct?

Example:

```text
Original hypothesis:

High channel fit
Medium competition
Strong market momentum
Strong competitor outliers
```

After 7 days:

```text
Observed:

Views: Above baseline
CTR: Above baseline
Retention: Below baseline

Conclusion:

Topic/market opportunity appears valid.

Packaging performed well.

Viewer retention became the main weakness.
```

This is much more useful than simply saying:

> "Your video got 20K views."

---

# 31. FAILURE DIAGNOSIS

If performance is weak, classify the likely bottleneck.

Possible categories:

### Discovery problem

The topic did not attract enough impressions.

### Packaging problem

Impressions existed but CTR was weak.

### Retention problem

CTR was healthy but viewers left early.

### Content-market mismatch

Topic appeared promising but did not perform with the user's audience.

### Execution problem

Topic and packaging were reasonable, but the content underperformed.

### Insufficient data

Not enough time/data to conclude.

Reuse Phase 1 diagnosis logic where possible.

Do not create conflicting diagnosis systems.

---

# 32. LEARNING ENGINE

The system should learn from actual outcomes.

Do NOT blindly rewrite the scoring algorithm after one video.

Use accumulated evidence.

For each completed video, record lightweight learning information such as:

```text
Opportunity category
Recommended format
Selected angle
Selected title mechanism
Selected thumbnail mechanism

Observed outcome
Relative performance
CTR outcome
Retention outcome

Diagnosis
Confidence
```

This can be stored as derived learning metadata, while avoiding unnecessary raw YouTube data retention.

---

# 33. PERSONALIZED OPPORTUNITY LEARNING

Over time, the system should discover:

```text
This channel tends to perform well when:

- Topic = X
- Format = Y
- Packaging = Z
```

and:

```text
This channel tends to underperform when:

- Format = A
- Topic = B
```

These should become evidence for future Phase 2 opportunity scoring.

Do not turn a small number of observations into permanent rules.

---

# 34. FEEDBACK LOOP

The final architecture should become:

```text
Channel Data
     ↓
Diagnosis
     ↓
Market Research
     ↓
Opportunity
     ↓
Video
     ↓
Publish
     ↓
Performance
     ↓
Outcome
     ↓
Learning
     ↓
Improved Opportunity Ranking
```

This is the core moat of the product.

---

# 35. LEARNING DASHBOARD

Create a simple dashboard showing:

## What is working?

Examples:

```text
Topics
• Comparison videos
• Product testing
• Problem/solution

Formats
• Hands-on tests

Packaging
• Curiosity + clear outcome
```

## What is not working?

```text
• Generic reviews
• Long intros
• Weak thumbnail clarity
```

These insights must be evidence-backed.

---

# 36. VIDEO LIBRARY

Create a project/video history view.

Example:

```text
My Videos

Draft
In Production
Rendered
Published
Analyzing
Completed
```

Each project should show:

- Topic
- Status
- Opportunity
- Published state
- Performance
- Latest diagnosis

This becomes the bridge between the AI video engine and YouTube intelligence.

---

# 37. PROJECT STATE MACHINE

Use explicit states.

Conceptually:

```text
DRAFT
 ↓
BRIEF_READY
 ↓
SCRIPT_READY
 ↓
SCENE_PLAN_READY
 ↓
IN_PRODUCTION
 ↓
RENDERED
 ↓
PACKAGED
 ↓
READY_TO_PUBLISH
 ↓
PUBLISHED
 ↓
ANALYZING
 ↓
LEARNED
```

Allow safe transitions and error states.

Do not allow invalid state transitions.

---

# 38. RECOVERY

Long-running operations must be recoverable.

Examples:

- TTS failure
- Scene generation failure
- Asset generation failure
- Render failure
- YouTube upload failure
- Analytics API failure

The user should be able to retry the failed step rather than restarting the entire project.

---

# 39. AI ARCHITECTURE

Reuse existing DeepInfra abstraction.

Separate AI tasks:

```text
BriefInterpreter
ScriptGenerator
ScenePlanner
PackagingGenerator
PerformanceInterpreter
LearningInterpreter
```

Do not create one giant prompt that performs the entire workflow.

Each task should have:

- Structured input
- Structured output
- Validation
- Retry strategy
- Clear failure state

---

# 40. DETERMINISTIC VS AI RESPONSIBILITIES

AI should handle:

- Interpretation
- Writing
- Semantic clustering
- Creative ideation
- Scene intent
- Packaging ideas
- Performance explanation

Deterministic code should handle:

- Metrics
- Calculations
- Timing
- State transitions
- API requests
- Authentication
- Permissions
- Render configuration
- Score calculations
- Baselines
- Validation

Do not let AI determine facts that the backend can calculate reliably.

---

# 41. DATA PRIVACY

Continue Phase 1/2 privacy principles.

Persist only what is necessary.

Reasonable persistent data:

- User
- OAuth credentials
- Video project
- Video brief
- User-selected creative decisions
- Published video relationship
- Derived learning metadata
- Preferences

Avoid unnecessarily persisting:

- Raw competitor datasets
- Raw analytics responses
- Raw transcripts
- Temporary AI prompts
- Raw DeepInfra responses
- Temporary thumbnails/assets unless they belong to the user's project
- Redundant YouTube metadata snapshots

Review YouTube API data-storage requirements before production.

---

# 42. LOGGING

Never log:

- OAuth tokens
- API keys
- Full analytics payloads
- Full competitor datasets
- Sensitive user information
- Full AI prompts if they contain private project content

Use structured operational logs.

Example:

```text
video_project_id
operation
status
duration
error_code
```

instead of raw payloads.

---

# 43. SECURITY

All project endpoints must be user-scoped.

A user must never be able to access another user's:

- Video projects
- Scripts
- Assets
- OAuth connections
- Published-video records
- Learning data

Validate ownership server-side.

Never rely on frontend IDs for authorization.

---

# 44. COST CONTROL

AI video production can become expensive.

Add cost awareness.

Track operation-level estimates where possible:

- TTS
- Image generation
- AI analysis
- Video rendering

Do not make expensive regeneration happen automatically.

Provide user-visible actions such as:

```text
Regenerate scene
Regenerate voice
Regenerate image
Regenerate script
```

rather than automatically rerunning everything.

---

# 45. UI DESIGN

Maintain the visual language from Phase 1 and Phase 2.

The production workflow should feel like one coherent product.

Avoid:

- Generic AI SaaS aesthetics
- Excessive gradients
- Excessive cards
- Unnecessary animations
- Chatbot-first interfaces

Prioritize:

- Clear workflow
- Timeline visibility
- Evidence
- Preview
- User control
- Fast iteration

---

# 46. MAIN NAVIGATION

The final application can conceptually have:

```text
Dashboard
Diagnose
Discover
Projects
Published
Learn
Settings
```

Do not duplicate pages if equivalent functionality already exists.

---

# 47. DASHBOARD

The main dashboard should eventually summarize:

```text
Channel Health
     ↓
Current Opportunities
     ↓
Projects In Production
     ↓
Published Videos
     ↓
Recent Performance
     ↓
What We Learned
```

This should become the central control center.

---

# 48. "CREATE VIDEO" ENTRY POINTS

Allow video creation from:

### Discover

```text
Opportunity
→ Create Video Brief
```

### Projects

```text
New Project
→ Choose Opportunity / Start Manually
```

### Dashboard

```text
Recommended Opportunity
→ Create Video
```

Do not force every project to originate from Discover.

Manual creation should remain possible.

---

# 49. MANUAL PROJECTS

Users should be able to create a video without an opportunity.

Example:

```text
Create Video

[From Opportunity]
[Start From Scratch]
```

Manual projects should still go through the same production pipeline.

This keeps the video engine useful independently of the intelligence system.

---

# 50. TESTING

Add tests for:

### Video Brief

- Opportunity conversion
- Editing
- Validation

### Script

- Structured output
- Invalid AI response
- Regeneration

### Scene planner

- Scene creation
- Timing
- Missing assets

### Video engine

- Project conversion
- Renderer compatibility
- Timeline validation

### Publishing

- Authorization
- Upload failure
- Retry
- Project state transitions

### Analytics

- Supported metrics
- Missing metrics
- Baseline calculations
- Publication-age comparison

### Learning

- Correct outcome classification
- Insufficient-data handling
- Opportunity thesis evaluation

### Security

- User ownership
- Cross-user access prevention

---

# 51. NO FAKE DATA

Strict requirement.

Do not create fake:

- YouTube analytics
- CTR
- Views
- Retention
- Publishing results
- Opportunity outcomes
- AI performance scores

Development fixtures must be clearly separated from production.

---

# 52. IMPORTANT: DO NOT OVER-AUTOMATE

The product should not become:

```text
Click once
→ AI creates everything
→ AI publishes everything
```

Instead:

```text
AI recommends
↓
User approves
↓
AI generates
↓
User reviews
↓
System renders
↓
User approves
↓
User publishes
↓
System learns
```

This preserves quality and user control.

---

# 53. PHASE 3 IMPLEMENTATION ORDER

Follow this sequence:

## STEP 1

Inspect existing video engine.

## STEP 2

Inspect Phase 1 and Phase 2 data models/services.

## STEP 3

Design the integration architecture.

## STEP 4

Implement Video Brief.

## STEP 5

Implement Script Generator.

## STEP 6

Implement Scene Planner.

## STEP 7

Connect Scene Planner to existing video engine.

## STEP 8

Implement production/review workflow.

## STEP 9

Implement Packaging Studio integration.

## STEP 10

Implement publish/project relationship.

## STEP 11

Implement performance tracking.

## STEP 12

Implement opportunity thesis evaluation.

## STEP 13

Implement learning engine.

## STEP 14

Integrate learned signals back into Phase 2.

## STEP 15

Implement dashboard/project history.

## STEP 16

Add tests.

## STEP 17

Run typecheck/lint/build/tests.

---

# 54. IMPLEMENTATION RULE

Do NOT immediately generate the entire Phase 3 system.

First inspect the repository and provide:

1. Existing video-engine architecture
2. Existing project model
3. Existing rendering pipeline
4. Existing AI services
5. Existing Phase 1 interfaces
6. Existing Phase 2 interfaces
7. Integration points
8. Required new models
9. Required new services
10. Required UI routes
11. Potential architectural risks

Then implement incrementally.

Reuse existing abstractions wherever possible.

Do not create duplicate systems.

---

# 55. DEFINITION OF DONE

Phase 3 is complete when:

### Opportunity → Brief

- A Phase 2 opportunity can become a Video Brief.
- User can edit the brief.
- Evidence remains attached.

### Brief → Script

- Structured script generation works.
- User can review/edit/regenerate.

### Script → Scene Plan

- Narration becomes structured visual scenes.
- Asset requirements are explicit.
- Timing is deterministic where possible.

### Scene Plan → Video Engine

- Existing video engine can consume the generated plan.
- Existing Remotion/rendering system remains intact.
- No parallel renderer is created.

### Production

- User can preview/edit/regenerate.
- Rendering works.
- Errors are recoverable.

### Packaging

- Multiple title directions.
- Thumbnail concepts.
- User can select final packaging.

### Publishing

- Explicit user approval.
- Published video is linked to project.

### Learning

- Real performance can be measured.
- Performance is compared against appropriate baselines.
- Opportunity thesis is evaluated.
- Bottlenecks are diagnosed.
- Derived learning signals are generated.

### Feedback

- Learning signals can influence future Phase 2 opportunity ranking.
- Small sample sizes do not create false conclusions.

### Privacy

- Raw analytics/research data is not unnecessarily persisted.
- Project-owned assets and necessary project data remain available.
- Secrets are never logged.

### Quality

- Existing Phase 1 works.
- Existing Phase 2 works.
- Existing video engine works.
- Tests pass.
- Typecheck passes.
- Lint passes.
- Production build passes.

---

# FINAL PRODUCT PRINCIPLE

The final system should not merely be:

"AI makes YouTube videos."

It should become:

> **An evidence-driven YouTube content operating system that identifies opportunities, helps create the video, measures the real result, and learns what works for that specific channel.**

The long-term loop is:

```text
DIAGNOSE
"What is happening?"

        ↓

DISCOVER
"What should I make?"

        ↓

EXECUTE
"How should I make it?"

        ↓

PUBLISH
"Let's put it in front of viewers."

        ↓

MEASURE
"What actually happened?"

        ↓

LEARN
"What should we do differently next time?"

        ↓

DISCOVER AGAIN
"What's the next best opportunity?"
```

Build Phase 3 around this loop.
