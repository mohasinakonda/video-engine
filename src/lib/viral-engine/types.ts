/**
 * Viral Engine: frame-by-frame analysis of one Short (docs/viral-engine-plan.md).
 * Shared by the browser (extraction, re-running the rules) and the server (vision, channel data).
 * Nothing here is stored in the database.
 */

export type Level = 'bad' | 'warn' | 'good';

/** Where a finding comes from. `vision` is a model's reading of the frames, so it is an estimate. */
export type EvidenceSource = 'file' | 'motion' | 'sound' | 'speech' | 'vision' | 'retention' | 'baseline' | 'topic';

export type ShortFormat = 'talking' | 'tutorial' | 'process' | 'visual' | 'skit' | 'music' | 'other';

export const SHORT_FORMATS: { id: ShortFormat; label: string }[] = [
  { id: 'talking', label: 'Talking to camera' },
  { id: 'tutorial', label: 'Tutorial / explainer' },
  { id: 'process', label: 'Process (cooking, making, cleaning…)' },
  { id: 'visual', label: 'Visual / scenic' },
  { id: 'skit', label: 'Skit / comedy' },
  { id: 'music', label: 'Music / dance' },
  { id: 'other', label: 'Other' },
];

/** Formats where nobody talking is normal, so silence alone is not a problem. */
export const SILENT_OK_FORMATS: ShortFormat[] = ['process', 'visual', 'music'];

export interface SpeechRun {
  start: number;
  end: number;
  text: string;
}

/** Everything measured in the browser from the file. All of it is "measured", not estimated. */
export interface MeasuredSignals {
  durationSec: number;
  width: number;
  height: number;
  letterboxed: boolean;
  /** Seconds between motion samples. */
  motionStep: number;
  /** Share of the picture that changed since the previous sample (colour-aware), 0–1. */
  motion: number[];
  /** Seconds where the shot changes. */
  cuts: number[];
  /** Seconds between loudness samples. */
  loudnessStep: number;
  /** dBFS per sample (−90 = silence). */
  loudness: number[];
  /** Share of audio samples at full scale, 0–100. */
  clippingPct: number;
  /** How alike the first and last frame are, 0–1. */
  loopSimilarity: number;
  speech: SpeechRun[];
  /** The language the transcription ran in (chosen by the user). */
  speechLanguage: string | null;
}

/** What the vision model reports about one frame. It describes; the rules judge. */
export interface FrameFinding {
  t: number;
  subject: string;
  face: boolean;
  text: string | null;
  textPosition: 'top' | 'middle' | 'bottom' | null;
  textSide: 'left' | 'center' | 'right' | null;
  textSize: 'small' | 'readable' | 'large' | null;
  /** Something visibly happens in this moment. */
  action: boolean;
  watermark: 'none' | 'tiktok' | 'capcut' | 'other';
  /** Looks like footage from TV, a film or another creator. Low confidence by nature. */
  looksReused: boolean;
  /** A result, reveal or punchline is shown. */
  showsResult: boolean;
}

export interface VisionResult {
  format: ShortFormat | null;
  frames: FrameFinding[];
  model: string | null;
  /** Parts the model could not read (each becomes a limitation). */
  failed: string[];
}

/** Percent of starting viewers still watching at each second (0–100+; loops can exceed 100). */
export interface RetentionPoint {
  sec: number;
  pct: number;
}

/** How close this Short's topic is to what the channel usually posts (embedding similarity, an estimate). */
export interface TopicFit {
  /** This Short's topic in one line, written by AI from the title, transcript or frames. */
  topic: string;
  /** Similarity to the channel's closest videos, 0–1. */
  score: number;
  /** How alike the channel's own videos usually are to each other, on the same scale. */
  typical: number;
  closest: { title: string; views: number | null; similarity: number }[];
}

/** The connected channel's recent uploads, compared with this Short. */
export interface ChannelProfile {
  channelTitle: string;
  /** Recent uploads compared (Shorts and long videos). */
  videoCount: number;
  shortsCount: number;
  /** Median views of the recent Shorts. */
  medianShortViews: number | null;
  /** Median length of the better-performing half of the recent Shorts. */
  topShortDurationSec: number | null;
  fit: TopicFit | null;
}

/** Channel data, when the channel is connected. A linked published Short adds its own retention. */
export interface ChannelContext {
  videoId: string | null;
  title: string | null;
  publishedAt: string | null;
  retention: RetentionPoint[] | null;
  /** Median of the channel's recent Shorts, per second. */
  usual: RetentionPoint[] | null;
  baselineCount: number;
  profile: ChannelProfile | null;
  notes: string[];
}

export interface Metadata {
  title: string;
  hashtags: string[];
}

export type IssueKind =
  | 'strong_hook'
  | 'slow_hook'
  | 'quiet_open'
  | 'dead_zone'
  | 'quiet_stretch'
  | 'holds_attention'
  | 'static_shot'
  | 'safe_zone'
  | 'no_captions'
  | 'small_text'
  | 'long_tail'
  | 'no_loop'
  | 'loops_well'
  | 'watermark'
  | 'reused_content'
  | 'loudness'
  | 'format'
  | 'language_mismatch'
  | 'off_topic'
  | 'channel_fit'
  | 'longer_than_usual'
  | 'retention_drop';

export interface IssueEvidence {
  source: EvidenceSource;
  measured: boolean;
}

export interface TimelineIssue {
  id: string;
  kind: IssueKind;
  startSec: number;
  endSec: number;
  level: Level;
  title: string;
  /** What we observed, with numbers. */
  saw: string;
  /** What to do; for a good finding, why it works. */
  fix: string;
  evidence: IssueEvidence[];
  /** Covers the whole video, or most of it, rather than a moment (shown in the list, not as a timeline block). */
  wholeVideo?: boolean;
}

export interface MetadataCheck {
  id: string;
  level: Level;
  text: string;
}

export interface EngineInput {
  signals: MeasuredSignals;
  vision: VisionResult;
  channel: ChannelContext | null;
  metadata: Metadata;
  /** Set when the user corrected the detected format. */
  formatOverride: ShortFormat | null;
}

export interface ViralReport {
  durationSec: number;
  format: ShortFormat;
  formatSource: 'vision' | 'user' | 'default';
  issues: TimelineIssue[];
  metadataChecks: MetadataCheck[];
  counts: Record<Level, number>;
  biggestFixId: string | null;
  limitations: string[];
}

export interface ViralWording {
  headline: string;
  summary: string;
  hooks: string[];
  titles: string[];
  hashtags: string[];
  source: 'ai' | 'rules';
}

/** What the browser keeps in the tab. The inputs let the rules re-run for free (format change). */
export interface ViralResult {
  version: number;
  file: { name: string; size: number; durationSec: number };
  input: EngineInput;
  report: ViralReport;
  wording: ViralWording;
  generatedAt: string;
}

/** 3: motion is the share of changed pixels (v2 reports used a mean brightness difference). */
export const VIRAL_RESULT_VERSION = 3;
