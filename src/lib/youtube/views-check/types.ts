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
  /** When half the viewers had left, in seconds (from the retention curve). */
  halfGoneAtSec: number | null;
  /** The steepest drop after the first moment: where, and how many viewers (0–1) it lost. */
  biggestDrop: { atSec: number; lost: number } | null;
  day1Views: number | null;
  day2Views: number | null;
  /** Mean relativeRetentionPerformance (0–1, 0.5 = typical for similar Shorts). */
  relativeRetention: number | null;
  likeRate: number | null;
  daily: { date: string; views: number }[];
  /** The retention curve, at most 40 points: `at` 0–1 through the video, `watching` share still watching. */
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
}

/** Everything the views check needs, held in memory only. */
export interface ViewsCheckDataset {
  channel: ChannelInfo;
  /** Channel-level language and country set by the owner, if any. */
  channelLanguage: string | null;
  /** The period the analytics cover, ending on the last fully reported day. */
  period: DateRange;
  /** Most recent uploads, newest first. */
  videos: VideoMeta[];
  status: Result<Record<string, VideoStatus>>;
  /** Per-video stats over the period; also fixes each video's format. */
  perVideo: Result<Record<string, PeriodStats>>;
  /** Engaged views per video over the period. */
  engaged: Result<Record<string, number>>;
  reach: Result<ReachData>;
  countries: Result<{ country: string; views: number }[]>;
  deepDives: Record<string, VideoDeepDive>;
  /** When this was collected, for "how old is this video" checks. */
  collectedAt: string;
}
