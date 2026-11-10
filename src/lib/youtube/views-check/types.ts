import type { ChannelInfo, DateRange, PeriodStats, ReachData, Result, RetentionPoint, TrafficRow, VideoMeta } from '../types';

/** What videos.list `status` and `contentDetails` say about a video's availability. */
export interface VideoStatus {
  uploadStatus: string | null;
  /** Set only when the upload failed (codec, conversion, …). */
  failureReason: string | null;
  /** Set only when YouTube rejected the upload (claim, copyright, duplicate, …). */
  rejectionReason: string | null;
  privacyStatus: string | null;
  madeForKids: boolean | null;
  /** Countries where the video plays; an empty list means it plays nowhere. */
  regionAllowed: string[] | null;
  /** Countries where the video is blocked. */
  regionBlocked: string[] | null;
  ageRestricted: boolean;
}

export interface DayViews {
  date: string; // YYYY-MM-DD
  views: number;
  engagedViews: number;
  /** Present when YouTube returned them for the day. */
  likes?: number;
  comments?: number;
  shares?: number;
  avgViewPct?: number;
}

/** Per-video data the views check reads beyond the shared channel data. */
export interface VideoDeepDive {
  /** Views per day from the publish date to the last reported day. */
  daily: Result<DayViews[]>;
  /** Views per traffic source since publish. */
  traffic: Result<TrafficRow[]>;
  retention: Result<RetentionPoint[]>;
}

export interface ViewsCheckLimits {
  /** Recent uploads to read. */
  maxVideos: number;
  /** Videos (newest first, old enough to judge) that get daily, traffic and retention data. */
  maxDeepDives: number;
}

// ─── Report ────────────────────────────────────────────────────────────────────

/**
 * Why a video has few or no views, most severe first:
 * blocked → not shown → not in the Shorts feed → seen but not clicked → clicked then left →
 * Short stopped early → fine.
 */
export type ViewsCause =
  | 'blocked'
  | 'too_new'
  | 'not_shown'
  | 'not_in_feed'
  | 'not_clicked'
  | 'new_topic'
  | 'weak_hook'
  | 'left_early'
  | 'quick_stop'
  | 'unknown'
  | 'ok';

export interface VideoFinding {
  videoId: string;
  title: string;
  format: 'short' | 'video';
  publishedAt: string;
  /** Days of analytics YouTube has reported for this video so far. */
  reportedDays: number;
  lifetimeViews: number | null;
  durationSec: number | null;
  /** Average % of the video watched over the period (0–100), when reported. */
  avgViewPct: number | null;
  cause: ViewsCause;
  /** One sentence: what is wrong. */
  reason: string;
  /** The numbers behind it. */
  evidence: string[];
  /** One sentence: what to do. */
  fix: string;
}

/** How a Short's views arrived, for "why did it stop". */
/** A topic the channel's Shorts are grouped into (by AI, from titles). */
export interface TopicGroup {
  name: string;
  videoIds: string[];
}

export interface TopicSummary {
  name: string;
  shorts: number;
  /** Median public views of its Shorts that are 2+ days old; null when none are. */
  medianViews: number | null;
  medianSwipeAway: number | null;
  best: { videoId: string; title: string; views: number } | null;
}

/** The four steps a Short must pass, in order. */
export type GateId = 'shown' | 'stopped' | 'stayed' | 'reacted';

export interface Gate {
  id: GateId;
  state: 'pass' | 'fail' | 'unknown';
  /** The number behind it, in words. */
  note: string;
}

export type TestSignalId = 'stayed' | 'watched' | 'reacted';

export interface TestSignal {
  id: TestSignalId;
  /** stayed and watched: 0–1 (watched can exceed 1 with rewatches); reacted: per 100 views. */
  value: number;
  /** Median of the channel's other Shorts; null with too few. */
  usual: number | null;
  /** What it was compared with: the usual, never below the healthy floor. */
  benchmark: number;
  /** value ÷ benchmark, capped. */
  ratio: number;
}

export interface ShortTest {
  /** 100 = as good as the channel's usual Short. */
  score: number;
  result: 'passed' | 'close' | 'failed';
  signals: TestSignal[];
  /** The signal furthest below its benchmark, when one is below. */
  weakest: TestSignalId | null;
  /** Why distribution stopped (or didn't), in one or two plain sentences. */
  message: string;
  fix: string | null;
}

export interface RoundRates {
  views: number;
  perDay: number;
  /** Engaged ÷ views (0–1). */
  stayed: number | null;
  /** Average % viewed, 0–1 (above 1 with rewatches). */
  watched: number | null;
  /** Likes + comments + shares per 100 views. */
  reacted: number | null;
}

export interface TestRound {
  /** Round n = day n since upload. */
  no: 1 | 2 | 3;
  date: string | null;
  /**
   * Round 1: pass with at least the usual first-day views. Rounds 2–3: pass only with more views
   * than the day before. no_data: the day isn't reported yet.
   */
  state: 'pass' | 'fail' | 'no_data';
  rates: RoundRates | null;
  /** This day's views ÷ the day before (round 2 and 3). */
  change: number | null;
}

export interface TestRounds {
  rounds: TestRound[];
  /** The first round that failed; null if none failed (yet). */
  failedAt: 1 | 2 | 3 | null;
  /** Every round passed: views grew each day. */
  passedAll: boolean;
  /** The channel's usual views on a Short's first day (median of its other Shorts); null with too few. */
  usualFirstDay: number | null;
  /** The signal that dropped on the day it stopped (or was below the usual Short on day 1). */
  dropped: TestSignalId | null;
  /** The day after the last round, for "day 4 got …". */
  nextDay: { views: number; change: number | null } | null;
  message: string;
  fix: string | null;
}

export interface Interactions {
  likes: number;
  comments: number;
  shares: number;
}

export interface ShortTimeline {
  videoId: string;
  title: string;
  views: number;
  /** Share of views in the first `firstDays` reported days (0–1). */
  firstDaysShare: number | null;
  /** Share of views from the Shorts feed (0–1). */
  shortsFeedShare: number | null;
  /** Engaged views ÷ views (0–1). */
  engagedRate: number | null;
  /**
   * Estimated share of plays swiped away in the first seconds: 1 − engaged ÷ views. Since March
   * 2025 a Shorts view counts every play, while an engaged view needs the viewer to stay past the
   * first seconds. An estimate, not Studio's "Viewed vs swiped away".
   */
  estSwipeAway: number | null;
  /** The channel's median estSwipeAway across judged Shorts, for comparison. */
  channelMedianSwipeAway: number | null;
  durationSec: number | null;
  avgViewSec: number | null;
  avgViewPct: number | null;
  /**
   * Share who watched to (almost) the end, read at 95% of the video:
   * - `ofViews`: of all views, as YouTube Studio shows it (the main number);
   * - `ofStarted`: of the audience at the curve's first point.
   * Above 1 means rewatches/loops, not more people.
   */
  completion: { ofStarted: number; ofViews: number } | null;
  /** When viewers leave: from the moment 10% of the opening audience is gone to when half is gone (seconds). */
  exitWindow: { fromSec: number; toSec: number | null } | null;
  /** When the curve fell below 50% of views, in seconds (as in YouTube Studio). */
  halfGoneAtSec: number | null;
  /** The steepest drop after the first moment: where, and how much of the views (0–1) it lost. */
  biggestDrop: { atSec: number; lost: number } | null;
  day1Views: number | null;
  day2Views: number | null;
  /** Mean relativeRetentionPerformance (0–1, 0.5 = typical for similar Shorts). */
  relativeRetention: number | null;
  likeRate: number | null;
  /** Likes, comments and shares in the period; null when Analytics didn't return them. */
  interactions: Interactions | null;
  /** The topic group this Short is in, when topics were grouped. */
  topic?: string | null;
  /** Shown → stopped scrolling → stayed → reacted; the first "fail" is where this Short stopped. */
  gates?: Gate[];
  /** YouTube's first-viewers test, scored against the channel's other Shorts. */
  test?: ShortTest | null;
  /** The three test rounds, read from views per day: which round it passed and where it stopped. */
  rounds?: TestRounds | null;
  daily: { date: string; views: number }[];
  /**
   * The retention curve, at most 40 points: `at` 0–1 through the video, `watching` as a share of
   * views, like YouTube Studio (above 1 = rewatches/loops).
   */
  curve: { at: number; watching: number }[];
}

export type SignalId =
  | 'channel_wide_stop'
  | 'double_post'
  | 'hashtags_in_titles'
  | 'no_long_videos'
  | 'format_gap'
  | 'upload_gap'
  | 'mass_produced_risk'
  | 'sudden_drop'
  | 'low_subscribe_rate'
  | 'no_comments';

export interface ChannelSignal {
  id: SignalId;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  fix: string;
}

/** Something only YouTube Studio shows; the report tells the user where to look. */
export interface StudioCheck {
  id: 'restrictions' | 'copyright' | 'strikes' | 'feature_eligibility' | 'viewed_vs_swiped' | 'shown_in_feed';
  title: string;
  where: string;
  why: string;
  ifFound: string;
}

export interface ViewsCheckReport {
  verdict: {
    cause: ViewsCause | 'channel_wide_stop' | 'not_enough_data';
    headline: string;
    firstStep: string;
    /** Videos this verdict is based on. */
    basedOn: number;
  };
  videos: VideoFinding[];
  shorts: ShortTimeline[];
  signals: ChannelSignal[];
  studioChecks: StudioCheck[];
  plan: string[];
  limitations: string[];
  summary: {
    judgedVideos: number;
    tooNew: number;
    byCause: Partial<Record<ViewsCause, number>>;
    avgShortViews: number | null;
    avgLongViews: number | null;
  };
  /** Where the channel's Shorts stand: still being tested, finding an audience, steady or slowing. */
  stage: ChannelStage;
  /** The channel's Shorts by topic, best first; empty when they couldn't be grouped. */
  topics: TopicSummary[];
  /** How many judged Shorts stopped at each step (the first step they failed). */
  stopPoints: { gate: GateId | 'none' | 'unknown'; count: number }[];
  /** How often the test score ranked this channel's Shorts the way their views did. */
  testAgreement: { agreed: number; pairs: number } | null;
}

export type ChannelStageId = 'not_enough' | 'finding_audience' | 'slowing' | 'testing' | 'steady';

export interface StageWindow {
  count: number;
  medianViews: number;
  /** The lowest view count in the window: the "floor". */
  floorViews: number;
  maxViews: number;
  /** Median share of views from the Shorts feed, where known (0–1). */
  feedShare: number | null;
}

/**
 * A reading of the channel's own numbers, not a YouTube status: YouTube has no official
 * "discovery phase". Compares the newest Shorts with the ones before them.
 */
export interface ChannelStage {
  id: ChannelStageId;
  title: string;
  detail: string;
  recent: StageWindow | null;
  previous: StageWindow | null;
  shortsCompared: number;
  subscribers: number | null;
  channelAgeDays: number | null;
}

/** Everything the views check needs, held in memory only. */
export interface ViewsCheckDataset {
  channel: ChannelInfo;
  /** Channel-level language and country set by the owner, if any. */
  channelLanguage: string | null;
  /** When the channel was created (ISO), if YouTube returned it. */
  channelCreatedAt?: string | null;
  /** The Shorts grouped by topic (AI, from titles); null when not grouped. */
  topics?: TopicGroup[] | null;
  /** The period the analytics cover, ending on the last fully reported day. */
  period: DateRange;
  /** Most recent uploads, newest first. */
  videos: VideoMeta[];
  status: Result<Record<string, VideoStatus>>;
  /** Per-video stats over the period; also fixes each video's format. */
  perVideo: Result<Record<string, PeriodStats>>;
  /** Engaged views per video over the period. */
  engaged: Result<Record<string, number>>;
  /** Likes, comments and shares per video over the period (YouTube Analytics). */
  interactions: Result<Record<string, Interactions>>;
  reach: Result<ReachData>;
  countries: Result<{ country: string; views: number }[]>;
  deepDives: Record<string, VideoDeepDive>;
  /** When this was collected, for "how old is this video" checks. */
  collectedAt: string;
}
