/**
 * Where the channel's Shorts stand, from its own numbers: is YouTube still testing each Short on
 * new people, finding an audience (the floor is rising), steady, or slowing? Pure.
 *
 * This is a reading, not a YouTube status: YouTube has no official "discovery phase" and judges
 * each Short on its own. Public view counts are used because most of a Short's views arrive in its
 * first days, so a Short a couple of days old is already close to its total.
 */
import { median } from '../analysis/stats';
import type { VideoMeta } from '../types';
import { VIEWS_RULES as R } from './rules-config';
import type { ChannelStage, ShortTimeline, StageWindow } from './types';

const DAY_MS = 86_400_000;
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const pct = (v: number) => `${Math.round(v * 100)}%`;

function windowOf(shorts: VideoMeta[], feed: Map<string, number | null>): StageWindow {
  const views = shorts.map((v) => v.lifetimeViews as number);
  return {
    count: shorts.length,
    medianViews: median(views) ?? 0,
    floorViews: Math.min(...views),
    maxViews: Math.max(...views),
    feedShare: median(shorts.map((v) => feed.get(v.id)).filter((x): x is number => typeof x === 'number')),
  };
}

export function channelStage(
  shorts: VideoMeta[],
  timelines: ShortTimeline[],
  channel: { subscriberCount: number | null; createdAt: string | null },
  now: Date
): ChannelStage {
  const S = R.stage;
  const ageDays = (iso: string) => (now.getTime() - Date.parse(iso)) / DAY_MS;
  const eligible = shorts
    .filter((v) => v.lifetimeViews !== null && ageDays(v.publishedAt) >= S.minAgeDays)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const size = Math.min(S.window, Math.floor(eligible.length / 2));
  const feed = new Map(timelines.map((t) => [t.videoId, t.shortsFeedShare]));
  const base = {
    shortsCompared: size * 2,
    subscribers: channel.subscriberCount,
    channelAgeDays: channel.createdAt ? Math.max(0, Math.floor(ageDays(channel.createdAt))) : null,
  };

  if (size < S.minWindow) {
    return {
      ...base,
      shortsCompared: 0,
      id: 'not_enough',
      title: 'Too early to see a trend',
      detail: `We compare your newest Shorts with the ones before them, which needs at least ${S.minWindow * 2} Shorts that are ${S.minAgeDays}+ days old. You have ${eligible.length}.`,
      recent: null,
      previous: null,
    };
  }

  const recent = windowOf(eligible.slice(0, size), feed);
  const previous = windowOf(eligible.slice(size, size * 2), feed);
  const last = `your last ${size} Shorts`;
  const before = `the ${size} before`;
  const feedNote =
    recent.feedShare !== null && previous.feedShare !== null && recent.feedShare - previous.feedShare >= 0.1
      ? ` More of their views come from the Shorts feed (${pct(recent.feedShare)}, up from ${pct(previous.feedShare)}).`
      : '';

  if (recent.floorViews >= previous.floorViews * S.risingFloor && recent.medianViews >= previous.medianViews * S.risingMedian) {
    return {
      ...base,
      id: 'finding_audience',
      title: 'Finding your audience',
      detail: `Each of ${last} got at least ${n(recent.floorViews)} views (median ${n(recent.medianViews)}); ${before} got as few as ${n(previous.floorViews)} (median ${n(previous.medianViews)}). Your floor is rising: YouTube is finding people who watch your Shorts.${feedNote} Keep making what the recent ones have in common.`,
      recent,
      previous,
    };
  }
  if (recent.medianViews <= previous.medianViews * S.slowingMedian) {
    return {
      ...base,
      id: 'slowing',
      title: 'Fewer views than before',
      detail: `${cap(last)} got a median of ${n(recent.medianViews)} views, down from ${n(previous.medianViews)} for ${before}. Compare what changed between them: the topic, the first second, the length.`,
      recent,
      previous,
    };
  }
  if (recent.maxViews >= Math.max(1, recent.floorViews) * S.testingSwing) {
    return {
      ...base,
      id: 'testing',
      title: 'Still being tested',
      detail: `Views swing a lot: ${last} got between ${n(recent.floorViews)} and ${n(recent.maxViews)}. YouTube is still testing each Short on new people, which is normal for a young channel. Look at what the strongest one did differently.`,
      recent,
      previous,
    };
  }
  return {
    ...base,
    id: 'steady',
    title: 'Steady',
    detail: `${cap(last)} are close to ${before} (median ${n(recent.medianViews)} vs ${n(previous.medianViews)}). YouTube has a settled audience for your Shorts; to grow, test one change at a time.`,
    recent,
    previous,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
