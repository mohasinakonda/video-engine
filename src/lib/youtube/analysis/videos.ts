import type { ChannelDataset, PerformanceLabel, VideoAnalysis } from '../types';
import { daysBetween } from './period';
import { median } from './stats';
import { RULES } from './rules-config';

/** Age groups so a 3-day-old video is never compared with a 3-month-old one on views. */
export function ageBucket(ageDays: number): string {
  if (ageDays <= 7) return '0-7';
  if (ageDays <= 30) return '8-30';
  if (ageDays <= 90) return '31-90';
  return '90+';
}

/**
 * Per-video analysis with a relative score: period views ÷ the median of videos with the
 * same format and age group. With too few comparable videos it falls back to the format
 * median; with fewer still, the video is labelled not comparable.
 */
export function analyzeVideos(dataset: ChannelDataset): VideoAnalysis[] {
  const perVideo = dataset.perVideo.ok ? dataset.perVideo.data : {};
  const reach = dataset.reach.ok ? dataset.reach.data.byVideo : {};

  const rows = dataset.videos.map((video) => {
    const ageDays = Math.max(0, daysBetween(video.publishedAt, dataset.current.endDate));
    const stats = perVideo[video.id] ?? null;
    return {
      video,
      ageDays,
      bucket: ageBucket(ageDays),
      // Published after the period ended: no comparable views.
      inPeriod: video.publishedAt.slice(0, 10) <= dataset.current.endDate,
      views: stats?.views ?? (dataset.perVideo.ok ? 0 : null),
      stats,
    };
  });

  return rows.map((row) => {
    const { video } = row;
    const peers = rows.filter((r) => r.inPeriod && r.video.format === video.format && r.views !== null);
    const sameBucket = peers.filter((r) => r.bucket === row.bucket);
    const baseline =
      sameBucket.length >= RULES.minBaselineVideos ? sameBucket : peers.length >= RULES.minBaselineVideos ? peers : [];
    const baselineMedian = median(baseline.map((r) => r.views as number));

    let relativeViews: number | null = null;
    let label: PerformanceLabel = 'not_comparable';
    if (row.inPeriod && video.format && row.views !== null && baselineMedian && baselineMedian > 0) {
      relativeViews = row.views / baselineMedian;
      label =
        relativeViews >= RULES.outperformerRatio
          ? 'outperformer'
          : relativeViews <= RULES.underperformerRatio
            ? 'underperformer'
            : 'typical';
    }

    return {
      id: video.id,
      title: video.title,
      publishedAt: video.publishedAt,
      thumbnailUrl: video.thumbnailUrl,
      format: video.format,
      durationSec: video.durationSec,
      ageDays: row.ageDays,
      lifetimeViews: video.lifetimeViews,
      stats: row.stats,
      impressions: reach[video.id]?.impressions ?? null,
      ctr: reach[video.id]?.ctr ?? null,
      relativeViews,
      baselineSize: baseline.length,
      label,
    };
  });
}
