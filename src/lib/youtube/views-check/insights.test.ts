import { describe, expect, it } from 'vitest';
import type { VideoMeta } from '../types';
import { gatesFor, newTopicJudgement, stopPointOf, topicIndex, topicSummaries } from './insights';
import { validGroups } from './topics';
import type { ShortTimeline, TopicGroup } from './types';

const NOW = new Date('2026-11-09T12:00:00Z');
const short = (i: number, daysAgo: number, views: number): VideoMeta => ({
  id: `v${i}`,
  title: `Short ${i}`,
  publishedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  durationSec: 25,
  thumbnailUrl: null,
  format: 'short',
  lifetimeViews: views,
  likes: 0,
  comments: 0,
});

const timeline = (over: Partial<ShortTimeline> = {}): ShortTimeline =>
  ({
    videoId: 'v1',
    title: 'x',
    views: 1000,
    firstDaysShare: null,
    shortsFeedShare: 0.9,
    engagedRate: 0.5,
    estSwipeAway: 0.5,
    channelMedianSwipeAway: null,
    durationSec: 25,
    avgViewSec: 15,
    avgViewPct: 60,
    completion: { ofViews: 0.3, ofStarted: 0.3 },
    exitWindow: null,
    halfGoneAtSec: null,
    biggestDrop: null,
    day1Views: null,
    day2Views: null,
    relativeRetention: 0.5,
    likeRate: null,
    interactions: { likes: 20, comments: 3, shares: 2 },
    daily: [],
    curve: [],
    ...over,
  }) as ShortTimeline;

describe('topic grouping', () => {
  it('accepts a grouping only when every Short is in exactly one group', () => {
    const ids = ['a', 'b', 'c'];
    expect(validGroups({ groups: [{ name: 'Fixes', ids: ['a', 'b'] }, { name: 'Reviews', ids: ['c'] }] }, ids)).toHaveLength(2);
    expect(validGroups({ groups: [{ name: 'Fixes', ids: ['a', 'b'] }] }, ids)).toBeNull();
    expect(validGroups({ groups: [{ name: 'Fixes', ids: ['a', 'b', 'b', 'c'] }] }, ids)).toBeNull();
    expect(validGroups({ groups: [{ name: 'Fixes', ids: ['a', 'b', 'c', 'z'] }] }, ids)).toBeNull();
  });
});

describe('topics', () => {
  // Detail Dose-like: problem fixes do well, model-number reviews don't.
  const shorts = [short(1, 3, 739), short(2, 14, 972), short(3, 15, 63), short(4, 17, 103), short(5, 18, 672), short(6, 19, 2117)];
  const groups: TopicGroup[] = [
    { name: 'Car fixes', videoIds: ['v1', 'v2', 'v5', 'v6'] },
    { name: 'Product reviews', videoIds: ['v3', 'v4'] },
  ];

  it('summarises each topic, best first', () => {
    const summaries = topicSummaries(groups, shorts, new Map(), NOW);
    expect(summaries.map((s) => s.name)).toEqual(['Car fixes', 'Product reviews']);
    expect(summaries[0]).toMatchObject({ shorts: 4, medianViews: 855.5, best: { views: 2117 } });
    expect(summaries[1].medianViews).toBe(83);
  });

  it('flags a Short on a topic none of the Shorts before it had, when it got fewer views than usual', () => {
    const topicOf = topicIndex(groups);
    const summaries = topicSummaries(groups, shorts, new Map(), NOW);
    // v4 (17 days ago) came after v5 and v6 (car fixes) only: two before it, too few to judge.
    expect(newTopicJudgement(shorts[3], shorts, topicOf, 700, summaries, [])).toBeNull();
    // A Short with three car-fix Shorts before it, on a new topic, under the usual views.
    const later = short(7, 1, 90);
    const judged = newTopicJudgement(later, [...shorts, later], new Map([...Array.from(topicOf), ['v7', 'Gaming']]), 700, summaries, []);
    expect(judged?.cause).toBe('new_topic');
    expect(judged?.reason).toMatch(/new topic for your channel: “Gaming”/);
    expect(judged?.fix).toMatch(/stay with “Car fixes”/);
  });

  it('does not call it a topic switch when every Short is on its own subject', () => {
    const own = [short(1, 20, 1000), short(2, 21, 1000), short(3, 22, 1000), short(4, 23, 1000)];
    const later = short(5, 1, 90);
    const topicOf = new Map([...own, later].map((v) => [v.id, `Subject ${v.id}`]));
    expect(newTopicJudgement(later, [...own, later], topicOf, 700, [], [])).toBeNull();
  });

  it('does not flag a new topic that did as well as usual', () => {
    const later = short(7, 1, 5000);
    expect(newTopicJudgement(later, [...shorts, later], new Map([...Array.from(topicIndex(groups)), ['v7', 'Gaming']]), 700, [], [])).toBeNull();
  });
});

describe('steps', () => {
  it('stops at "stopped scrolling" when most swipe', () => {
    const gates = gatesFor(timeline({ estSwipeAway: 0.79 }), 'weak_hook', true);
    expect(gates.map((g) => g.state)).toEqual(['pass', 'fail', 'pass', 'pass']);
    expect(gates[1].note).toBe('21 of every 100 didn’t swipe away');
    expect(stopPointOf(gates)).toBe('stopped');
  });

  it('stops at "shown" with no views', () => {
    expect(stopPointOf(gatesFor(timeline({ views: 0 }), 'not_shown', false))).toBe('shown');
  });

  it('marks few reactions, and passes everything else', () => {
    const gates = gatesFor(timeline({ interactions: { likes: 2, comments: 0, shares: 0 } }), 'ok', false);
    expect(gates[3]).toMatchObject({ state: 'fail', note: '0.2% engagement' });
    expect(stopPointOf(gatesFor(timeline(), 'ok', false))).toBe('none');
  });

  it('skips steps without data to the first real failure', () => {
    const gates = gatesFor(timeline({ estSwipeAway: null, avgViewPct: 20 }), 'left_early', false);
    expect(gates[1].state).toBe('unknown');
    expect(stopPointOf(gates)).toBe('stayed');
  });
});
