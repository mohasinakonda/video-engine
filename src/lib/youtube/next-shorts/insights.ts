/**
 * What a channel's own Shorts say, without AI: which ones stop the swipe, where viewers leave,
 * which get rewatched, and which length works. These lines are shown to the creator and given
 * to the AI as the facts to build on.
 */
import { MAX_SECONDS, type Insights, type ShortInput, type ShortStat } from './types';

const WALL_FROM = 2;
const WALL_TO = 9;
/** Seconds either side of the typical drop that still count as "the same wall". */
const WALL_SPAN = 1.5;
/** How much lower than typical a swipe away must be to count as a winning start. */
const WINNER_MARGIN = 0.05;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const per100 = (v: number) => Math.round(v * 100);
const sec = (v: number) => `0:${String(Math.round(v)).padStart(2, '0')}`;
const short = (t: string) => (t.length > 50 ? `${t.slice(0, 47).trimEnd()}…` : t);

function stat(s: ShortInput): ShortStat {
  return {
    videoId: s.videoId,
    title: s.title,
    views: s.views,
    durationSec: s.durationSec,
    swipeAway: s.estSwipeAway,
    watchedPct: s.avgViewPct,
    dropAtSec: s.biggestDrop?.atSec ?? null,
    topic: s.topic ?? null,
  };
}

/** Lower swipe away first; ties by % watched. */
const better = (a: ShortStat, b: ShortStat) => (a.swipeAway ?? 1) - (b.swipeAway ?? 1) || (b.watchedPct ?? 0) - (a.watchedPct ?? 0);

export function readInsights(input: ShortInput[]): Insights {
  const all = input.map(stat);
  const judged = all.filter((s) => s.swipeAway !== null).sort(better);
  const top = Math.max(1, Math.min(3, Math.ceil(judged.length / 3)));
  const typical = median(judged.map((x) => x.swipeAway as number));
  // A winner starts clearly better than the channel's typical Short (always at least the best one).
  const winners = judged.slice(0, top).filter((w, i) => i === 0 || typical === null || (w.swipeAway as number) <= typical - WINNER_MARGIN);
  const losers = [...judged].reverse().slice(0, top);

  // The drop wall: the second where most Shorts lose the most viewers.
  const drops = all.map((s) => s.dropAtSec).filter((v): v is number => v !== null && v >= WALL_FROM && v <= WALL_TO);
  const wallAt = median(drops);
  const atWall = wallAt === null ? 0 : drops.filter((d) => Math.abs(d - wallAt) <= WALL_SPAN).length;
  const dropWall = wallAt !== null && atWall >= 3 && atWall >= all.length / 2 ? { atSec: Math.round(wallAt), shorts: atWall } : null;

  const rewatched = all.filter((s) => (s.watchedPct ?? 0) > 100).sort((a, b) => (b.watchedPct ?? 0) - (a.watchedPct ?? 0));
  const shortOnes = all.filter((s) => s.durationSec !== null && s.durationSec <= MAX_SECONDS).map((s) => s.watchedPct);
  const longOnes = all.filter((s) => s.durationSec !== null && s.durationSec > MAX_SECONDS).map((s) => s.watchedPct);
  const byLength = {
    short: median(shortOnes.filter((v): v is number => v !== null)),
    long: median(longOnes.filter((v): v is number => v !== null)),
  };
  const typicalSwipeAway = typical;

  // Topic with the lowest typical swipe away (2+ Shorts).
  const byTopic = new Map<string, number[]>();
  for (const s of judged) if (s.topic) byTopic.set(s.topic, [...(byTopic.get(s.topic) ?? []), s.swipeAway as number]);
  const topics = Array.from(byTopic.entries())
    .filter(([, v]) => v.length >= 2)
    .map(([name, v]) => ({ name, swipe: median(v) as number }))
    .sort((a, b) => a.swipe - b.swipe);
  const bestTopic = topics[0]?.name ?? null;

  const lines: string[] = [];
  if (typicalSwipeAway !== null) lines.push(`On a typical Short, ${per100(typicalSwipeAway)} of every 100 viewers swipe away in the first 2 seconds (good: under 45).`);
  for (const w of winners) {
    lines.push(`Best start: "${short(w.title)}": ${per100(w.swipeAway as number)} of every 100 swiped away${w.durationSec ? `, ${Math.round(w.durationSec)}s long` : ''}.`);
  }
  if (dropWall) lines.push(`${dropWall.shorts} of ${all.length} Shorts lose the most viewers at about ${sec(dropWall.atSec)}. Something bigger has to happen just before it.`);
  for (const r of rewatched.slice(0, 2)) lines.push(`Rewatched: "${short(r.title)}" was watched ${Math.round(r.watchedPct as number)}% on average, so people watched it again.`);
  if (byLength.short !== null && byLength.long !== null && byLength.short > byLength.long) {
    lines.push(`Shorts up to 30s are watched ${Math.round(byLength.short)}% on average, longer ones only ${Math.round(byLength.long)}%.`);
  }
  if (bestTopic) lines.push(`Best topic: ${bestTopic}.`);
  const worst = losers[0];
  if (worst && winners.every((w) => w.videoId !== worst.videoId)) {
    lines.push(`Weakest start: "${short(worst.title)}": ${per100(worst.swipeAway as number)} of every 100 swiped away. Don't repeat its opening.`);
  }

  return { shorts: judged.length, winners, losers, dropWall, rewatched, byLength, typicalSwipeAway, bestTopic, lines };
}
