import { describe, expect, it } from 'vitest';
import { shortTest, testAgreement, testRounds } from './test-score';
import type { ShortTimeline } from './types';

const short = (id: string, views: number, stayed: number, watchedPct: number, likes: number, shares = 0, subs: number | null = null, day1: number | null = null): ShortTimeline =>
  ({
    videoId: id,
    views,
    engagedRate: stayed,
    avgViewPct: watchedPct,
    interactions: { likes, comments: 0, shares },
    subscribersGained: subs,
    day1Views: day1,
  }) as ShortTimeline;

// Wildlife-like channel: one Short held viewers better and got far more views.
const channel = [
  short('whale', 6956, 0.56, 80, 120, 40, 20, 4000),
  short('beaver', 1615, 0.48, 70, 25, 6, 4),
  short('stingray', 1343, 0.42, 68, 18, 4, 3),
  short('fish', 1277, 0.38, 65, 6, 2, 1, 900),
  short('crab', 400, 0.25, 60, 2, 0, 0),
];

/** Four identical Shorts: the usual one. 1,000 views, 400 engaged, 60% viewed, 20 likes, 4 shares, 2 subscribers. */
const usual = Array.from({ length: 4 }, (_, i) => short(`u${i}`, 1000, 0.4, 60, 20, 4, 2));

describe('Trust Score (YRDS)', () => {
  it('scores 50 for a Short exactly like the usual one', () => {
    expect(shortTest(short('x', 1000, 0.4, 60, 20, 4, 2), [...usual], null)!.score).toBe(50);
  });

  it('scores 100 at twice the usual on every metric, and never more', () => {
    // Twice the engaged views, so twice the likes, shares and subscribers keep each rate per engaged view at 2×.
    expect(shortTest(short('x', 1000, 0.8, 120, 80, 16, 8), usual, null)!.score).toBe(100);
    expect(shortTest(short('x', 1000, 0.8, 180, 120, 24, 12), usual, null)!.score).toBe(100);
  });

  it('weighs each metric: only viewed at 2× → 0.35 × 100 + 0.65 × 50', () => {
    const t = shortTest(short('x', 1000, 0.8, 60, 40, 8, 4), usual, null)!;
    expect(t.signals.map((s) => [s.id, Math.round(s.score)])).toEqual([
      ['viewed', 100],
      ['watched', 50],
      ['shares', 50],
      ['likes', 50],
      ['subscribed', 50],
    ]);
    expect(t.score).toBe(68);
  });

  it('rates shares, likes and subscribers per engaged view', () => {
    const t = shortTest(short('x', 1000, 0.4, 60, 20, 4, 2), usual, null)!;
    expect(t.signals.find((s) => s.id === 'likes')?.value).toBeCloseTo(20 / 400);
    expect(t.signals.find((s) => s.id === 'shares')?.value).toBeCloseTo(4 / 400);
    expect(t.signals.find((s) => s.id === 'subscribed')?.value).toBeCloseTo(2 / 400);
  });

  it('when the usual Short got none (median 0), any is the top score and none is usual', () => {
    const noShares = Array.from({ length: 4 }, (_, i) => short(`u${i}`, 1000, 0.4, 60, 20, 0, 2));
    expect(shortTest(short('x', 1000, 0.4, 60, 20, 3, 2), noShares, null)!.signals.find((s) => s.id === 'shares')?.score).toBe(100);
    expect(shortTest(short('x', 1000, 0.4, 60, 20, 0, 2), noShares, null)!.signals.find((s) => s.id === 'shares')?.score).toBe(50);
  });

  it('leaves out a metric it can’t read and shares its weight', () => {
    const noSubs = Array.from({ length: 4 }, (_, i) => short(`u${i}`, 1000, 0.4, 60, 20, 4, null));
    const t = shortTest(short('x', 1000, 0.4, 60, 20, 4, null), noSubs, null)!;
    expect(t.signals.map((s) => s.id)).not.toContain('subscribed');
    expect(t.score).toBe(50);
  });

  it('needs 3 other Shorts for a median', () => {
    expect(shortTest(short('x', 1000, 0.4, 60, 20, 4, 2), usual.slice(0, 2), null)).toBeNull();
  });

  it('above the usual Short for the one viewers held on to', () => {
    const t = shortTest(channel[0], channel, 1343)!;
    expect(t.result).toBe('passed');
    expect(t.score).toBeGreaterThan(60);
    expect(t.message).toMatch(/liked it more than your usual Short/);
  });

  it('below the usual Short when most swiped away, and names that', () => {
    // Viewed at half the usual alone costs 0.35 × 25 points: 41, near the usual. Watched at half too: 34, below.
    expect(shortTest(short('x', 1000, 0.2, 60, 10, 2, 1), usual, null)!.score).toBe(41);
    const t = shortTest(short('x', 1000, 0.2, 30, 10, 2, 1), usual, null)!;
    expect(t.score).toBe(34);
    expect(t.result).toBe('failed');
    expect(t.weakest).toBe('viewed');
    expect(t.message).toMatch(/80% swiped it away in the first seconds \(your usual Short: 60% swiped away\)/);
    expect(t.fix).toMatch(/first second/);
  });

  it('points outside the video when viewers liked it but views stayed low', () => {
    const t = shortTest(short('new', 300, 0.6, 85, 40, 10, 5), channel, 1343)!;
    expect(t.result).toBe('passed');
    expect(t.message).toMatch(/reason is likely outside the video/);
  });

  it('measures how well the score ranks the channel’s own Shorts', () => {
    const scored = channel.map((t) => ({ views: t.views, score: shortTest(t, channel, 1343)!.score }));
    const check = testAgreement(scored)!;
    expect(check.pairs).toBeGreaterThanOrEqual(3);
    expect(check.agreed).toBe(check.pairs);
  });
});

describe('test rounds (one per day)', () => {
  const PUB = '2026-08-27T15:00:00Z';
  const day = (i: number, views: number, stayed: number, per100 = 2, pct = 70) => ({
    date: new Date(Date.parse('2026-08-27') + i * 86_400_000).toISOString().slice(0, 10),
    views,
    engagedViews: Math.round(views * stayed),
    likes: Math.round((views * per100) / 100),
    comments: 0,
    shares: 0,
    avgViewPct: pct,
  });

  it('passes day 1 above the usual first day, fails day 2 and 3 when views fall (the whale Short)', () => {
    // Real views: 3,737 → 1,540 → 1,092 → 242 → …
    const views = [3737, 1540, 1092, 242, 145, 36, 0, 0, 0, 4, 0, 1];
    const rates: [number, number][] = [
      [0.58, 1.2],
      [0.56, 0.5],
      [0.5, 0.4],
    ];
    const daily = views.map((v, i) => day(i, v, rates[i]?.[0] ?? 0.5, rates[i]?.[1] ?? 0.4));
    const r = testRounds(daily, PUB, 74, null, 900)!;
    expect(r.rounds.map((x) => x.state)).toEqual(['pass', 'fail', 'fail']);
    expect(r.rounds.map((x) => x.rates?.views)).toEqual([3737, 1540, 1092]);
    expect(r.failedAt).toBe(2);
    expect(r.dropped).toBe('reacted');
    expect(r.message).toMatch(/Day 1 passed \(3,737 views; your usual first day: 900\)\. Day 2 didn’t grow: 1,540 views, 41% of day 1/);
    expect(r.message).toMatch(/On day 2, engagement fell: 0.5%, down from 1.2% on day 1/);
  });

  it('fails day 1 under the usual first day, and compares the first viewers with the usual Short', () => {
    const daily = [day(0, 300, 0.3), day(1, 400, 0.3), day(2, 10, 0.3)];
    const r = testRounds(daily, PUB, 10, shortTest(channel[4], channel, 1343), 900)!;
    expect(r.rounds.map((x) => x.state)).toEqual(['fail', 'pass', 'fail']);
    expect(r.failedAt).toBe(1);
    expect(r.dropped).toBe('stayed');
    expect(r.message).toMatch(/Day 1 got 300 views, under your usual first day \(900\)/);
  });

  it('passes all rounds only when views grow every day', () => {
    const daily = [day(0, 1000, 0.7), day(1, 2000, 0.7), day(2, 2500, 0.7), day(3, 2400, 0.7)];
    const r = testRounds(daily, PUB, 10, null, 900)!;
    expect(r.passedAll).toBe(true);
    expect(r.message).toMatch(/Views grew every day \(1,000 → 2,000 → 2,500\)/);
  });

  it('judges only the days that are reported', () => {
    const daily = [day(0, 500, 0.6), day(1, 600, 0.6)];
    const r = testRounds(daily, PUB, 2, null, null)!;
    expect(r.rounds.map((x) => x.state)).toEqual(['pass', 'pass', 'no_data']);
    expect(r.message).toMatch(/2 days passed so far/);
  });
});
