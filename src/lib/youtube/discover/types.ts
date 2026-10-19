import type { Confidence } from '../types';

/** The user's own grouping of a saved competitor (docs/discover-plan.md §3.1). */
export type CompetitorGroup = 'direct' | 'adjacent' | 'format';

export type Relevance = 'high' | 'medium' | 'low';

/** Stages streamed by the discovery run. */
export type DiscoveryStage = 'connect' | 'your_channel' | 'search' | 'candidates' | 'classify' | 'done';

/** Public channel info, fetched fresh from YouTube on every view (never stored). */
export interface PublicChannel {
  id: string;
  title: string;
  thumbnail: string | null;
  url: string;
  subscriberCount: number | null;
  videoCount: number | null;
}

/** A saved watchlist row joined with its fresh public info (null when YouTube no longer returns it). */
export interface WatchlistEntry {
  channelId: string;
  label: string | null;
  group: CompetitorGroup;
  active: boolean;
  addedAt: string;
  channel: PublicChannel | null;
}

/** Measured signals behind a suggestion. All counts come from the analyzed sample. */
export interface CandidateSignals {
  /** Recent titles of theirs that are close to one of your titles. */
  matchingTitles: number;
  titlesChecked: number;
  /** Search phrases (of those run) whose results included this channel. */
  queriesMatched: number;
  queriesRun: number;
  uploadsLast90Days: number;
  /** Share of their checked videos that are 3 minutes or shorter (likely Shorts). */
  shortsShare: number;
  yourShortsShare: number;
}

export interface CompetitorCandidate {
  channel: PublicChannel;
  relevance: Relevance;
  /** 0–1, calculated by us; shown only as the relevance label. */
  relevanceScore: number;
  suggestedGroup: CompetitorGroup;
  confidence: Confidence;
  reasons: string[];
  /** A few of their titles that matched your topics, so the user can judge for themselves. */
  exampleTitles: string[];
  signals: CandidateSignals;
}

export interface DiscoveryResult {
  queries: string[];
  candidates: CompetitorCandidate[];
  /** Channels found by search before filtering. */
  channelsFound: number;
  limitations: string[];
  embeddingModel: string | null;
}

// ─── Research (D3) ───────────────────────────────────────────────────────────

export type ResearchWindow = '30d' | '90d';

export type ResearchStage = 'connect' | 'your_channel' | 'competitors' | 'videos' | 'outliers' | 'done';

/** Shorts are estimated from duration (≤ 3 min): the public API has no Shorts flag. */
export type PublicFormat = 'short' | 'video';

/** A public video as research uses it. Lives only in memory during a run. */
export interface MarketVideo {
  id: string;
  channelId: string;
  title: string;
  publishedAt: string;
  durationSec: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  thumbnailUrl: string | null;
}

/** A channel's usual views for one format, from its own recent uploads. */
export interface Baseline {
  format: PublicFormat;
  /** Same-format videos aged 7–365 days with a public view count. */
  sampleSize: number;
  medianViews: number | null;
  /** 'insufficient' below the minimum sample: no outliers are claimed. */
  strength: 'high' | 'medium' | 'insufficient';
}

/** A video that did far better than its own channel usually does. */
export interface Outlier {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  ageDays: number;
  format: PublicFormat;
  views: number;
  baselineViews: number;
  /** views ÷ baseline, calculated by us. */
  ratio: number;
  sampleSize: number;
  confidence: Confidence;
}

/** One channel's recent activity and performance, from public data only. */
export interface ChannelProfile {
  channel: PublicChannel;
  /** Uploads read for this channel (the baseline sample comes from these). */
  videosRead: number;
  uploadsLast30Days: number;
  uploadsLast90Days: number;
  /**
   * Days back the videos we read reach. When it is below 90 (a very active channel), the
   * upload counts are "at least" values.
   */
  coverageDays: number;
  /** Median days between uploads over the last 90 days; null with fewer than 3 uploads. */
  medianDaysBetweenUploads: number | null;
  shortsShare: number | null;
  baselines: Record<PublicFormat, Baseline>;
  /** Videos in the research window old enough to judge. */
  eligibleInWindow: number;
  outliersInWindow: number;
  /** outliers ÷ eligible; null when nothing could be judged. */
  outlierRate: number | null;
}

export interface CompetitorStatus {
  channelId: string;
  title: string | null;
  status: 'ok' | 'unavailable';
  reason?: string;
}

export interface ResearchResult {
  window: ResearchWindow;
  generatedAt: string;
  you: ChannelProfile;
  competitors: ChannelProfile[];
  statuses: CompetitorStatus[];
  /** Strongest competitor outliers in the window, highest ratio first. */
  outliers: Outlier[];
  videosAnalyzed: number;
  limitations: string[];
}
