import { describe, expect, it } from 'vitest';
import { checkpointStates, cumulative, discoveryShare, lastDataDay } from './measure';
import { bottleneckOf, classify, verdictOf, viewsBucket, type Measurement } from './outcome';
import type { Thesis } from './types';

const base: Measurement = {
  days: 7,
  views: 1000,
  baselineViews: 1000,
  baselineSample: 10,
  avgViewPct: 40,
  baselineAvgViewPct: 40,
  ctr: 0.05,
  impressions: 20000,
  baselineCtr: 0.05,
  discoveryShare: 0.6,
  channelDiscoveryShare: 0.6,
};

const thesis = { confidence: 'high', channelFit: 'high', competition: 'low' } as Thesis;

describe('buckets', () => {
  it('buckets views against the usual', () => {
    expect([2, 1.3, 1, 0.6, 0.3, null].map(viewsBucket)).toEqual(['well_above', 'above', 'typical', 'below', 'well_below', 'unknown']);
  });

  it('needs a real baseline before comparing views', () => {
    expect(classify({ ...base, baselineSample: 4 }, thesis)).toMatchObject({ views: 'unknown', bottleneck: 'insufficient_data', verdict: 'inconclusive', confidence: 'low' });
  });

  it('doesn’t compare tiny numbers', () => {
    expect(classify({ ...base, views: 4, baselineViews: 3 }, thesis).views).toBe('unknown');
  });

  it('ignores click rate on too few impressions and retention on too few views', () => {
    expect(classify({ ...base, impressions: 100, ctr: 0.01 }, thesis).ctr).toBe('unknown');
    expect(classify({ ...base, views: 50, avgViewPct: 10 }, thesis).retention).toBe('unknown');
  });
});

describe('bottleneck', () => {
  it('finds the weak point only when views are below the usual', () => {
    expect(bottleneckOf('typical', 'below', 'below', 'below')).toBe('none');
    expect(bottleneckOf('below', 'below', 'below', 'typical')).toBe('execution');
    expect(bottleneckOf('below', 'below', 'typical', 'typical')).toBe('packaging');
    expect(bottleneckOf('well_below', 'typical', 'below', 'typical')).toBe('retention');
    expect(bottleneckOf('below', 'typical', 'typical', 'below')).toBe('discovery');
    expect(bottleneckOf('below', 'typical', 'typical', 'typical')).toBe('content_market_mismatch');
    expect(bottleneckOf('below', 'unknown', 'unknown', 'unknown')).toBe('insufficient_data');
  });

  it('classifies a real-looking packaging problem', () => {
    const o = classify({ ...base, views: 400, ctr: 0.02 }, thesis);
    expect(o).toMatchObject({ views: 'well_below', ctr: 'below', bottleneck: 'packaging', verdict: 'inconclusive' });
    expect(o.summary).toContain('clicked less');
  });
});

describe('thesis verdict', () => {
  it('judges the idea only from day 7, and not when packaging held it back', () => {
    expect(verdictOf(2, 'above', 'none', thesis)).toBe('inconclusive');
    expect(verdictOf(7, 'above', 'none', thesis)).toBe('supported');
    expect(verdictOf(7, 'typical', 'none', thesis)).toBe('partly_supported');
    expect(verdictOf(7, 'below', 'packaging', thesis)).toBe('inconclusive');
    expect(verdictOf(7, 'below', 'content_market_mismatch', thesis)).toBe('not_supported');
    expect(verdictOf(28, 'above', 'none', null)).toBe('inconclusive');
  });

  it('says an early checkpoint is an early signal', () => {
    expect(classify({ ...base, days: 2 }, thesis).summary).toContain('early signal');
    expect(classify({ ...base, days: 2 }, null).thesisText).toBeNull();
  });
});

describe('measurement helpers', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  it('counts the publish day as day 1 and allows for YouTube’s delay', () => {
    expect(lastDataDay(now)).toBe('2026-10-17');
    const states = checkpointStates('2026-10-10T08:00:00Z', [28, 1, 7, 2], now);
    expect(states.map((s) => [s.days, s.ready])).toEqual([
      [1, true],
      [2, true],
      [7, true],
      [28, false],
    ]);
    expect(states[3].readyOn).toBe('2026-11-09');
    expect(checkpointStates('2026-10-18T08:00:00Z', [1], now)[0].ready).toBe(false);
  });

  it('sums views and weights average % viewed by views', () => {
    const days = [
      { date: '2026-10-01', views: 100, avgViewPct: 50 },
      { date: '2026-10-02', views: 300, avgViewPct: 30 },
      { date: '2026-10-09', views: 1000, avgViewPct: 10 },
    ];
    expect(cumulative(days, '2026-10-01', 2)).toEqual({ views: 400, avgViewPct: 35 });
    expect(cumulative([], '2026-10-01', 7)).toEqual({ views: 0, avgViewPct: null });
  });

  it('measures the share of views from recommendations', () => {
    expect(
      discoveryShare([
        { source: 'RELATED_VIDEO', views: 30, minutesWatched: null },
        { source: 'SUBSCRIBER', views: 30, minutesWatched: null },
        { source: 'YT_SEARCH', views: 40, minutesWatched: null },
      ])
    ).toBe(0.6);
    expect(discoveryShare([])).toBeNull();
  });
});
