import { median } from '../analysis/stats';
import { ageInDays, findOutliers, publicBaselines, toBaseline } from './outliers';
import type { ChannelProfile, MarketVideo, Outlier, PublicChannel } from './types';
import { shortsShare } from './discovery';

const DAY_MS = 86_400_000;

/**
 * A channel's profile from its public uploads: activity, format mix, usual views per format
 * and outliers in the research window. Pure. Used for competitors and for your own channel,
 * so "You vs them" compares like with like.
 */
export function profileChannel(
  channel: PublicChannel,
  videos: MarketVideo[],
  windowDays: number,
  now: Date
): { profile: ChannelProfile; outliers: Outlier[] } {
  const baselines = publicBaselines(videos, now);
  const { eligible, outliers } = findOutliers(videos, baselines, windowDays, now, channel.title);

  const recent = videos
    .filter((v) => ageInDays(v.publishedAt, now) <= 90)
    .map((v) => Date.parse(v.publishedAt))
    .sort((a, b) => b - a);
  const gaps = recent.slice(1).map((t, i) => (recent[i] - t) / DAY_MS);

  return {
    profile: {
      channel,
      videosRead: videos.length,
      uploadsLast30Days: videos.filter((v) => ageInDays(v.publishedAt, now) <= 30).length,
      uploadsLast90Days: recent.length,
      coverageDays: videos.length ? Math.floor(Math.max(...videos.map((v) => ageInDays(v.publishedAt, now)))) : 0,
      medianDaysBetweenUploads: recent.length >= 3 ? Math.round((median(gaps) as number) * 10) / 10 : null,
      shortsShare: shortsShare(videos),
      baselines: { short: toBaseline(baselines.short), video: toBaseline(baselines.video) },
      eligibleInWindow: eligible,
      outliersInWindow: outliers.length,
      outlierRate: eligible > 0 ? outliers.length / eligible : null,
    },
    outliers,
  };
}
