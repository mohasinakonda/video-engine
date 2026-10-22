import { describe, expect, it } from 'vitest';
import { curve, makeDataset, makeVideo, stats } from '../__tests__/fixtures';
import { analyzeChannel } from './engine';
import { getPeriods } from './period';
import { detectRetentionAnomalies, normalizeRetention, watchRatioAt } from './retention';
import { confidenceFromSample, median, percentChange } from './stats';
import { analyzeVideos } from './videos';

describe('stats', () => {
  it('computes medians for odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('only reports a change against a real baseline', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(150, 0)).toBeNull();
    expect(percentChange(null, 100)).toBeNull();
  });

  it('lowers confidence for small samples', () => {
    expect(confidenceFromSample(2)).toBe('low');
    expect(confidenceFromSample(5)).toBe('medium');
    expect(confidenceFromSample(10)).toBe('high');
  });
});

describe('periods', () => {
  it('ends on the last fully reported day and compares equal lengths', () => {
    const { current, previous } = getPeriods('28d', new Date('2026-10-19T12:00:00Z'));
    expect(current).toEqual({ startDate: '2026-09-19', endDate: '2026-10-16', days: 28 });
    expect(previous).toEqual({ startDate: '2026-08-22', endDate: '2026-09-18', days: 28 });
  });
});

describe('retention', () => {
  it('drops invalid points and sorts by time', () => {
    const points = normalizeRetention([
      { ratio: 0.5, watchRatio: 0.4, relativePerformance: null },
      { ratio: 1.5, watchRatio: 0.2, relativePerformance: null },
      { ratio: 0.1, watchRatio: 0.9, relativePerformance: null },
      { ratio: 0.2, watchRatio: Number.NaN, relativePerformance: null },
    ]);
    expect(points.map((p) => p.ratio)).toEqual([0.1, 0.5]);
  });

  it('interpolates the watch ratio between points', () => {
    const points = [
      { ratio: 0, watchRatio: 1, relativePerformance: null },
      { ratio: 1, watchRatio: 0, relativePerformance: null },
    ];
    expect(watchRatioAt(points, 0.25)).toBeCloseTo(0.75);
  });

  it('treats steady decay as normal', () => {
    const anomalies = detectRetentionAnomalies('v', curve(1, 0.4), 600, 5000);
    expect(anomalies.filter((a) => a.kind === 'steep_drop')).toHaveLength(0);
  });

  it('flags a sudden drop, with its timestamp', () => {
    const points = curve(1, 0.4);
    for (let i = 50; i < 100; i++) points[i].watchRatio -= 0.15; // 15 points lost at once at 51%
    const drop = detectRetentionAnomalies('v', points, 600, 5000).find((a) => a.kind === 'steep_drop');
    expect(drop?.atRatio).toBeCloseTo(0.51);
    expect(drop?.atSec).toBe(306);
  });

  it('flags viewers leaving in the first 30 seconds', () => {
    const points = curve(1, 0.2, { 0: 0.6, 1: 0.5, 2: 0.45, 3: 0.44, 4: 0.43, 5: 0.42 });
    const early = detectRetentionAnomalies('v', points, 600, 5000).find((a) => a.kind === 'early_exit');
    expect(early).toBeDefined();
  });

  it('skips drop detection on low-view videos (too noisy)', () => {
    const points = curve(1, 0.4);
    for (let i = 50; i < 100; i++) points[i].watchRatio -= 0.15;
    expect(detectRetentionAnomalies('v', points, 600, 50).filter((a) => a.kind === 'steep_drop')).toHaveLength(0);
  });
});

describe('video comparison', () => {
  it('compares within the same format and labels clear outliers', () => {
    const dataset = makeDataset();
    const ids = dataset.videos.map((v) => v.id);
    if (dataset.perVideo.ok) {
      dataset.perVideo.data[ids[0]] = stats(10_000);
      dataset.perVideo.data[ids[1]] = stats(100);
    }
    const videos = analyzeVideos(dataset);
    expect(videos.find((v) => v.id === ids[0])?.label).toBe('outperformer');
    expect(videos.find((v) => v.id === ids[1])?.label).toBe('underperformer');
  });

  it('marks videos without enough peers as not comparable', () => {
    const dataset = makeDataset({ videos: [makeVideo(1, { format: 'video' }), makeVideo(2, { format: 'video' })] });
    expect(analyzeVideos(dataset).every((v) => v.label === 'not_comparable')).toBe(true);
  });
});

describe('engine', () => {
  it('keeps missing metrics as null, never zero', () => {
    const report = analyzeChannel(makeDataset({ totals: { ok: false, reason: 'unavailable' } }));
    const views = report.metrics.find((m) => m.key === 'views');
    expect(views?.value).toBeNull();
    expect(report.metrics.find((m) => m.key === 'ctr')?.value).toBeNull();
  });

  it('does not show changes when the previous period had no views', () => {
    const dataset = makeDataset({
      previousTotals: { ok: true, data: { views: 0, minutesWatched: 0, avgViewDurationSec: null, avgViewPct: null, subscribersGained: 0, subscribersLost: 0 } },
    });
    const report = analyzeChannel(dataset);
    expect(report.metrics.every((m) => m.changePct === null)).toBe(true);
    expect(report.limitations.some((l) => l.includes('no comparable previous period'))).toBe(true);
  });

  it('reports insufficient evidence for tiny channels', () => {
    const videos = [makeVideo(1, { format: 'video' }), makeVideo(2, { format: 'video' })];
    const report = analyzeChannel(makeDataset({ videos, perVideo: { ok: true, data: { [videos[0].id]: stats(100), [videos[1].id]: stats(50) } } }));
    expect(report.evidence.some((e) => e.id === 'ev_insufficient_videos')).toBe(true);
  });

  it('skips the packaging rule while CTR is unavailable', () => {
    const report = analyzeChannel(makeDataset());
    expect(report.findings.some((f) => f.category === 'packaging')).toBe(false);
    expect(report.limitations.some((l) => l.includes('2026-10-21'))).toBe(true);
  });

  it('flags a long upload pause', () => {
    const videos = Array.from({ length: 6 }, (_, i) => makeVideo(i, { format: 'video', publishedAt: new Date(Date.UTC(2026, 7, 10 - i * 5)).toISOString() }));
    const report = analyzeChannel(makeDataset({ videos }));
    expect(report.evidence.some((e) => e.id === 'ev_no_recent_upload')).toBe(true);
  });

  it('only references evidence that exists', () => {
    const report = analyzeChannel(makeDataset());
    const ids = new Set(report.evidence.map((e) => e.id));
    for (const f of report.findings) for (const id of f.evidenceIds) expect(ids.has(id)).toBe(true);
    for (const id of report.strengths) expect(ids.has(id)).toBe(true);
  });
});
