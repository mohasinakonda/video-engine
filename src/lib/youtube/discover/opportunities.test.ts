import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../settings';
import type { FormatTag } from './formats';
import type { TaggedVideo } from './market-patterns';
import {
  buildOpportunities,
  competitionOf,
  confidenceOf,
  dominantFormat,
  gapsOf,
  momentumOf,
  weightedTotal,
  type EngineContext,
  type TopicDetail,
} from './opportunities';
import type { Phase1Summary } from './phase1';
import type { Outlier, TopicSummary } from './types';

const NOW = new Date('2026-10-19T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const fmt = (primary: FormatTag['primary']): FormatTag => ({ primary, secondary: null, confidence: primary ? 'high' : null, source: primary ? 'rule' : null });

function video(id: string, channelId: string, age: number, title = `Video ${id}`, format: FormatTag['primary'] = null, isYours = false): TaggedVideo {
  return { id, channelId, channelTitle: channelId, isYours, title, publishedAt: daysAgo(age), durationSec: 600, views: 1000, likes: null, comments: null, thumbnailUrl: null, format: fmt(format) };
}

function outlier(id: string, channelId: string, age: number, ratio: number, title = 'A vs B: which wins?', format: Outlier['contentFormat'] = 'comparison'): Outlier {
  return { videoId: id, channelId, channelTitle: channelId, title, thumbnailUrl: null, publishedAt: daysAgo(age), ageDays: age, format: 'video', views: 5000, baselineViews: 1000, ratio, sampleSize: 14, confidence: 'high', topicId: 't1', contentFormat: format, mechanisms: ['comparison', 'question'] };
}

function summary(over: Partial<TopicSummary> = {}): TopicSummary {
  return {
    id: 't1', label: 'Portable extractor comparisons', labelSource: 'ai', problemOriented: false, audienceProblem: null,
    videoCount: 8, yourVideoCount: 0, competitorVideoCount: 8, competitorChannelCount: 4, competitorRecent30: 4,
    outlierCount: 3, outlierChannelCount: 3, cohesion: 0.8, exampleTitles: [], topFormats: [{ format: 'comparison', count: 5 }],
    yourVideoIds: [], outlierVideoIds: [], ...over,
  };
}

/** A topic four competitors cover, three with standouts, which you haven't touched. */
function detail(over: Partial<TopicDetail> = {}, s: Partial<TopicSummary> = {}): TopicDetail {
  const theirs = [video('a1', 'A', 5), video('a2', 'A', 50), video('b1', 'B', 10), video('b2', 'B', 70), video('c1', 'C', 20), video('c2', 'C', 80), video('d1', 'D', 15), video('d2', 'D', 60)];
  return { summary: summary(s), centroid: [1, 0], yours: [], theirs, outliers: [outlier('a1', 'A', 5, 4), outlier('b1', 'B', 10, 3), outlier('c1', 'C', 20, 6)], ...over };
}

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  window: '90d', now: NOW, weights: DEFAULT_WEIGHTS, phase1: null, yourCentre: [1, 0], ratios: new Map(), competitorsTotal: 6,
  unavailableShare: 0, strongEmbedding: true, yourFormats: new Map(), ...over,
});

describe('momentum', () => {
  it('sees recent momentum when several channels posted lately with a recent standout', () => {
    expect(momentumOf(detail(), new Map(), NOW)).toBe('recent');
  });
  it('calls a single standout from one channel a one-off spike', () => {
    const d = detail({ theirs: [video('a1', 'A', 100), video('b1', 'B', 200)], outliers: [outlier('a1', 'A', 60, 5)] });
    expect(momentumOf(d, new Map(), NOW)).toBe('one_off');
  });
  it('sees durable demand from steady coverage that performs at least as usual', () => {
    const theirs = [video('a', 'A', 20), video('b', 'B', 50), video('c', 'A', 80), video('d', 'B', 120), video('e', 'A', 160)];
    const ratios = new Map(theirs.map((v) => [v.id, 1.2]));
    expect(momentumOf(detail({ theirs, outliers: [] }), ratios, NOW)).toBe('durable');
  });
  it('finds no signal in an empty topic', () => {
    expect(momentumOf(detail({ theirs: [], outliers: [] }), new Map(), NOW)).toBe('none');
  });
});

describe('gaps', () => {
  it('finds a coverage gap when you have nothing and several channels have standouts', () => {
    expect(gapsOf(detail(), 'none', null).map((g) => g.type)).toEqual(['coverage']);
  });

  it('finds no coverage gap when you already cover the topic', () => {
    const yours = [video('y1', 'Y', 30, 'Why X', 'explainer', true), video('y2', 'Y', 40, 'Why Y', 'explainer', true)];
    const types = gapsOf(detail({ yours }, { yourVideoCount: 2 }), 'none', null).map((g) => g.type);
    expect(types).not.toContain('coverage');
    // …but the standouts are comparisons and yours are explainers: a format gap.
    expect(types).toContain('format');
  });

  it('finds a packaging gap when your covered videos underperform and miss the standouts’ title style', () => {
    const yours = [video('y1', 'Y', 30, 'Portable extractors', 'comparison', true)];
    const phase1: Phase1Summary = { primary: 'packaging', primaryConfidence: 'high', primaryIsHypothesis: false, medianAvgViewPct: 40, videos: new Map([['y1', { label: 'underperformer', avgViewPct: 30, relativeViews: 0.3 }]]) };
    const gaps = gapsOf(detail({ yours }, { yourVideoCount: 1 }), 'none', phase1);
    expect(gaps.map((g) => g.type)).toContain('packaging');
    expect(gaps.find((g) => g.type === 'packaging')?.evidence).toMatch(/“X vs Y” comparison/);
  });

  it('needs evidence: one channel’s standouts are not a gap', () => {
    const d = detail({ outliers: [outlier('a1', 'A', 5, 4), outlier('a2', 'A', 50, 3)] }, { outlierCount: 2, outlierChannelCount: 1 });
    expect(gapsOf(d, 'none', null).map((g) => g.type)).not.toContain('coverage');
  });

  it('flags an emerging topic only while it is not crowded, and an audience problem only with enough channels', () => {
    expect(gapsOf(detail({}, { outlierCount: 0, outlierChannelCount: 0 }), 'recent', null).map((g) => g.type)).toEqual(['emerging']);
    expect(gapsOf(detail({}, { outlierCount: 0, competitorVideoCount: 30 }), 'recent', null)).toEqual([]);
    const problem = { problemOriented: true, audienceProblem: 'Pet hair stuck in car seats', outlierCount: 0 };
    expect(gapsOf(detail({}, problem), 'none', null).map((g) => g.type)).toEqual(['audience_problem']);
    expect(gapsOf(detail({}, { ...problem, competitorChannelCount: 2 }), 'none', null)).toEqual([]);
  });

  it('finds the format most standouts share', () => {
    expect(dominantFormat([outlier('1', 'A', 1, 3), outlier('2', 'B', 1, 3, 't', 'review')])).toBe('comparison');
    expect(dominantFormat([outlier('1', 'A', 1, 3)])).toBeNull();
  });
});

describe('scoring', () => {
  it('weights the signals as configured', () => {
    const all = { channelFit: 100, competitorPerformance: 0, momentum: 0, contentGap: 0, competition: 0, productionFit: 0, phase1: 0 };
    expect(weightedTotal(all, DEFAULT_WEIGHTS)).toEqual({ total: 25, used: 7 });
  });

  it('drops missing signals and renormalizes the rest', () => {
    const partial = { channelFit: 80, competitorPerformance: 80, momentum: 80, contentGap: 80, competition: 80, productionFit: null, phase1: null };
    expect(weightedTotal(partial, DEFAULT_WEIGHTS)).toEqual({ total: 80, used: 5 });
  });

  it('rates competition from how many competitors cover the topic and how recently', () => {
    expect(competitionOf(summary({ competitorChannelCount: 1, competitorRecent30: 0 }), 6).level).toBe('low');
    expect(competitionOf(summary({ competitorChannelCount: 6, competitorRecent30: 12 }), 6).level).toBe('high');
  });

  it('builds a ranked, evidence-backed opportunity with every number traceable', () => {
    const [opp] = buildOpportunities([detail()], ctx());
    expect(opp).toMatchObject({ topic: 'Portable extractor comparisons', gapTypes: ['coverage', 'emerging'], momentum: 'recent', recommendedFormat: 'comparison', productionDifficulty: 'medium', recommendedAngle: null });
    expect(opp.scores.total).toBeGreaterThan(0);
    expect(opp.scores.total).toBeLessThanOrEqual(100);
    expect(opp.evidence[0].statement).toBe('3 competitor videos on this topic beat their channels’ usual views (median 4.0×).');
    expect(opp.evidence.every((e) => e.period === 'Last 90 days')).toBe(true);
    expect(opp.competitorSignals).toHaveLength(3);
  });

  it('skips topics with nothing to act on', () => {
    expect(buildOpportunities([detail({ outliers: [] }, { outlierCount: 0, outlierChannelCount: 0, competitorRecent30: 0 })], ctx())).toEqual([]);
  });

  it('steers toward your best-retaining format when Channel Doctor finds weak retention', () => {
    const phase1: Phase1Summary = { primary: 'retention', primaryConfidence: 'high', primaryIsHypothesis: false, medianAvgViewPct: 40, videos: new Map() };
    const yourFormats = new Map([['explainer' as const, { videos: 4, medianAvgViewPct: 55 }]]);
    const withExplainers = detail({}, { topFormats: [{ format: 'comparison', count: 5 }, { format: 'explainer', count: 2 }] });
    const [steered] = buildOpportunities([withExplainers], ctx({ phase1, yourFormats }));
    expect(steered.recommendedFormat).toBe('explainer');
    expect(steered.scores.phase1).toBe(90);
    const [unproven] = buildOpportunities([detail()], ctx({ phase1, yourFormats }));
    expect(unproven.scores.phase1).toBe(0);
    expect(unproven.evidence.some((e) => e.source === 'youtube_analytics' && /fix retention first/.test(e.statement))).toBe(true);
  });
});

describe('confidence', () => {
  it('is high with many channels and standouts, and separate from the score', () => {
    expect(confidenceOf(detail(), 'recent', ['coverage'], 80, ctx()).confidence).toBe('high');
  });
  it('drops for one-off spikes, few channels, unreadable competitors and loose topics', () => {
    expect(confidenceOf(detail(), 'one_off', ['coverage'], 80, ctx()).confidence).toBe('low');
    expect(confidenceOf(detail({}, { competitorChannelCount: 1 }), 'recent', ['coverage'], 80, ctx()).confidence).toBe('low');
    expect(confidenceOf(detail(), 'recent', ['coverage'], 80, ctx({ unavailableShare: 0.5 })).confidence).toBe('low');
    expect(confidenceOf(detail({}, { cohesion: 0.5 }), 'recent', ['coverage'], 80, ctx()).confidence).toBe('medium');
    expect(confidenceOf(detail(), 'recent', ['coverage'], 80, ctx({ strongEmbedding: false })).confidence).toBe('medium');
  });
  it('caps an AI-read audience problem at medium and explains why', () => {
    const r = confidenceOf(detail(), 'recent', ['audience_problem'], 80, ctx());
    expect(r.confidence).toBe('medium');
    expect(r.reasons.join(' ')).toMatch(/read by AI/);
  });
  it('lowers confidence when the signals disagree', () => {
    expect(confidenceOf(detail(), 'none', [], 20, ctx()).confidence).toBe('medium');
  });
});
