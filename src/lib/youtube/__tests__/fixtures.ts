import type { ChannelDataset, PeriodStats, RetentionPoint, VideoMeta } from '../types';

/** A channel shaped like the real API responses seen in the M0 spike (no real data). */
export function makeVideo(i: number, overrides: Partial<VideoMeta> = {}): VideoMeta {
  return {
    id: `vid${String(i).padStart(8, '0')}`,
    title: `Video ${i}`,
    publishedAt: new Date(Date.UTC(2026, 8, 30 - i * 3)).toISOString(),
    durationSec: 600,
    thumbnailUrl: `https://i.ytimg.com/vi/vid${i}/hqdefault.jpg`,
    format: null,
    lifetimeViews: 1000,
    likes: 10,
    comments: 2,
    ...overrides,
  };
}

export function stats(views: number, avgViewPct: number | null = 40): PeriodStats {
  return {
    views,
    minutesWatched: views * 3,
    avgViewDurationSec: views > 0 ? 200 : null,
    avgViewPct: views > 0 ? avgViewPct : null,
    subscribersGained: Math.round(views / 100),
  };
}

/** A curve with steady decay from `start` to `end` over 100 points. */
export function curve(start = 1, end = 0.3, overrides: Record<number, number> = {}): RetentionPoint[] {
  return Array.from({ length: 100 }, (_, i) => ({
    ratio: (i + 1) / 100,
    watchRatio: overrides[i] ?? start - ((start - end) * i) / 99,
    relativePerformance: 0.5,
  }));
}

export function makeDataset(overrides: Partial<ChannelDataset> = {}): ChannelDataset {
  const videos = Array.from({ length: 10 }, (_, i) => makeVideo(i, { format: 'video' }));
  const perVideo = Object.fromEntries(videos.map((v, i) => [v.id, stats(1000 + i * 100)]));
  return {
    range: '28d',
    current: { startDate: '2026-09-19', endDate: '2026-10-16', days: 28 },
    previous: { startDate: '2026-08-22', endDate: '2026-09-18', days: 28 },
    channel: { id: 'UC123', title: 'Test channel', thumbnail: null, url: 'https://www.youtube.com/channel/UC123', subscriberCount: 1000, videoCount: 10 },
    videos,
    daily: { ok: true, data: [] },
    totals: { ok: true, data: { views: 12000, minutesWatched: 36000, avgViewDurationSec: 180, avgViewPct: 40, subscribersGained: 50, subscribersLost: 5 } },
    previousTotals: { ok: true, data: { views: 10000, minutesWatched: 30000, avgViewDurationSec: 170, avgViewPct: 38, subscribersGained: 40, subscribersLost: 5 } },
    perVideo: { ok: true, data: perVideo },
    traffic: { ok: true, data: [{ source: 'SUBSCRIBER', views: 8000, minutesWatched: 20000 }, { source: 'YT_SEARCH', views: 4000, minutesWatched: 10000 }] },
    formatViews: { ok: true, data: { short: 0, video: 12000 } },
    retention: {},
    reach: { ok: true, data: { byVideo: {}, totalImpressions: 0, ctr: null, coveredDays: 0, totalDays: 28, availableFrom: '2026-10-21' } },
    ...overrides,
  };
}
