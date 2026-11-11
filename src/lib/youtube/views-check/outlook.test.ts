import { describe, expect, it } from 'vitest';
import { growthOutlook, type OutlookShort } from './outlook';

const NOW = new Date('2026-11-10T00:00:00Z');
const DAY = 86_400_000;

/** One Short per entry, newest first, every 3 days starting 3 days ago. */
function channel(entries: { views: number; swipe?: number | null; firstDay?: number | null }[], startDaysAgo = 3, gapDays = 3): OutlookShort[] {
  return entries.map((e, i) => ({
    id: `s${i}`,
    title: `Short ${i}`,
    publishedAt: new Date(NOW.getTime() - (startDaysAgo + i * gapDays) * DAY).toISOString(),
    views: e.views,
    firstDay: e.firstDay ?? null,
    swipeAway: e.swipe === undefined ? 0.4 : e.swipe,
    viewPct: 60,
  }));
}

const rep = (count: number, e: { views: number; swipe?: number | null; firstDay?: number | null }) => Array.from({ length: count }, () => ({ ...e }));

describe('growth outlook', () => {
  it('likely to grow: liked and reach rising', () => {
    const o = growthOutlook(channel([...rep(5, { views: 900 }), ...rep(5, { views: 400 })]), NOW);
    expect(o.id).toBe('growing');
    expect(o.reach.state).toBe('rising');
    expect(o.reach.by).toBe('views');
    expect(o.detail).toMatch(/median of 900 views, vs 400/);
  });

  it('held back: liked but reach flat', () => {
    expect(growthOutlook(channel(rep(10, { views: 500, swipe: 0.3 })), NOW).id).toBe('held_back');
  });

  it('will stall: reach rising but most swipe away', () => {
    expect(growthOutlook(channel([...rep(5, { views: 900, swipe: 0.75 }), ...rep(5, { views: 400, swipe: 0.75 })]), NOW).id).toBe('will_stall');
  });

  it('not growing: swiped away and reach falling', () => {
    const o = growthOutlook(channel([...rep(5, { views: 100, swipe: 0.8 }), ...rep(5, { views: 400, swipe: 0.8 })]), NOW);
    expect(o.id).toBe('not_growing');
    expect(o.reach.state).toBe('falling');
    expect(o.detail).toMatch(/About 80% of viewers swipe away/);
  });

  it('compares upload-day views when enough Shorts have them', () => {
    const o = growthOutlook(channel([...rep(5, { views: 500, firstDay: 300 }), ...rep(5, { views: 500, firstDay: 100 })]), NOW);
    expect(o.reach.by).toBe('first_day');
    expect(o.id).toBe('growing');
  });

  it('too early with fewer than 6 Shorts old enough', () => {
    const o = growthOutlook(channel(rep(5, { views: 500 })), NOW);
    expect(o.id).toBe('too_early');
    expect(o.detail).toMatch(/You have 5/);
  });

  it('too early when swipe-away can’t be read (too few views)', () => {
    expect(growthOutlook(channel(rep(10, { views: 10 })), NOW).id).toBe('too_early');
  });

  it('ignores Shorts younger than 2 days', () => {
    const shorts = channel([...rep(5, { views: 500 }), ...rep(5, { views: 500 })]);
    shorts.unshift({ ...shorts[0], id: 'new', publishedAt: new Date(NOW.getTime() - DAY).toISOString(), views: 0 });
    expect(growthOutlook(shorts, NOW).reach.recent?.zeroViewShare).toBe(0);
  });

  it('checks what the reading said a month ago against what happened', () => {
    // Shorts every 3 days: the last month got 2× the views of the month before, and that month was rising too.
    const shorts = channel([...rep(10, { views: 1000 }), ...rep(5, { views: 500 }), ...rep(5, { views: 200 })]);
    const o = growthOutlook(shorts, NOW);
    expect(o.check).not.toBeNull();
    expect(o.check?.said).toBe('growing');
    expect(o.check?.grew).toBe(true);
    expect(o.check?.matched).toBe(true);
  });

  it('records a miss when the reading said grow but views fell', () => {
    const shorts = channel([...rep(10, { views: 100 }), ...rep(5, { views: 500 }), ...rep(5, { views: 200 })]);
    const o = growthOutlook(shorts, NOW);
    expect(o.check?.said).toBe('growing');
    expect(o.check?.matched).toBe(false);
  });
});
