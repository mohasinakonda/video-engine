import { describe, expect, it } from 'vitest';
import { withTrackRecord } from '../discover/opportunities';
import { DEFAULT_WEIGHTS, upgradeWeights, weightsSchema } from '../settings';
import { groupBy, latestPerVideo, summarize, trackRecordFor, type LearningRow, type TrackRecordInput } from './track-record';

let seq = 0;
const row = (over: Partial<LearningRow> = {}): LearningRow => ({
  publishedVideoId: `v${++seq}`,
  projectId: `p${seq}`,
  projectTitle: `Video ${seq}`,
  checkpointDays: 28,
  topicLabel: 'Deep sea',
  contentFormat: 'explainer',
  titleMechanism: 'why',
  views: 'above',
  bottleneck: 'none',
  verdict: 'supported',
  ...over,
});

describe('grouping', () => {
  it('keeps each video’s latest compared checkpoint', () => {
    const rows = [row({ publishedVideoId: 'a', checkpointDays: 7, views: 'below' }), row({ publishedVideoId: 'a', checkpointDays: 28, views: 'above' }), row({ publishedVideoId: 'b', views: 'unknown' })];
    expect(latestPerVideo(rows)).toEqual([expect.objectContaining({ publishedVideoId: 'a', views: 'above' })]);
  });

  it('shrinks small groups toward no effect', () => {
    const [one] = groupBy([row()], (r) => r.contentFormat);
    const [five] = groupBy(Array.from({ length: 5 }, () => row()), (r) => r.contentFormat);
    expect(one.effect).toBe(0.25);
    expect(five.effect).toBe(0.63);
    const [mixed] = groupBy([row(), row({ views: 'below' }), row({ views: 'typical' })], (r) => r.contentFormat);
    expect(mixed).toMatchObject({ n: 3, above: 1, below: 1, effect: 0 });
  });

  it('states tendencies only from the minimum number of videos', () => {
    const rows = [row(), row(), row({ contentFormat: 'list', titleMechanism: 'number', topicLabel: 'Fish', views: 'well_below', verdict: 'not_supported' })];
    const s = summarize(rows, 2);
    expect(s.measuredVideos).toBe(3);
    expect(s.working.map((w) => `${w.dimension}:${w.stat.key}`)).toEqual(expect.arrayContaining(['format:explainer', 'mechanism:why', 'topic:Deep sea']));
    expect(s.notWorking).toEqual([]);
    expect(s.verdicts).toEqual([
      { verdict: 'supported', n: 2 },
      { verdict: 'not_supported', n: 1 },
    ]);
    expect(summarize(rows, 3).working).toEqual([]);
  });
});

describe('feeding Discover', () => {
  const input = (rows: LearningRow[], vector = [1, 0]): TrackRecordInput => ({
    minVideos: 3,
    formats: new Map(groupBy(rows, (r) => r.contentFormat).map((g) => [g.key, g])),
    topics: groupBy(rows, (r) => r.topicLabel).map((stat) => ({ stat, vector })),
  });

  it('is a missing signal until a group has enough videos', () => {
    expect(trackRecordFor('explainer', [1, 0], input([row(), row()]))).toBeNull();
    expect(trackRecordFor('explainer', [1, 0], null)).toBeNull();
  });

  it('scores from the format and the matching topic, with evidence', () => {
    const rows = [row(), row(), row({ views: 'below' })];
    const signal = trackRecordFor('explainer', [1, 0], input(rows), 'Explainer');
    expect(signal).toMatchObject({ n: 3, score: 59 });
    expect(signal?.evidence).toContain('Your 3 past explainer videos did better than your usual in 2 of 3 and worse in 1.');
    expect(signal?.evidence).toContain('on “Deep sea”');
    expect(trackRecordFor('explainer', [0, 1], input(rows))?.evidence).not.toContain('Deep sea');
  });

  it('raises confidence only with enough videos and a clear lean', () => {
    const judged = { confidence: 'medium' as const, reasons: [] };
    expect(withTrackRecord(judged, { score: 80, n: 5, effect: 0.5, evidence: '' }).confidence).toBe('high');
    expect(withTrackRecord(judged, { score: 80, n: 4, effect: 0.5, evidence: '' }).confidence).toBe('medium');
    const poor = withTrackRecord(judged, { score: 20, n: 5, effect: -0.5, evidence: '' });
    expect(poor.confidence).toBe('medium');
    expect(poor.reasons[0]).toContain('did worse');
  });
});

describe('weights', () => {
  it('moves untouched old defaults to the new ones, and keeps tuned weights', () => {
    const oldDefaults = { channelFit: 25, competitorPerformance: 20, momentum: 15, contentGap: 15, competition: 10, productionFit: 10, phase1: 5 };
    expect(upgradeWeights(oldDefaults)).toEqual(DEFAULT_WEIGHTS);
    const tuned = { ...oldDefaults, channelFit: 30, competitorPerformance: 15 };
    expect(upgradeWeights(tuned)).toEqual({ ...tuned, trackRecord: 0 });
    expect(weightsSchema.safeParse(upgradeWeights(tuned)).success).toBe(true);
    expect(weightsSchema.safeParse(DEFAULT_WEIGHTS).success).toBe(true);
  });
});
