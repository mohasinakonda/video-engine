/**
 * Plain-language readings on top of the per-Short numbers. Pure.
 * - Topics: the channel's Shorts by topic, and a Short that switched to a new topic.
 * - Steps: shown → stopped scrolling → stayed → reacted; the first failed step is where it stopped.
 */
import { median } from '../analysis/stats';
import type { VideoMeta } from '../types';
import { VIEWS_RULES as R } from './rules-config';
import type { Gate, GateId, ShortTimeline, TopicGroup, TopicSummary, ViewsCause } from './types';

const DAY_MS = 86_400_000;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const n = (v: number) => Math.round(v).toLocaleString('en-US');

interface Judgement {
  cause: ViewsCause;
  reason: string;
  evidence: string[];
  fix: string;
}

/** Swipe-away high on its own, or clearly above the channel's usual. */
export function isHighSwipe(t: ShortTimeline, shortsJudged: number): boolean {
  const O = R.opening;
  return (
    t.estSwipeAway !== null &&
    (t.estSwipeAway >= O.highSwipeAway ||
      (shortsJudged >= O.minShortsForMedian && t.channelMedianSwipeAway !== null && t.estSwipeAway >= t.channelMedianSwipeAway + O.swipeAboveMedian))
  );
}

// ─── Topics ────────────────────────────────────────────────────────────────────

export function topicIndex(groups: TopicGroup[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of groups ?? []) for (const id of g.videoIds) map.set(id, g.name);
  return map;
}

/** Each topic's size, median views (Shorts 2+ days old) and best Short, best topic first. */
export function topicSummaries(groups: TopicGroup[] | null | undefined, shorts: VideoMeta[], timelines: Map<string, ShortTimeline>, now: Date): TopicSummary[] {
  if (!groups?.length) return [];
  const byId = new Map(shorts.map((v) => [v.id, v]));
  const settled = (v: VideoMeta) => v.lifetimeViews !== null && now.getTime() - Date.parse(v.publishedAt) >= R.stage.minAgeDays * DAY_MS;
  return groups
    .map((g) => {
      const videos = g.videoIds.map((id) => byId.get(id)).filter((v): v is VideoMeta => Boolean(v));
      const old = videos.filter(settled);
      const best = [...old].sort((a, b) => (b.lifetimeViews as number) - (a.lifetimeViews as number))[0];
      return {
        name: g.name,
        shorts: videos.length,
        medianViews: median(old.map((v) => v.lifetimeViews as number)),
        medianSwipeAway: median(videos.map((v) => timelines.get(v.id)?.estSwipeAway).filter((x): x is number => typeof x === 'number')),
        best: best ? { videoId: best.id, title: best.title, views: best.lifetimeViews as number } : null,
      };
    })
    .sort((a, b) => (b.medianViews ?? -1) - (a.medianViews ?? -1));
}

/**
 * A Short whose topic none of the channel's previous Shorts had, and that got fewer views than
 * usual. YouTube likely tested it on new viewers who weren't its audience. A likely reading, not a
 * YouTube statement: YouTube judges each Short on its own and publishes no topic rule.
 */
export function newTopicJudgement(
  video: VideoMeta,
  shorts: VideoMeta[],
  topicOf: Map<string, string>,
  usualViews: number | null,
  summaries: TopicSummary[],
  evidence: string[]
): Judgement | null {
  const topic = topicOf.get(video.id);
  if (!topic || usualViews === null || video.lifetimeViews === null || video.lifetimeViews >= usualViews) return null;
  const before = shorts
    .filter((v) => Date.parse(v.publishedAt) < Date.parse(video.publishedAt))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, R.topics.previousShorts);
  if (before.length < R.topics.minPrevious) return null;
  const prevTopics = before.map((v) => topicOf.get(v.id)).filter((t): t is string => Boolean(t));
  if (prevTopics.includes(topic)) return null;

  const counts = new Map<string, number>();
  for (const t of prevTopics) counts.set(t, (counts.get(t) ?? 0) + 1);
  const [main, mainCount] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
  // Only a channel that had a main topic can switch away from it; Shorts that are each on their
  // own subject are not a topic switch.
  if (!main || mainCount < Math.max(2, Math.ceil(before.length / 2))) return null;
  const best = summaries.find((s) => s.shorts >= 2 && s.medianViews !== null && s.name !== topic);
  return {
    cause: 'new_topic',
    reason: `New topic for your channel: “${topic}”. Your ${before.length} Shorts before it were ${main ? `mostly about “${main}”` : 'about other topics'}. YouTube likely tested it on new viewers, and it didn’t find its audience (${n(video.lifetimeViews)} views; your usual Short gets ${n(usualViews)}).`,
    evidence: [`Topic: ${topic}`, ...evidence],
    fix: best
      ? `If you want this topic, post 3–5 Shorts on it in a row so YouTube can find its viewers. Otherwise stay with “${best.name}”, where your Shorts get a median of ${n(best.medianViews as number)} views.`
      : 'If you want this topic, post 3–5 Shorts on it in a row so YouTube can find its viewers.',
  };
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

export function gatesFor(t: ShortTimeline, cause: ViewsCause, highSwipe: boolean): Gate[] {
  const O = R.opening;
  const unknown = (id: GateId, note = 'No data yet'): Gate => ({ id, state: 'unknown', note });

  if (t.views === 0 || cause === 'not_shown') {
    return [{ id: 'shown', state: 'fail', note: '0 views' }, unknown('stopped', '—'), unknown('stayed', '—'), unknown('reacted', '—')];
  }
  const feedLow = cause === 'not_in_feed';
  const shown: Gate = {
    id: 'shown',
    state: feedLow ? 'fail' : 'pass',
    note: t.shortsFeedShare !== null ? `${pct(t.shortsFeedShare)} of views from the Shorts feed` : `${n(t.views)} views`,
  };

  const stopped: Gate =
    t.estSwipeAway === null
      ? unknown('stopped')
      : { id: 'stopped', state: highSwipe ? 'fail' : 'pass', note: `≈${pct(1 - t.estSwipeAway)} stayed to watch` };

  const weakPct = t.avgViewPct !== null && t.avgViewPct < O.shortsWeakAvgViewPct;
  const weakRelative = t.relativeRetention !== null && t.relativeRetention < O.weakRelative;
  const stayed: Gate =
    t.avgViewPct === null && t.relativeRetention === null
      ? unknown('stayed')
      : {
          id: 'stayed',
          state: weakPct || weakRelative ? 'fail' : 'pass',
          note:
            t.completion !== null
              ? `${pct(Math.min(t.completion.ofViews, 9.99))} watched to the end`
              : `watched ${Math.round(t.avgViewPct as number)}% on average`,
        };

  const i = t.interactions;
  const rate = i && t.views > 0 ? ((i.likes + i.comments + i.shares) / t.views) * 100 : null;
  const reacted: Gate =
    rate === null
      ? unknown('reacted')
      : { id: 'reacted', state: rate < R.reactions.minPer100Views ? 'fail' : 'pass', note: `${rate.toFixed(1)}% engagement` };

  return [shown, stopped, stayed, reacted];
}

/** The first failed step (steps without data are skipped); "unknown" when nothing failed but some steps had no data. */
export function stopPointOf(gates: Gate[]): GateId | 'none' | 'unknown' {
  const failed = gates.find((g) => g.state === 'fail');
  if (failed) return failed.id;
  return gates.some((g) => g.state === 'unknown') ? 'unknown' : 'none';
}
