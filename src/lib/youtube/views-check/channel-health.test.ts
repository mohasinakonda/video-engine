import { describe, expect, it } from 'vitest';
import { shortsHealth, watchedLine } from './channel-health';
import type { ShortTest, ShortTimeline } from './types';

/**
 * A Short at given rates: 20,000 views, `viewed` engaged, `watchedPct` viewed, and likes, shares and
 * subscribers per engaged view; `trust` is its Trust Score (vs the channel's usual).
 */
function short(
  i: number,
  o: { viewed?: number; watchedPct?: number; likes?: number; shares?: number; subs?: number | null; sec?: number; trust?: number; views?: number } = {},
): ShortTimeline {
  // 20,000 views × 0.55 = 11,000 engaged: every default rate gives a whole count.
  const views = o.views ?? 20000;
  const viewed = o.viewed ?? 0.55;
  const engaged = views * viewed;
  return {
    videoId: `s${i}`,
    views,
    engagedRate: viewed,
    avgViewPct: o.watchedPct ?? 70,
    durationSec: o.sec ?? 30,
    interactions: { likes: Math.round(engaged * (o.likes ?? 0.03)), comments: 0, shares: Math.round(engaged * (o.shares ?? 0.005)) },
    subscribersGained: o.subs === null ? null : Math.round(engaged * (o.subs ?? 0.002)),
    test: { score: o.trust ?? 50 } as ShortTest,
  } as ShortTimeline;
}
const many = (count: number, o: Parameters<typeof short>[1] = {}, from = 0) => Array.from({ length: count }, (_, i) => short(from + i, o));

describe('Shorts health score', () => {
  it('scores 70 (Healthy) for Shorts exactly at the healthy lines with a flat trend', () => {
    const h = shortsHealth(many(20));
    expect(h.p).toBe(70);
    expect(h.t).toBe(70);
    expect(h.score).toBe(70);
    expect(h.band).toBe('healthy');
    expect(h.provisional).toBe(false);
  });

  it('isn’t the same for every channel: well above the lines scores 100, well below scores low', () => {
    // Viewed 1 ÷ 0.55 × 70 = 127, capped at 100; twice the other lines also caps at 100.
    const top = shortsHealth(many(20, { viewed: 1, watchedPct: 140, likes: 0.06, shares: 0.01, subs: 0.004 }));
    expect(top.p).toBe(100);
    expect(top.score).toBe(91);
    expect(top.band).toBe('excellent');
    const low = shortsHealth(many(20, { viewed: 0.2, watchedPct: 30, likes: 0.01, shares: 0.001, subs: 0.0005 }));
    expect(low.band).toBe('critical');
  });

  it('CHS = 0.70 P + 0.30 T, T from the Trust Score trend', () => {
    const h = shortsHealth([...many(10, { trust: 70 }), ...many(10, { trust: 40 }, 10)]);
    expect(h.trend?.diff).toBe(30);
    expect(h.t).toBe(100);
    expect(h.score).toBe(Math.round(0.7 * 70 + 0.3 * 100));
  });

  it('names the part that costs the most points in one line', () => {
    const h = shortsHealth(many(20, { viewed: 0.3 }));
    expect(h.headline).toBe('Your hook loses most viewers in the first 2 seconds.');
    expect(h.detail).toBe('70 of every 100 viewers swipe away in the first 2 seconds (good: under 45).');
  });

  it('names a falling trend when that costs more than any part', () => {
    const h = shortsHealth([...many(10, { trust: 20 }), ...many(10, { trust: 70 }, 10)]);
    expect(h.headline).toMatch(/newest Shorts do worse than your older ones/);
    expect(h.detail).toMatch(/Your last 10 Shorts score 20, down from 70/);
  });

  it('compares % viewed with the line for the Short’s length', () => {
    expect(watchedLine(15)).toBe(0.8);
    expect(watchedLine(35)).toBe(0.7);
    expect(watchedLine(55)).toBe(0.6);
    expect(watchedLine(120)).toBe(0.5);
    const h = shortsHealth(many(20, { sec: 15, watchedPct: 80 }));
    expect(h.parts.find((p) => p.id === 'watched')?.score).toBe(70);
  });

  it('leaves out a metric it can’t read instead of counting it as 0', () => {
    const h = shortsHealth(many(20, { subs: null }));
    expect(h.parts.map((p) => p.id)).not.toContain('subscribed');
    expect(h.p).toBe(70);
  });

  it('is provisional with fewer than 20 Shorts, and has no score under 3', () => {
    expect(shortsHealth(many(8)).provisional).toBe(true);
    const none = shortsHealth(many(2));
    expect(none.score).toBeNull();
    expect(none.detail).toMatch(/at least 3 Shorts with 20\+ views/);
  });

  it('skips Shorts with too few views for their rates to count', () => {
    expect(shortsHealth([...many(5), ...many(5, { views: 5, viewed: 0.1 }, 5)]).shorts).toBe(5);
  });
});
