import { describe, expect, it } from 'vitest';
import type { PeriodStats, RetentionPoint, VideoMeta } from '../types';
import { analyzeViews } from './engine';
import type { DayViews, VideoDeepDive, VideoStatus, ViewsCheckDataset } from './types';

const PERIOD = { startDate: '2026-08-03', endDate: '2026-10-31', days: 90 };
const COLLECTED = '2026-11-03T12:00:00Z';

/** A video published `daysAgo` days before the last reported day (2026-10-31). */
function video(i: number, daysAgo: number, overrides: Partial<VideoMeta> = {}): VideoMeta {
  const published = new Date(Date.parse('2026-10-31T00:00:00Z') - daysAgo * 86_400_000).toISOString();
  return {
    id: `v${i}`,
    title: `Video number ${i} about topic ${i}`,
    publishedAt: published,
    durationSec: 600,
    thumbnailUrl: null,
    format: 'video',
    lifetimeViews: 500,
    likes: 20,
    comments: 3,
    ...overrides,
  };
}

const stats = (views: number, avgViewPct: number | null = 45, subscribersGained = 5): PeriodStats => ({
  views,
  minutesWatched: views * 2,
  avgViewDurationSec: views ? 120 : null,
  avgViewPct: views ? avgViewPct : null,
  subscribersGained,
});

const publicStatus = (): VideoStatus => ({
  uploadStatus: 'processed',
  failureReason: null,
  rejectionReason: null,
  privacyStatus: 'public',
  madeForKids: false,
  regionAllowed: null,
  regionBlocked: null,
  ageRestricted: false,
});

const flatCurve = (watch: number, relative: number | null = 0.5): RetentionPoint[] =>
  Array.from({ length: 20 }, (_, i) => ({ ratio: (i + 1) / 20, watchRatio: watch, relativePerformance: relative }));

function dive(daily: DayViews[], shortsViews: number, otherViews: number, retention: RetentionPoint[] = flatCurve(0.8)): VideoDeepDive {
  return {
    daily: { ok: true, data: daily },
    traffic: {
      ok: true,
      data: [
        { source: 'SHORTS', views: shortsViews, minutesWatched: null },
        { source: 'EXT_URL', views: otherViews, minutesWatched: null },
      ],
    },
    retention: { ok: true, data: retention },
  };
}

function dataset(videos: VideoMeta[], overrides: Partial<ViewsCheckDataset> = {}): ViewsCheckDataset {
  return {
    channel: { id: 'UC1', title: 'Test', thumbnail: null, url: '', subscriberCount: 10, videoCount: videos.length },
    channelLanguage: 'en',
    period: PERIOD,
    videos,
    status: { ok: true, data: Object.fromEntries(videos.map((v) => [v.id, publicStatus()])) },
    perVideo: { ok: true, data: Object.fromEntries(videos.map((v) => [v.id, stats(v.lifetimeViews ?? 0)])) },
    engaged: { ok: true, data: {} },
    reach: {
      ok: true,
      data: {
        byVideo: Object.fromEntries(videos.map((v) => [v.id, { impressions: 2000, ctr: 0.05 }])),
        totalImpressions: 2000 * videos.length,
        ctr: 0.05,
        coveredDays: 90,
        totalDays: 90,
        availableFrom: null,
      },
    },
    countries: { ok: true, data: [] },
    deepDives: {},
    collectedAt: COLLECTED,
    ...overrides,
  };
}

const causeOf = (report: ReturnType<typeof analyzeViews>, id: string) => report.videos.find((v) => v.videoId === id)?.cause;

describe('analyzeViews: per video', () => {
  it('flags rejected, private, region-blocked and age-restricted videos as blocked', () => {
    const videos = [video(1, 10), video(2, 10), video(3, 10), video(4, 10)];
    const data = dataset(videos);
    if (!data.status.ok) throw new Error();
    data.status.data.v1 = { ...publicStatus(), uploadStatus: 'rejected', rejectionReason: 'duplicate' };
    data.status.data.v2 = { ...publicStatus(), privacyStatus: 'unlisted' };
    data.status.data.v3 = { ...publicStatus(), regionAllowed: [] };
    data.status.data.v4 = { ...publicStatus(), ageRestricted: true };
    const report = analyzeViews(data);
    expect(report.videos.every((v) => v.cause === 'blocked')).toBe(true);
    expect(report.videos[0].fix).toMatch(/same file/);
    expect(report.verdict.cause).toBe('blocked');
  });

  it('only flags Made for Kids on a channel that is mostly not for kids', () => {
    const videos = [video(1, 10), video(2, 10), video(3, 10)];
    const data = dataset(videos);
    if (!data.status.ok) throw new Error();
    data.status.data.v1 = { ...publicStatus(), madeForKids: true };
    expect(causeOf(analyzeViews(data), 'v1')).toBe('blocked');
    for (const v of videos) data.status.data[v.id] = { ...publicStatus(), madeForKids: true };
    expect(causeOf(analyzeViews(data), 'v1')).not.toBe('blocked');
  });

  it('leaves videos with fewer than 3 reported days out of the verdict', () => {
    const data = dataset([video(1, 1), video(2, 0)]);
    const report = analyzeViews(data);
    expect(report.videos.map((v) => v.cause)).toEqual(['too_new', 'too_new']);
    expect(report.verdict.cause).toBe('not_enough_data');
    expect(report.summary.tooNew).toBe(2);
  });

  it('calls a long video with 0 impressions "not shown"', () => {
    const data = dataset([video(1, 10, { lifetimeViews: 0 })]);
    if (!data.reach.ok) throw new Error();
    data.reach.data.byVideo = {};
    const report = analyzeViews(data);
    expect(causeOf(report, 'v1')).toBe('not_shown');
    expect(report.videos[0].evidence[0]).toMatch(/0 impressions in 11 reported days/);
  });

  it('says "unknown" instead of guessing when impressions are not available yet', () => {
    const data = dataset([video(1, 10, { lifetimeViews: 0 })], { reach: { ok: false, reason: 'Not ready' } });
    expect(causeOf(analyzeViews(data), 'v1')).toBe('unknown');
  });

  it('flags low CTR only with enough impressions', () => {
    const data = dataset([video(1, 10), video(2, 10)]);
    if (!data.reach.ok) throw new Error();
    data.reach.data.byVideo.v1 = { impressions: 5000, ctr: 0.012 };
    data.reach.data.byVideo.v2 = { impressions: 40, ctr: 0.0 };
    const report = analyzeViews(data);
    expect(causeOf(report, 'v1')).toBe('not_clicked');
    expect(causeOf(report, 'v2')).toBe('ok');
  });

  it('flags long videos most viewers leave in the first 30 seconds', () => {
    const v = video(1, 10, { durationSec: 600 });
    const curve = flatCurve(0.8);
    curve[0] = { ratio: 0.05, watchRatio: 0.4, relativePerformance: 0.5 };
    const data = dataset([v], { deepDives: { v1: dive([], 0, 0, curve) } });
    expect(causeOf(analyzeViews(data), 'v1')).toBe('left_early');
  });

  it('calls a Short with 0 views "not shown"', () => {
    const v = video(1, 10, { format: 'short', durationSec: 40, lifetimeViews: 0 });
    expect(causeOf(analyzeViews(dataset([v])), 'v1')).toBe('not_shown');
  });

  it('flags a Short whose views do not come from the Shorts feed', () => {
    const v = video(1, 10, { format: 'short', durationSec: 40, lifetimeViews: 100 });
    const data = dataset([v], { deepDives: { v1: dive([{ date: '2026-10-21', views: 100, engagedViews: 60 }], 2, 98) } });
    expect(causeOf(analyzeViews(data), 'v1')).toBe('not_in_feed');
  });

  it('explains a Short that held viewers but stopped after two days as a lost competition', () => {
    const v = video(1, 10, { format: 'short', durationSec: 40, lifetimeViews: 1000 });
    const daily: DayViews[] = [
      { date: '2026-10-21', views: 700, engagedViews: 500 },
      { date: '2026-10-22', views: 200, engagedViews: 140 },
      { date: '2026-10-23', views: 60, engagedViews: 40 },
      { date: '2026-10-24', views: 40, engagedViews: 20 },
    ];
    const data = dataset([v], { deepDives: { v1: dive(daily, 950, 50, flatCurve(0.8, 0.6)) } });
    if (!data.perVideo.ok) throw new Error();
    data.perVideo.data.v1 = stats(1000, 85);
    const report = analyzeViews(data);
    const finding = report.videos[0];
    expect(finding.cause).toBe('quick_stop');
    expect(finding.reason).toMatch(/kept viewers as well as similar Shorts/);
    expect(finding.reason).toMatch(/Day 1: 700 views, day 2: 200/);
    expect(finding.evidence[0]).toBe('90% of its views came in the first 2 days');
    expect(report.shorts[0].shortsFeedShare).toBeCloseTo(0.95);
    // 700 engaged of 1,000 plays → about 30% swiped away.
    expect(report.shorts[0].estSwipeAway).toBeCloseTo(0.3);
  });

  it('estimates swipe-away from engaged views and flags a weak first second with numbers', () => {
    const v = video(1, 10, { format: 'short', durationSec: 40, lifetimeViews: 1000 });
    const daily: DayViews[] = [
      { date: '2026-10-21', views: 800, engagedViews: 240 },
      { date: '2026-10-22', views: 200, engagedViews: 60 },
    ];
    const curve = Array.from({ length: 20 }, (_, i) => ({ ratio: (i + 1) / 20, watchRatio: i === 0 ? 0.45 : 0.4, relativePerformance: 0.5 }));
    const data = dataset([v], { deepDives: { v1: dive(daily, 950, 50, curve) } });
    if (!data.perVideo.ok) throw new Error();
    data.perVideo.data.v1 = { ...stats(1000, 70), avgViewDurationSec: 12 };
    const report = analyzeViews(data);
    const finding = report.videos[0];
    expect(finding.cause).toBe('left_early');
    expect(finding.reason).toMatch(/about 70% of plays, estimated/);
    expect(finding.evidence).toEqual(expect.arrayContaining(['Watched 12s of 40s on average', 'Half the viewers gone by 0:02']));
    expect(finding.fix).toMatch(/first 1–2 seconds/);
    expect(finding.fix).toMatch(/try a 15-second version/);
    expect(report.verdict.headline).toMatch(/about 70% of plays on average \(estimate\)/);
    expect(report.verdict.firstStep).toMatch(/^Start with “Video number 1/);
  });

  it('compares a Short’s swipe-away with the channel’s own median', () => {
    const shorts = [1, 2, 3, 4].map((i) => video(i, 10 + i, { format: 'short', durationSec: 30, lifetimeViews: 1000 }));
    const engaged = { v1: 400, v2: 800, v3: 780, v4: 760 };
    // Steady views over four days, so no Short looks like a quick stop.
    const deepDives = Object.fromEntries(
      shorts.map((s) => [
        s.id,
        dive(
          ['2026-10-20', '2026-10-22', '2026-10-24', '2026-10-26'].map((date) => ({ date, views: 250, engagedViews: engaged[s.id as keyof typeof engaged] / 4 })),
          950,
          50
        ),
      ])
    );
    const data = dataset(shorts, { deepDives });
    if (!data.perVideo.ok) throw new Error();
    for (const s of shorts) data.perVideo.data[s.id] = stats(1000, 70);
    const report = analyzeViews(data);
    // v1: 60% swiped vs a median of about 23%.
    expect(causeOf(report, 'v1')).toBe('left_early');
    expect(report.videos.find((f) => f.videoId === 'v1')?.evidence[0]).toMatch(/About 60% of plays swiped away .* \(your Shorts’ median: 23%\)/);
    expect(causeOf(report, 'v2')).toBe('ok');
  });

  it('names the biggest drop later in a Short', () => {
    const v = video(1, 10, { format: 'short', durationSec: 40, lifetimeViews: 1000 });
    const curve = Array.from({ length: 20 }, (_, i) => ({ ratio: (i + 1) / 20, watchRatio: i < 4 ? 0.9 : 0.3, relativePerformance: 0.3 }));
    const data = dataset([v], { deepDives: { v1: dive([{ date: '2026-10-21', views: 1000, engagedViews: 800 }], 950, 50, curve) } });
    const finding = analyzeViews(data).videos[0];
    expect(finding.cause).toBe('left_early');
    expect(finding.reason).toMatch(/leave at 0:10/);
    expect(finding.fix).toMatch(/Most viewers left at 0:10: cut or speed up/);
  });

  it('prefers "left early" over "quick stop" when retention is weak', () => {
    const v = video(1, 10, { format: 'short', durationSec: 40, lifetimeViews: 1000 });
    const daily: DayViews[] = [
      { date: '2026-10-21', views: 900, engagedViews: 300 },
      { date: '2026-10-22', views: 100, engagedViews: 30 },
    ];
    const data = dataset([v], { deepDives: { v1: dive(daily, 950, 50, flatCurve(0.3, 0.2)) } });
    if (!data.perVideo.ok) throw new Error();
    data.perVideo.data.v1 = stats(1000, 30);
    expect(causeOf(analyzeViews(data), 'v1')).toBe('left_early');
  });

  it('falls back to duration for the format when YouTube has no format yet', () => {
    const v = video(1, 10, { format: null, durationSec: 30, lifetimeViews: 0 });
    expect(analyzeViews(dataset([v])).videos[0].format).toBe('short');
  });
});

describe('analyzeViews: verdict and channel signals', () => {
  it('calls a channel-wide stop when most recent uploads are not shown', () => {
    const videos = [1, 2, 3, 4].map((i) => video(i, 10 + i, { lifetimeViews: 0 }));
    const data = dataset(videos);
    if (!data.reach.ok) throw new Error();
    data.reach.data.byVideo = {};
    const report = analyzeViews(data);
    expect(report.verdict.cause).toBe('channel_wide_stop');
    expect(report.signals[0].id).toBe('channel_wide_stop');
    expect(report.plan[0]).toMatch(/Studio/);
  });

  it('ranks the most common problem first, breaking ties by severity', () => {
    const videos = [video(1, 10), video(2, 10), video(3, 10)];
    const data = dataset(videos);
    if (!data.reach.ok) throw new Error();
    data.reach.data.byVideo.v1 = { impressions: 5000, ctr: 0.01 };
    data.reach.data.byVideo.v2 = { impressions: 5000, ctr: 0.01 };
    const report = analyzeViews(data);
    expect(report.verdict.cause).toBe('not_clicked');
    expect(report.verdict.headline).toMatch(/2 of 3/);
  });

  it('reports a healthy channel plainly', () => {
    const report = analyzeViews(dataset([video(1, 10), video(2, 20)]));
    expect(report.verdict.cause).toBe('ok');
    expect(report.plan.length).toBeGreaterThan(0);
  });

  it('spots double-posting, hashtags in titles and the Shorts vs long-video gap', () => {
    const videos = [
      video(1, 5, { format: 'short', durationSec: 30, title: 'CERAKOTE headlight restoration kit test #shorts', lifetimeViews: 2000 }),
      video(2, 6, { format: 'video', durationSec: 25, title: 'CERAKOTE headlight restoration kit test #cardetailing', lifetimeViews: 20 }),
      video(3, 7, { format: 'short', durationSec: 30, title: 'Tire shine in 10 seconds', lifetimeViews: 1500 }),
      video(4, 8, { format: 'video', durationSec: 90, title: 'Mini vacuum review', lifetimeViews: 15 }),
    ];
    const ids = analyzeViews(dataset(videos)).signals.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['double_post', 'hashtags_in_titles', 'no_long_videos', 'format_gap']));
  });

  it('warns about many near-identical uploads in two weeks as a risk', () => {
    const videos = Array.from({ length: 45 }, (_, i) =>
      video(i, Math.floor(i / 4), { title: `Amazing car cleaning product review part ${i}` })
    );
    const signal = analyzeViews(dataset(videos)).signals.find((s) => s.id === 'mass_produced_risk');
    expect(signal?.title).toMatch(/^Risk/);
  });

  it('spots a sudden drop on the last five uploads', () => {
    const videos = Array.from({ length: 10 }, (_, i) => video(i, 10 + i * 3, { lifetimeViews: i < 5 ? 20 : 1000 }));
    expect(analyzeViews(dataset(videos)).signals.map((s) => s.id)).toContain('sudden_drop');
  });

  it('lists Shorts-only Studio checks only when the channel has Shorts', () => {
    const longOnly = analyzeViews(dataset([video(1, 10)])).studioChecks.map((c) => c.id);
    expect(longOnly).not.toContain('viewed_vs_swiped');
    const withShort = analyzeViews(dataset([video(1, 10, { format: 'short', durationSec: 30 })])).studioChecks.map((c) => c.id);
    expect(withShort).toEqual(expect.arrayContaining(['viewed_vs_swiped', 'shown_in_feed']));
  });

  it('turns missing data sources into limitations, never into findings', () => {
    const report = analyzeViews(dataset([video(1, 10)], { engaged: { ok: false, reason: 'engaged views is not available.' } }));
    expect(report.limitations).toContain('engaged views is not available.');
    expect(report.limitations.some((l) => l.includes('per day, not per hour'))).toBe(true);
  });

  it('keeps the plan to at most 5 distinct steps', () => {
    const videos = Array.from({ length: 10 }, (_, i) => video(i, 10 + i, { lifetimeViews: 0 }));
    const plan = analyzeViews(dataset(videos)).plan;
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(new Set(plan).size).toBe(plan.length);
  });
});
