import { DISCOVER_RULES } from '../analysis/rules-config';
import { mad, median } from '../analysis/stats';
import type { Confidence } from '../types';
import type { Baseline, MarketVideo, Outlier, PublicFormat } from './types';

/**
 * Relative performance against each channel's own baseline (docs/discover-plan.md §6.1).
 * Pure: no network. Public data only has lifetime views, so age is handled explicitly:
 * very new videos are not judged, and baselines use videos aged 7–365 days.
 */

const O = DISCOVER_RULES.outliers;
const DAY_MS = 86_400_000;

export const publicFormat = (durationSec: number | null): PublicFormat | null =>
  durationSec === null ? null : durationSec <= DISCOVER_RULES.discovery.shortsMaxSec ? 'short' : 'video';

export const ageInDays = (publishedAt: string, now: Date) => (now.getTime() - Date.parse(publishedAt)) / DAY_MS;

interface BaselineStats extends Baseline {
  /** Median and scaled MAD of ln(views + 1), for the robust z-score. */
  logMedian: number | null;
  logSpread: number | null;
}

/** A channel's usual views for one format. */
export function computeBaseline(videos: MarketVideo[], format: PublicFormat, now: Date): BaselineStats {
  const views = videos
    .filter((v) => publicFormat(v.durationSec) === format && v.views !== null)
    .filter((v) => {
      const age = ageInDays(v.publishedAt, now);
      return age >= O.minAgeDays && age <= O.maxBaselineAgeDays;
    })
    .map((v) => v.views as number);

  const n = views.length;
  const strength: Baseline['strength'] = n >= O.highBaseline ? 'high' : n >= O.minBaseline ? 'medium' : 'insufficient';
  const logs = views.map((v) => Math.log(v + 1));
  const spread = mad(logs);
  return {
    format,
    sampleSize: n,
    medianViews: median(views),
    strength,
    logMedian: median(logs),
    logSpread: spread === null ? null : 1.4826 * spread,
  };
}

export function publicBaselines(videos: MarketVideo[], now: Date): Record<PublicFormat, BaselineStats> {
  return { short: computeBaseline(videos, 'short', now), video: computeBaseline(videos, 'video', now) };
}

export interface Judgement {
  eligible: boolean;
  ratio: number | null;
  robustZ: number | null;
  isOutlier: boolean;
  confidence: Confidence | null;
}

/**
 * How one video did against its channel's usual. Not eligible when it is too new, has no
 * public views or duration, or its channel has too few same-format videos to compare with.
 */
export function judgeVideo(video: MarketVideo, baselines: Record<PublicFormat, BaselineStats>, now: Date): Judgement {
  const none: Judgement = { eligible: false, ratio: null, robustZ: null, isOutlier: false, confidence: null };
  const format = publicFormat(video.durationSec);
  if (format === null || video.views === null || ageInDays(video.publishedAt, now) < O.minAgeDays) return none;

  const b = baselines[format];
  if (b.strength === 'insufficient' || !b.medianViews || b.logMedian === null) return none;

  const ratio = video.views / b.medianViews;
  // MAD of 0 (most videos with identical views) makes z meaningless: fall back to the ratio alone.
  const robustZ = b.logSpread ? (Math.log(video.views + 1) - b.logMedian) / b.logSpread : null;
  const isOutlier = ratio >= O.minRatio && (robustZ === null || robustZ >= O.minRobustZ);
  const base: Confidence = b.strength === 'high' ? 'high' : 'medium';
  return { eligible: true, ratio, robustZ, isOutlier, confidence: robustZ === null && base === 'high' ? 'medium' : base };
}

/** Outliers among the videos published inside the window, strongest first. */
export function findOutliers(
  videos: MarketVideo[],
  baselines: Record<PublicFormat, BaselineStats>,
  windowDays: number,
  now: Date,
  channelTitle: string
): { eligible: number; outliers: Outlier[] } {
  let eligible = 0;
  const outliers: Outlier[] = [];
  for (const video of videos) {
    const age = ageInDays(video.publishedAt, now);
    if (age > windowDays) continue;
    const j = judgeVideo(video, baselines, now);
    if (!j.eligible) continue;
    eligible += 1;
    if (!j.isOutlier) continue;
    const format = publicFormat(video.durationSec) as PublicFormat;
    outliers.push({
      videoId: video.id,
      channelId: video.channelId,
      channelTitle,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      ageDays: Math.floor(age),
      format,
      views: video.views as number,
      baselineViews: baselines[format].medianViews as number,
      ratio: Math.round((j.ratio as number) * 10) / 10,
      sampleSize: baselines[format].sampleSize,
      confidence: j.confidence as Confidence,
    });
  }
  outliers.sort((a, b) => b.ratio - a.ratio);
  return { eligible, outliers };
}

/** Strips the internal log statistics before results leave the server. */
export function toBaseline({ format, sampleSize, medianViews, strength }: BaselineStats): Baseline {
  return { format, sampleSize, medianViews, strength };
}
