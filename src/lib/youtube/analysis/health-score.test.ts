import { describe, expect, it } from 'vitest';
import type { MetricValue, VideoAnalysis } from '../types';
import { computeHealthScore, healthBand, type HealthInput } from './health-score';

const metric = (key: MetricValue['key'], value: number | null, changePct: number | null = null): MetricValue => ({ key, value, previous: null, changePct, note: null });

function video(i: number, daysAgo: number, views = 100): VideoAnalysis {
  return {
    id: `v${i}`,
    title: `Video ${i}`,
    publishedAt: new Date(Date.parse('2026-11-01T00:00:00Z') - daysAgo * 86_400_000).toISOString(),
    thumbnailUrl: null,
    format: 'video',
    durationSec: 600,
    ageDays: daysAgo,
    stats: { views, minutesWatched: 0, avgViewDurationSec: null, avgViewPct: null, subscribersGained: 0 },
    impressions: null,
    ctr: null,
    relativeViews: null,
    baselineSize: 0,
    label: 'typical',
  };
}

function input(overrides: Partial<HealthInput> = {}): HealthInput {
  return {
    metrics: [metric('views', 12430, 18), metric('ctr', 0.031), metric('avgViewPct', 43), metric('netSubscribers', 38)],
    traffic: [
      { source: 'RELATED_VIDEO', views: 3729, sharePct: 30 },
      { source: 'SUBSCRIBER', views: 2735, sharePct: 22 },
      { source: 'YT_SEARCH', views: 5966, sharePct: 48 },
    ],
    videos: [0, 4, 8, 12, 16, 20].map((d, i) => video(i, d + 2)),
    current: { days: 28 },
    generatedAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeHealthScore', () => {
  it('scores each part from the measured numbers and weights them', () => {
    const result = computeHealthScore(input());
    const score = (id: string) => result.parts.find((p) => p.id === id)?.score;
    expect(score('growth')).toBe(68); // +18% on a −50…+50 scale
    expect(score('clicks')).toBe(31); // 3.1%: 20 + 1.1/8 × 80
    expect(score('retention')).toBe(57); // 43% on a 20…60 scale (57.5, floating point rounds down)
    expect(score('discovery')).toBe(73); // 52% on a 30…60 scale
    expect(score('consistency')).toBe(100); // last upload 2 days ago, every 4 days
    expect(score('subscribers')).toBe(31); // 3.1 per 1,000 views
    expect(result.usedParts).toBe(6);
    // 68×.25 + 31×.2 + 57×.2 + 73×.15 + 100×.1 + 31×.1 = 58.65
    expect(result.score).toBe(59);
    expect(result.band).toBe('fair');
    expect(result.mainDrag?.id).toBe('clicks');
  });

  it('leaves out parts without data and reweights the rest', () => {
    const result = computeHealthScore(input({ metrics: [metric('views', 12430, 18), metric('ctr', null), metric('avgViewPct', 43), metric('netSubscribers', 38)] }));
    expect(result.usedParts).toBe(5);
    expect(result.parts.find((p) => p.id === 'clicks')?.detail).toMatch(/not available/);
    expect(result.score).toBe(Math.round((68 * 0.25 + 57 * 0.2 + 73 * 0.15 + 100 * 0.1 + 31 * 0.1) / 0.8));
  });

  it('gives no score with fewer than 5 videos with views', () => {
    const result = computeHealthScore(input({ videos: [video(1, 3), video(2, 5), video(3, 9, 0)] }));
    expect(result.score).toBeNull();
    expect(result.reason).toMatch(/at least 5 videos/);
  });

  it('scores a stopped channel low on consistency', () => {
    const videos = [0, 1, 2, 3, 4].map((i) => video(i, 45 + i * 3));
    const part = computeHealthScore(input({ videos })).parts.find((p) => p.id === 'consistency');
    expect(part?.score).toBe(0);
    expect(part?.detail).toMatch(/Last upload 45 days ago/);
  });

  it('has no main drag when every part is healthy', () => {
    const result = computeHealthScore(
      input({
        metrics: [metric('views', 10000, 60), metric('ctr', 0.12), metric('avgViewPct', 70), metric('netSubscribers', 200)],
        traffic: [{ source: 'RELATED_VIDEO', views: 10000, sharePct: 80 }],
      })
    );
    expect(result.score).toBe(100);
    expect(result.band).toBe('healthy');
    expect(result.mainDrag).toBeNull();
  });

  it('treats 0% average viewed as missing, not as a score of 0', () => {
    const result = computeHealthScore(input({ metrics: [metric('views', 12430, 18), metric('ctr', 0.031), metric('avgViewPct', 0), metric('netSubscribers', 38)] }));
    const part = result.parts.find((p) => p.id === 'retention');
    expect(part?.score).toBeNull();
    expect(part?.detail).toMatch(/hasn’t reported average % viewed/);
  });

  it('does not score retention, discovery or subscribers on too few views', () => {
    const result = computeHealthScore(
      input({
        metrics: [metric('views', 60), metric('ctr', 0.045), metric('avgViewPct', 35), metric('netSubscribers', 0)],
        traffic: [{ source: 'EXT_URL', views: 60, sharePct: 100 }],
      })
    );
    for (const id of ['retention', 'discovery', 'subscribers']) {
      const part = result.parts.find((p) => p.id === id);
      expect(part?.score).toBeNull();
      expect(part?.detail).toMatch(/Not enough views yet to judge \(60 in this period/);
    }
  });

  it('says "today" and "several uploads a day", and scores a burst then a pause low', () => {
    // Ten uploads within one day, after a 25-day pause before them.
    const burst = [...Array.from({ length: 10 }, (_, i) => video(i, 0.05 * i)), video(10, 25), video(11, 26)];
    const part = computeHealthScore(input({ videos: burst })).parts.find((p) => p.id === 'consistency');
    expect(part?.detail).toMatch(/^Last upload today; often several uploads a day, but the gaps vary a lot/);
    expect(part?.score).toBeLessThan(50);
  });

  it('keeps a steady weekly rhythm near the top', () => {
    const weekly = [1, 8, 15, 22, 29, 36].map((d, i) => video(i, d));
    const part = computeHealthScore(input({ videos: weekly })).parts.find((p) => p.id === 'consistency');
    expect(part?.score).toBe(100);
    expect(part?.detail).toBe('Last upload 1 day ago; about every 7 days (median)');
  });

  it('uses the agreed bands', () => {
    expect([healthBand(70), healthBand(69), healthBand(40), healthBand(39)]).toEqual(['healthy', 'fair', 'fair', 'attention']);
  });
});
