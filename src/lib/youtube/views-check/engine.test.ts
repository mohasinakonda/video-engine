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
    interactions: { ok: true, data: {} },
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
    expect(report.videos[2].reason).toMatch(/watch this video in every country. That almost always means a copyright claim/);
    expect(report.videos.every((v) => v.cause === 'blocked')).toBe(true);
    expect(report.videos[0].fix).toMatch(/same file/);
    expect(report.verdict.cause).toBe('blocked');
  });

  it('flags country blocks, naming the top viewer countries first', () => {
    const videos = [video(1, 10), video(2, 10), video(3, 10), video(4, 10)];
    const data = dataset(videos);
    if (!data.status.ok) throw new Error();
    data.countries = {
      ok: true,
      data: [
        { country: 'US', views: 50 },
        { country: 'BD', views: 900 },
        { country: 'IN', views: 300 },
        { country: 'FR', views: 10 },
      ],
    };
    data.status.data.v1 = { ...publicStatus(), regionBlocked: ['BD', 'DE'] };
    data.status.data.v2 = { ...publicStatus(), regionAllowed: ['DE', 'FR'] };
    data.status.data.v3 = { ...publicStatus(), regionBlocked: Array.from({ length: 210 }, (_, i) => `C${i}`) };
    data.status.data.v4 = { ...publicStatus(), regionBlocked: ['DE'] };
    const report = analyzeViews(data);
    const find = (id: string) => report.videos.find((v) => v.videoId === id)!;
    expect(report.videos.every((v) => v.cause === 'blocked')).toBe(true);
    expect(find('v1').reason).toMatch(/blocked in Bangladesh, where most of your viewers are/);
    expect(find('v1').evidence).toContain('Blocked in 2 countries in all');
    expect(find('v2').reason).toMatch(/Bangladesh, India, United States/);
    expect(find('v3').reason).toMatch(/210 countries, almost everywhere/);
    expect(find('v3').reason).toMatch(/almost always means a copyright claim/);
    expect(find('v3').evidence).toContain('Likely cause: copyright claim');
    expect(find('v4').evidence).not.toContain('Likely cause: copyright claim');
    expect(find('v4').reason).toMatch(/blocked in Germany, so people there can’t watch it/);
    expect(report.videos.map((v) => v.countryBlock)).toEqual([true, true, true, true]);
  });

  it('flags a country block even when the viewer countries are unknown', () => {
    const data = dataset([video(1, 10)]);
    if (!data.status.ok) throw new Error();
    data.countries = { ok: false, reason: 'no data' };
    data.status.data.v1 = { ...publicStatus(), regionBlocked: ['BD'] };
    expect(causeOf(analyzeViews(data), 'v1')).toBe('blocked');
    data.status.data.v1 = publicStatus();
    expect(analyzeViews(data).videos[0].countryBlock).toBe(false);
    data.status = { ok: false, reason: 'no data' };
    expect(analyzeViews(data).videos[0].countryBlock).toBeNull();
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
    expect(report.videos[0].evidence[0]).toMatch(/Shown 0 times in 11 reported days/);
  });

  it('says "unknown" instead of guessing when impressions are not available yet', () => {
    const data = dataset([video(1, 10, { lifetimeViews: 0 })], { reach: { ok: false, reason: 'Not ready' } });
    expect(causeOf(analyzeViews(data), 'v1')).toBe('unknown');
  });

  it('does not call a long video fine when impressions are missing', () => {
    const data = dataset([video(1, 10, { lifetimeViews: 15 })], { reach: { ok: false, reason: 'Not ready' } });
    if (!data.perVideo.ok) throw new Error();
    data.perVideo.data.v1 = stats(15, 60);
    const finding = analyzeViews(data).videos[0];
    expect(finding.cause).toBe('unknown');
    expect(finding.reason).toMatch(/can’t tell if it was barely shown/);
  });

  it('uses average % viewed when a long video has no retention curve', () => {
    const data = dataset([video(1, 10, { lifetimeViews: 15, durationSec: 300 })], { reach: { ok: false, reason: 'Not ready' } });
    if (!data.perVideo.ok) throw new Error();
    data.perVideo.data.v1 = { ...stats(15, 18), avgViewDurationSec: 54 };
    const finding = analyzeViews(data).videos[0];
    expect(finding.cause).toBe('left_early');
    expect(finding.evidence[0]).toBe('Watched 18% of the video on average (54s of 5:00)');
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
    expect(finding.reason).toMatch(/liked it as much as similar Shorts/);
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
    expect(finding.cause).toBe('weak_hook');
    expect(finding.reason).toMatch(/^The hook lost them: 70 of every 100 viewers swiped away/);
    expect(finding.evidence).toEqual(expect.arrayContaining(['Watched 12s of 40s on average', 'Half the viewers gone by 0:02']));
    // Studio's scale: 40% of views are still watching at the end.
    const t = report.shorts[0];
    expect(t.completion?.ofViews).toBeCloseTo(0.4);
    expect(t.completion?.ofStarted).toBeCloseTo(0.4 / 0.45);
    expect(finding.fix).toMatch(/first 1–2 seconds/);
    expect(finding.fix).toMatch(/make the next one about 15 seconds/);
    expect(report.verdict.headline).toMatch(/^Your hook loses about 70 of every 100 viewers/);
    expect(report.verdict.firstStep).toMatch(/^Start with “Video number 1/);
  });

  it('explains a weak Short on a new topic as a topic switch, with steps and topic summary', () => {
    const older = [1, 2, 3, 4].map((i) => video(i, 20 + i, { format: 'short', durationSec: 25, lifetimeViews: 1000 }));
    const newer = video(5, 10, { format: 'short', durationSec: 25, lifetimeViews: 90 });
    const videos = [newer, ...older];
    const data = dataset(videos, {
      engaged: { ok: true, data: { v5: 20, v1: 700, v2: 700, v3: 700, v4: 700 } },
      topics: [
        { name: 'Car fixes', videoIds: ['v1', 'v2', 'v3', 'v4'] },
        { name: 'Gaming', videoIds: ['v5'] },
      ],
    });
    if (!data.perVideo.ok) throw new Error();
    for (const v of videos) data.perVideo.data[v.id] = stats(v.lifetimeViews ?? 0, 60);
    const report = analyzeViews(data);
    const finding = report.videos.find((f) => f.videoId === 'v5');
    expect(finding?.cause).toBe('new_topic');
    expect(report.topics[0]).toMatchObject({ name: 'Car fixes', shorts: 4, medianViews: 1000 });
    const t = report.shorts.find((s) => s.videoId === 'v5');
    expect(t?.topic).toBe('Gaming');
    expect(t?.gates?.[1].state).toBe('fail');
    expect(report.stopPoints.find((s) => s.gate === 'stopped')?.count).toBeGreaterThanOrEqual(1);
  });

  it('carries likes, comments and shares for each Short', () => {
    const v = video(1, 10, { format: 'short', durationSec: 25, lifetimeViews: 100 });
    const data = dataset([v], { interactions: { ok: true, data: { v1: { likes: 12, comments: 3, shares: 1 } } } });
    expect(analyzeViews(data).shorts[0].interactions).toEqual({ likes: 12, comments: 3, shares: 1 });
    const missing = dataset([v], { interactions: { ok: false, reason: 'x' } });
    expect(analyzeViews(missing).shorts[0].interactions).toBeNull();
  });

  it('fills swipe-away for a Short that was not looked at in depth', () => {
    const v = video(1, 10, { format: 'short', durationSec: 25, lifetimeViews: 100 });
    const data = dataset([v], { engaged: { ok: true, data: { v1: 40 } } });
    if (!data.perVideo.ok) throw new Error();
    data.perVideo.data.v1 = stats(100, 137);
    const t = analyzeViews(data).shorts.find((s) => s.videoId === 'v1');
    expect(t?.estSwipeAway).toBeCloseTo(0.6);
    expect(t?.completion).toBeNull();
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
          50,
        ),
      ]),
    );
    const data = dataset(shorts, { deepDives });
    if (!data.perVideo.ok) throw new Error();
    for (const s of shorts) data.perVideo.data[s.id] = stats(1000, 70);
    const report = analyzeViews(data);
    // v1: 60% swiped vs a median of about 23%.
    expect(causeOf(report, 'v1')).toBe('weak_hook');
    expect(report.videos.find((f) => f.videoId === 'v1')?.evidence[0]).toMatch(/^60 of every 100 viewers swiped away .* \(your typical Short: 23\)/);
    expect(causeOf(report, 'v2')).toBe('ok');
  });

  it('points at the real exit moment when viewers stay through the opening (Studio-like curve)', () => {
    // Like "Cheap Kit" (0:23): ~113% at the start (rewatches), flat to 0:04, then a steep fall.
    const v = video(1, 10, { format: 'short', durationSec: 23, lifetimeViews: 1000 });
    const watch = [1.13, 1.13, 1.12, 1.12, 0.95, 0.7, 0.55, 0.45, 0.38, 0.3, 0.27, 0.25, 0.24, 0.22, 0.21, 0.2, 0.19, 0.18, 0.16, 0.15, 0.15, 0.14, 0.14];
    const curve = watch.map((w, i) => ({ ratio: (i + 1) / 23, watchRatio: w, relativePerformance: 0.44 }));
    const daily: DayViews[] = [
      { date: '2026-10-21', views: 500, engagedViews: 105 },
      { date: '2026-10-22', views: 500, engagedViews: 105 },
    ];
    const finding = analyzeViews(dataset([v], { deepDives: { v1: dive(daily, 950, 50, curve) } })).videos[0];
    expect(finding.cause).toBe('weak_hook');
    expect(finding.reason).toMatch(/79 of every 100 viewers swiped away/);
    expect(finding.reason).toMatch(/get past the start, then most leave between 0:05 and 0:07/);
    expect(finding.fix).toMatch(/show the best part before 0:05/);
    const t = analyzeViews(dataset([v], { deepDives: { v1: dive(daily, 950, 50, curve) } })).shorts[0];
    expect(t.completion?.ofViews).toBeCloseTo(0.14, 1);
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
      // Few swipes (23%), so the hook works; the retention is what's weak.
      { date: '2026-10-21', views: 900, engagedViews: 700 },
      { date: '2026-10-22', views: 100, engagedViews: 70 },
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
    expect(report.verdict.headline).toMatch(/2 of your 3 videos/);
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
    const videos = Array.from({ length: 45 }, (_, i) => video(i, Math.floor(i / 4), { title: `Amazing car cleaning product review part ${i}` }));
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
    expect(report.limitations.some((l) => l.includes('per day (not per hour)'))).toBe(true);
  });

  it('keeps the plan to at most 5 distinct steps', () => {
    const videos = Array.from({ length: 10 }, (_, i) => video(i, 10 + i, { lifetimeViews: 0 }));
    const plan = analyzeViews(dataset(videos)).plan;
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(new Set(plan).size).toBe(plan.length);
  });
});

describe('analyzeViews: 0-view and channel-health rules', () => {
  const ids = (report: ReturnType<typeof analyzeViews>) => report.signals.map((s) => s.id);
  /** Distinct titles and lengths, a day apart: none of the new rules should fire. */
  const spaced = () =>
    [1, 2, 3, 4].map((i) => video(i, 10 + i, { title: ['Fixing a bike chain', 'Best budget tent', 'How to fold a shirt', 'Cooking rice fast'][i - 1], durationSec: 300 + i * 40 }));

  it('flags a video that is still processing or scheduled', () => {
    const data = dataset([video(1, 10), video(2, 10, { title: 'Another thing entirely' })]);
    if (!data.status.ok) throw new Error();
    data.status.data.v1 = { ...publicStatus(), uploadStatus: 'uploaded' };
    data.status.data.v2 = { ...publicStatus(), privacyStatus: 'private', publishAt: '2026-11-20T15:00:00Z' };
    const report = analyzeViews(data);
    expect(report.videos[0].reason).toMatch(/still processing/);
    expect(report.videos[1].reason).toMatch(/scheduled to go public on 20 Nov 2026 15:00 UTC/);
    expect(report.videos.every((v) => v.cause === 'blocked')).toBe(true);
  });

  it('none of the new rules fire on a normal channel', () => {
    const report = analyzeViews(dataset(spaced(), { channelCreatedAt: '2025-01-01T00:00:00Z', firstUploadAt: '2025-03-01T00:00:00Z', longUploadsStatus: 'allowed' }));
    expect(ids(report)).not.toEqual(expect.arrayContaining(['upload_burst']));
    for (const id of ['upload_burst', 're_upload', 'unclear_titles', 'no_warmup', 'not_verified', 'standing_risk']) expect(ids(report)).not.toContain(id);
  });

  it('flags 3 uploads within an hour', () => {
    const videos = spaced();
    const base = Date.parse(videos[0].publishedAt);
    videos[1].publishedAt = new Date(base + 10 * 60_000).toISOString();
    videos[2].publishedAt = new Date(base + 40 * 60_000).toISOString();
    expect(ids(analyzeViews(dataset(videos)))).toContain('upload_burst');
  });

  it('flags the same video uploaded again (same length, near-identical title)', () => {
    const videos = spaced();
    videos[2] = { ...videos[2], title: 'Fixing a bike chain!', durationSec: videos[0].durationSec };
    const report = analyzeViews(dataset(videos));
    expect(ids(report)).toContain('re_upload');
    expect(report.signals.find((s) => s.id === 're_upload')?.severity).toBe('high');
  });

  it('flags titles that are only hashtags or a file name', () => {
    const videos = spaced();
    videos[0].title = '#viral #fyp #shorts';
    videos[1].title = 'VID_20261101.mp4';
    const signal = analyzeViews(dataset(videos)).signals.find((s) => s.id === 'unclear_titles');
    expect(signal?.detail).toMatch(/^2 recent titles are only hashtags or a file name/);
  });

  it('flags uploads that started within a week of creating the channel', () => {
    const report = analyzeViews(dataset(spaced(), { channelCreatedAt: '2026-06-01T00:00:00Z', firstUploadAt: '2026-06-03T09:00:00Z' }));
    expect(report.signals.find((s) => s.id === 'no_warmup')?.detail).toMatch(/2 days after the channel was created/);
  });

  it('reads verification and standing from the long-upload status', () => {
    expect(ids(analyzeViews(dataset(spaced(), { longUploadsStatus: 'eligible' })))).toContain('not_verified');
    const report = analyzeViews(dataset(spaced(), { longUploadsStatus: 'disallowed' }));
    expect(report.signals.find((s) => s.id === 'standing_risk')?.severity).toBe('high');
  });
});
