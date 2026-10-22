import { describe, expect, it } from 'vitest';
import { profileChannel } from './competitor-analysis';
import { computeBaseline, findOutliers, judgeVideo, publicBaselines, publicFormat } from './outliers';
import type { MarketVideo, PublicChannel } from './types';

const NOW = new Date('2026-10-19T00:00:00Z');
const CH = 'UC' + 'c'.repeat(22);
const channel: PublicChannel = { id: CH, title: 'Test channel', thumbnail: null, url: '', subscriberCount: null, videoCount: null };

/** Synthetic test video: `ageDays` old, `views` views, long-form unless `durationSec` says otherwise. */
function video(id: string, ageDays: number, views: number | null, durationSec: number | null = 600): MarketVideo {
  return {
    id,
    channelId: CH,
    title: `Video ${id}`,
    publishedAt: new Date(NOW.getTime() - ageDays * 86_400_000).toISOString(),
    durationSec,
    views,
    likes: null,
    comments: null,
    thumbnailUrl: null,
  };
}

/** A normal channel: 14 long videos 10–140 days old with views between 900 and 1,100. */
const normal = Array.from({ length: 14 }, (_, i) => video(`n${i}`, 10 + i * 10, 900 + (i % 5) * 50));

describe('formats', () => {
  it('treats 3 minutes or less as a likely Short and unknown length as unknown', () => {
    expect(publicFormat(180)).toBe('short');
    expect(publicFormat(181)).toBe('video');
    expect(publicFormat(null)).toBeNull();
  });
});

describe('baselines', () => {
  it('uses same-format videos aged 7–365 days with public views', () => {
    const b = computeBaseline([...normal, video('new', 2, 50_000), video('old', 400, 50_000), video('s', 20, 9, 30), video('hidden', 20, null)], 'video', NOW);
    expect(b.sampleSize).toBe(14);
    expect(b.medianViews).toBe(1000);
    expect(b.strength).toBe('high');
  });

  it('calls a small sample insufficient', () => {
    expect(computeBaseline(normal.slice(0, 5), 'video', NOW).strength).toBe('insufficient');
    expect(computeBaseline(normal.slice(0, 6), 'video', NOW).strength).toBe('medium');
  });
});

describe('outliers', () => {
  it('finds no outliers in a normal channel', () => {
    const { eligible, outliers } = findOutliers(normal, publicBaselines(normal, NOW), 90, NOW, 'Test');
    expect(eligible).toBe(9); // videos 10–90 days old
    expect(outliers).toEqual([]);
  });

  it('flags an extreme video with its numbers', () => {
    const videos = [...normal, video('hit', 15, 9000)];
    const { outliers } = findOutliers(videos, publicBaselines(videos, NOW), 30, NOW, 'Test');
    expect(outliers).toHaveLength(1);
    expect(outliers[0]).toMatchObject({ videoId: 'hit', views: 9000, baselineViews: 1000, ratio: 9, sampleSize: 15, confidence: 'high', format: 'video', ageDays: 15 });
  });

  it('needs both a 2× ratio and a robust z-score: a noisy channel’s 2× video is normal for it', () => {
    const noisy = Array.from({ length: 14 }, (_, i) => video(`x${i}`, 10 + i * 10, [200, 5000, 800, 3000, 400, 1000, 6000][i % 7]));
    const b = publicBaselines(noisy, NOW);
    expect(judgeVideo(video('y', 20, 2400), b, NOW)).toMatchObject({ eligible: true, isOutlier: false });
  });

  it('claims nothing for small samples, too-new videos, or missing values', () => {
    const small = normal.slice(0, 4);
    expect(judgeVideo(video('a', 20, 50_000), publicBaselines(small, NOW), NOW).eligible).toBe(false);
    const b = publicBaselines(normal, NOW);
    expect(judgeVideo(video('b', 3, 50_000), b, NOW).eligible).toBe(false);
    expect(judgeVideo(video('c', 20, null), b, NOW).eligible).toBe(false);
    expect(judgeVideo(video('d', 20, 50_000, null), b, NOW).eligible).toBe(false);
  });

  it('falls back to the ratio, at medium confidence, when every baseline video has the same views', () => {
    const flat = Array.from({ length: 14 }, (_, i) => video(`f${i}`, 10 + i * 10, 1000));
    expect(judgeVideo(video('z', 20, 3000), publicBaselines(flat, NOW), NOW)).toMatchObject({ isOutlier: true, robustZ: null, confidence: 'medium' });
  });

  it('compares Shorts only with Shorts', () => {
    const shorts = Array.from({ length: 8 }, (_, i) => video(`s${i}`, 10 + i * 5, 100_000, 40));
    const videos = [...normal, ...shorts];
    const b = publicBaselines(videos, NOW);
    // 5,000 views is a hit for this channel's long videos but a flop for its Shorts.
    expect(judgeVideo(video('l', 20, 5000), b, NOW).isOutlier).toBe(true);
    expect(judgeVideo(video('t', 20, 5000, 40), b, NOW).isOutlier).toBe(false);
  });
});

describe('channel profile', () => {
  it('summarizes activity, format mix and outlier rate', () => {
    const videos = [...normal, video('hit', 15, 9000), video('short', 5, 300, 50)];
    const { profile } = profileChannel(channel, videos, 30, NOW);
    expect(profile).toMatchObject({ videosRead: 16, uploadsLast30Days: 5, outliersInWindow: 1, eligibleInWindow: 4, coverageDays: 140 });
    expect(profile.uploadsLast90Days).toBe(11);
    expect(profile.medianDaysBetweenUploads).toBe(10);
    expect(profile.shortsShare).toBeCloseTo(1 / 16);
    expect(profile.outlierRate).toBeCloseTo(1 / 4);
    expect(profile.baselines.short.strength).toBe('insufficient');
  });

  it('handles a channel with no videos', () => {
    const { profile, outliers } = profileChannel(channel, [], 30, NOW);
    expect(outliers).toEqual([]);
    expect(profile).toMatchObject({ uploadsLast90Days: 0, medianDaysBetweenUploads: null, outlierRate: null, shortsShare: null, coverageDays: 0 });
  });
});
