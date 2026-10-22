/**
 * Channel Doctor data shapes. A ChannelDataset lives only in one request's memory.
 * Missing values are null, never 0.
 */

export type RangeKey = '28d' | '90d';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  days: number;
}

/** One optional data source: either the data, or why it isn't available. */
export type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

export type VideoFormat = 'short' | 'video';

export interface VideoMeta {
  id: string;
  title: string;
  publishedAt: string; // ISO
  durationSec: number | null;
  thumbnailUrl: string | null;
  /** From YouTube's creatorContentType; null when the video had no views in the period. */
  format: VideoFormat | null;
  lifetimeViews: number | null;
  likes: number | null;
  comments: number | null;
  /** Filled only when requested (public research of other channels). */
  channelId?: string;
  categoryId?: string | null;
  /** First 300 characters, only when requested. */
  description?: string;
  /** The uploader's tags, only when requested. */
  tags?: string[];
  /** A live stream in progress or a scheduled premiere (no final length or views yet). */
  liveOrUpcoming?: boolean;
}

export interface PeriodStats {
  views: number;
  minutesWatched: number;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
}

export interface DailyPoint {
  date: string;
  views: number;
  minutesWatched: number;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
}

export interface ChannelTotals {
  views: number;
  minutesWatched: number;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
}

export interface TrafficRow {
  source: string;
  views: number;
  minutesWatched: number | null;
}

export interface AgeGroupRow {
  /** YouTube's value, e.g. "age25-34". */
  ageGroup: string;
  viewerPct: number;
}

export interface CountryRow {
  /** ISO 3166-1 alpha-2 code. */
  country: string;
  views: number;
  minutesWatched: number;
}

export interface RetentionPoint {
  /** 0–1, position in the video. */
  ratio: number;
  /** Share of viewers still watching (can exceed 1 with rewatches). */
  watchRatio: number;
  /** 0–1 vs similar-length YouTube videos; null when not reported. */
  relativePerformance: number | null;
}

export interface ReachVideoStats {
  impressions: number;
  /** clicks / impressions, 0–1. */
  ctr: number | null;
}

export interface ReachData {
  byVideo: Record<string, ReachVideoStats>;
  totalImpressions: number;
  ctr: number | null;
  coveredDays: number;
  totalDays: number;
  /** When the reporting job's first files are expected, if none have arrived yet. */
  availableFrom: string | null;
}

export interface ChannelInfo {
  id: string;
  title: string;
  thumbnail: string | null;
  url: string;
  subscriberCount: number | null;
  videoCount: number | null;
}

export interface ChannelDataset {
  range: RangeKey;
  current: DateRange;
  previous: DateRange;
  channel: ChannelInfo;
  /** Most recent uploads (capped by admin settings), newest first. */
  videos: VideoMeta[];
  daily: Result<DailyPoint[]>;
  totals: Result<ChannelTotals>;
  previousTotals: Result<ChannelTotals>;
  perVideo: Result<Record<string, PeriodStats>>;
  traffic: Result<TrafficRow[]>;
  ageGroups: Result<AgeGroupRow[]>;
  countries: Result<CountryRow[]>;
  formatViews: Result<Record<VideoFormat, number>>;
  retention: Record<string, Result<RetentionPoint[]>>;
  reach: Result<ReachData>;
}

export type DiagnosisStage =
  | 'connect'
  | 'fetch_channel'
  | 'fetch_analytics'
  | 'compare_videos'
  | 'retention'
  | 'packaging'
  | 'ai_report'
  | 'done';

// ─── Deterministic analysis output ─────────────────────────────────────────────

export type Confidence = 'low' | 'medium' | 'high';

export type BottleneckCategory = 'packaging' | 'retention' | 'topic' | 'acquisition' | 'consistency';

export type EvidenceCategory = BottleneckCategory | 'strength' | 'data';

export interface Evidence {
  id: string;
  category: EvidenceCategory;
  /** Plain sentence built from measured numbers (not written by the AI). */
  statement: string;
  values: Record<string, number | string | null>;
  sampleSize: number;
  confidence: Confidence;
  videoIds?: string[];
}

export interface Finding {
  category: BottleneckCategory;
  /** Evidence ids that support it. */
  evidenceIds: string[];
  confidence: Confidence;
  /** A measured pattern (false) or an interpretation that needs checking (true). */
  isHypothesis: boolean;
}

export interface MetricValue {
  key: 'views' | 'watchHours' | 'netSubscribers' | 'avgViewDuration' | 'avgViewPct' | 'impressions' | 'ctr';
  value: number | null;
  previous: number | null;
  /** Percent change; null unless the previous period is comparable. */
  changePct: number | null;
  /** Why the value or the comparison is missing, if it is. */
  note: string | null;
}

export type PerformanceLabel = 'outperformer' | 'typical' | 'underperformer' | 'not_comparable';

export interface VideoAnalysis {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  format: VideoFormat | null;
  durationSec: number | null;
  ageDays: number;
  /** All-time views from the Data API; missing on reports saved before it was added. */
  lifetimeViews?: number | null;
  stats: PeriodStats | null;
  impressions: number | null;
  ctr: number | null;
  /** Period views ÷ median of comparable videos (same format and age group). */
  relativeViews: number | null;
  baselineSize: number;
  label: PerformanceLabel;
}

export interface RetentionAnomaly {
  videoId: string;
  kind: 'early_exit' | 'steep_drop' | 'rewatch_spike' | 'weak_vs_similar';
  atSec: number | null;
  atRatio: number;
  /** Size of the signal in percentage points (drop or spike) or the relative score. */
  magnitude: number;
  severity: 'minor' | 'notable' | 'major';
  confidence: Confidence;
}

export interface TitleFeatures {
  videoId: string;
  length: number;
  words: number;
  hasNumber: boolean;
  hasQuestion: boolean;
  hasBrackets: boolean;
  capsWords: number;
}

export interface DeterministicReport {
  metrics: MetricValue[];
  videos: VideoAnalysis[];
  retentionAnomalies: RetentionAnomaly[];
  titleFeatures: TitleFeatures[];
  evidence: Evidence[];
  findings: Finding[];
  strengths: string[]; // evidence ids
  limitations: string[];
}

// ─── Final report (AI or deterministic fallback) ──────────────────────────────

export interface ReportBottleneck {
  category: BottleneckCategory;
  title: string;
  explanation: string;
  evidenceIds: string[];
  confidence: Confidence;
  isHypothesis: boolean;
}

export interface ReportStrength {
  title: string;
  explanation: string;
  evidenceIds: string[];
}

export interface ReportAction {
  priority: number;
  title: string;
  why: string;
  how: string;
  evidenceIds: string[];
  effort: 'low' | 'medium' | 'high';
  expectedImpact: 'potentially_high' | 'moderate' | 'low';
  confidence: Confidence;
}

export interface DiagnosisReport {
  /** One short sentence: the answer to "what's wrong?". */
  headline: string;
  summary: string;
  primaryBottleneck: ReportBottleneck | null;
  secondaryBottlenecks: ReportBottleneck[];
  strengths: ReportStrength[];
  actions: ReportAction[];
  /** 'ai': written by the model and validated; 'fallback': built from the measured findings only. */
  source: 'ai' | 'fallback';
  model: string | null;
}
