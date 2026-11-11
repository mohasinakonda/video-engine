/**
 * The Trust Score (YRDS) of a Short: how its first viewers reacted next to the channel's other
 * Shorts. Pure.
 *
 * For each metric, R = this Short ÷ the median of the channel's other Shorts (3 or more), and
 * S = min(100, 50 × R). Trust Score = 0.35·S(viewed) + 0.30·S(average % viewed) + 0.15·S(shares)
 * + 0.10·S(likes) + 0.10·S(subscribers), with shares, likes and subscribers per engaged view.
 * 50 = as good as the usual Short; 100 = twice as good or better. A metric that can't be read is
 * left out and its weight shared among the rest.
 *
 * "Viewed vs swiped away" isn't in the YouTube API, so viewed is estimated as engaged ÷ views.
 * A Rendoza model, not YouTube's formula (YouTube publishes none). How well it fits each channel is
 * measured on that channel's own views: see `testAgreement`.
 */
import { median } from '../analysis/stats';
import { VIEWS_RULES as R } from './rules-config';
import type { DayViews, RoundRates, ShortTest, ShortTimeline, TestRound, TestRounds, TestSignal, TestSignalId, TrustSignalId } from './types';

const IDS: TrustSignalId[] = ['viewed', 'watched', 'shares', 'likes', 'subscribed'];
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const rate = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;

/** A Short's value for one Trust Score metric (see TestSignal.value); null when it can't be read. */
export function trustValue(t: ShortTimeline, id: TrustSignalId): number | null {
  if (t.views <= 0 || t.engagedRate === null) return null;
  if (id === 'viewed') return t.engagedRate;
  if (id === 'watched') return t.avgViewPct === null ? null : t.avgViewPct / 100;
  const engaged = t.engagedRate * t.views;
  if (engaged <= 0) return null;
  if (id === 'subscribed') return t.subscribersGained === null ? null : t.subscribersGained / engaged;
  if (!t.interactions) return null;
  return (id === 'shares' ? t.interactions.shares : t.interactions.likes) / engaged;
}

/** "62% swiped away", "65% viewed", "0.8% shared". Viewed is shown as swiped away (1 − viewed), as in YouTube Studio. */
function show(id: TrustSignalId, v: number): string {
  if (id === 'viewed') return `${Math.round((1 - v) * 100)}% swiped away`;
  if (id === 'watched') return `${Math.round(v * 100)}% viewed`;
  if (id === 'shares') return `${rate(v)} shared`;
  if (id === 'likes') return `${rate(v)} liked`;
  return `${rate(v)} subscribed`;
}

function problem(s: TestSignal): string {
  const usual = `your usual Short: ${show(s.id, s.usual)}`;
  if (s.id === 'viewed') return `${Math.round((1 - s.value) * 100)}% swiped it away in the first seconds (${usual})`;
  if (s.id === 'watched') return `people watched only ${Math.round(s.value * 100)}% of it on average (${usual})`;
  if (s.id === 'shares') return `fewer people shared it: ${rate(s.value)} of viewers (${usual})`;
  if (s.id === 'likes') return `fewer people liked it: ${rate(s.value)} of viewers (${usual})`;
  return `fewer viewers subscribed: ${rate(s.value)} (${usual})`;
}

const FIX: Record<TrustSignalId, string> = {
  viewed: 'Open with the most interesting moment in the very first second: no intro, no setup.',
  watched: 'Make it shorter, or show the payoff earlier so people stay to the end.',
  shares: 'Make it worth sending to a friend: a useful tip, a surprise, or something people relate to.',
  likes: 'Give people a reason to react: end on a surprise, or a result they can see.',
  subscribed: 'Tell viewers what they get from your channel, and make each Short part of a series.',
};

/** What to change when a round's number fell (the per-day signals). */
const ROUND_FIX: Record<TestSignalId, string> = {
  stayed: FIX.viewed,
  watched: FIX.watched,
  reacted: 'Give people a reason to react: end on a surprise, or ask a question they want to answer.',
};

/** The Trust Score of one Short, against the channel's other Shorts. Null without enough numbers. */
export function shortTest(t: ShortTimeline, all: ShortTimeline[], usualViews: number | null): ShortTest | null {
  const T = R.test;
  const signals: TestSignal[] = [];
  for (const id of IDS) {
    const value = trustValue(t, id);
    if (value === null) continue;
    const pool = all
      .filter((o) => o.videoId !== t.videoId)
      .map((o) => trustValue(o, id))
      .filter((v): v is number => v !== null);
    if (pool.length < T.minOthers) continue;
    const usual = median(pool) as number;
    // A median of 0 (e.g. most Shorts got no shares): any at all is better than usual, none is usual.
    const ratio = usual > 0 ? value / usual : value > 0 ? T.max / T.scale : 1;
    signals.push({ id, value, usual, benchmark: usual, ratio, score: Math.min(T.max, T.scale * ratio) });
  }
  if (!signals.some((s) => s.id === 'viewed' || s.id === 'watched') || signals.length < 2) return null;

  const weight = signals.reduce((sum, x) => sum + T.weights[x.id], 0);
  const score = Math.round(signals.reduce((sum, x) => sum + T.weights[x.id] * x.score, 0) / weight);
  // The weakest signal that counts most: below usual, ranked by the points it cost.
  const behind = signals.filter((x) => x.ratio < 1).sort((a, b) => T.weights[b.id] * (T.scale - b.score) - T.weights[a.id] * (T.scale - a.score))[0] ?? null;
  const result: ShortTest['result'] = score >= T.pass ? 'passed' : score >= T.close ? 'close' : 'failed';

  // Said as the Trust Score: how viewers reacted next to the channel's usual Short (50). No pass or fail.
  const reason = behind ? problem(behind) : 'viewers reacted less than to your usual Short';
  let message: string;
  if (result === 'failed') {
    message = `Viewers reacted less than to your usual Short. Biggest reason: ${reason}.`;
  } else if (result === 'close') {
    message = `Close to your usual Short. What held it back: ${reason}.`;
  } else if (usualViews !== null && t.views < usualViews) {
    message = `Viewers liked it at least as much as your usual Short, yet it got fewer views (${n(t.views)}; usual ${n(usualViews)}). The reason is likely outside the video: fewer people are interested in this topic, or other Shorts won the next round.`;
  } else {
    message = `Viewers liked it more than your usual Short, so YouTube kept showing it to more people.`;
  }
  return { score, result, signals, weakest: behind?.id ?? null, message, fix: behind ? FIX[behind.id] : null };
}

/**
 * How often the test score ranks the channel's Shorts the way their views do: of each pair of Shorts
 * whose views clearly differ, does the one with the higher score have more views? Null with too few pairs.
 */
export function testAgreement(items: { views: number; score: number }[]): { agreed: number; pairs: number } | null {
  let agreed = 0;
  let pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [items[i], items[j]];
      const hi = Math.max(a.views, b.views);
      const lo = Math.max(1, Math.min(a.views, b.views));
      if (hi / lo < R.test.pairViewsRatio || a.score === b.score) continue;
      pairs++;
      if (a.views > b.views === a.score > b.score) agreed++;
    }
  }
  return pairs >= R.test.minPairs ? { agreed, pairs } : null;
}

// ─── The three rounds ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const SIGNAL_DROP: Record<TestSignalId, string> = {
  stayed: 'more people swiped it away',
  watched: 'people watched less of it',
  reacted: 'engagement fell',
};

function ratesOf(rows: DayViews[], days: number): RoundRates {
  const views = rows.reduce((s, r) => s + r.views, 0);
  const engaged = rows.reduce((s, r) => s + r.engagedViews, 0);
  const withPct = rows.filter((r) => typeof r.avgViewPct === 'number' && r.views > 0);
  const pctViews = withPct.reduce((s, r) => s + r.views, 0);
  const withReact = rows.filter((r) => typeof r.likes === 'number');
  const reactViews = withReact.reduce((s, r) => s + r.views, 0);
  const reactions = withReact.reduce((s, r) => s + (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0), 0);
  return {
    views,
    perDay: views / days,
    stayed: views > 0 ? Math.min(1, engaged / views) : null,
    watched: pctViews > 0 ? withPct.reduce((s, r) => s + (r.avgViewPct as number) * r.views, 0) / pctViews / 100 : null,
    reacted: reactViews > 0 ? (reactions / reactViews) * 100 : null,
  };
}

/** "more people swiped it away: 61%, up from 40% on day 1" */
function dropLine(id: TestSignalId, now: number, before: number, prevDay: number): string {
  if (id === 'stayed') return `${SIGNAL_DROP[id]}: ${Math.round((1 - now) * 100)}%, up from ${Math.round((1 - before) * 100)}% on day ${prevDay}`;
  const fmt = (v: number) => (id === 'reacted' ? `${v.toFixed(1)}%` : `${Math.round(v * 100)}%`);
  return `${SIGNAL_DROP[id]}: ${fmt(now)}, down from ${fmt(before)} on day ${prevDay}`;
}

/**
 * YouTube's test as rounds, one per day since upload (Analytics has no hours): round 1 = day 1
 * (the first viewers), round 2 = day 2, round 3 = day 3. Each round shows that day's views and what
 * those viewers did.
 *   Round 1 passes with at least the channel's usual first-day views.
 *   Rounds 2 and 3 pass only with more views than the day before (YouTube widened it).
 * Where a round fails, the reason is the rate that fell that day compared with the day before
 * (day 1: compared with the channel's usual Short). Pure.
 */
export function testRounds(daily: DayViews[], publishedAt: string, reportedDays: number, test: ShortTest | null, usualFirstDay: number | null): TestRounds | null {
  const C = R.rounds;
  const pub = Date.parse(publishedAt.slice(0, 10));
  const byDay = new Map<number, DayViews>();
  for (const r of daily) {
    const i = Math.round((Date.parse(r.date) - pub) / DAY_MS);
    if (i >= 0) byDay.set(i, r);
  }
  if (!byDay.size || reportedDays < 1) return null;
  const viewsOn = (i: number) => byDay.get(i)?.views ?? 0;
  const reported = (i: number) => i < reportedDays;

  const rounds: TestRound[] = [];
  for (let k = 1; k <= C.count; k++) {
    const i = k - 1;
    const row = byDay.get(i);
    if (!reported(i)) {
      rounds.push({ no: k as 1 | 2 | 3, date: null, state: 'no_data', rates: null, change: null });
      continue;
    }
    const views = viewsOn(i);
    const change = k > 1 && viewsOn(i - 1) > 0 ? views / viewsOn(i - 1) : null;
    const pass = k === 1 ? views > 0 && (usualFirstDay === null || views >= usualFirstDay) : views > viewsOn(i - 1);
    rounds.push({ no: k as 1 | 2 | 3, date: row?.date ?? null, state: pass ? 'pass' : 'fail', rates: ratesOf(row ? [row] : [], 1), change });
  }
  const failed = rounds.find((r) => r.state === 'fail');
  const failedAt = failed?.no ?? null;
  const passedAll = rounds.every((r) => r.state === 'pass');
  const after = C.count;
  const nextDay = reported(after) ? { views: viewsOn(after), change: viewsOn(after - 1) > 0 ? viewsOn(after) / viewsOn(after - 1) : null } : null;

  let dropped: TestSignalId | null = null;
  let why = '';
  if (failedAt) {
    const today = rounds[failedAt - 1].rates;
    const before = failedAt > 1 ? rounds[failedAt - 2].rates : null;
    const ids: TestSignalId[] = ['stayed', 'watched', 'reacted'];
    if (!today || today.views < C.minViews) {
      why = ' Too few views that day to tell which number fell.';
    } else if (before && before.views >= C.minViews) {
      const drops = ids
        .map((id) => ({ id, now: today[id], prev: before[id] }))
        .filter((d): d is { id: TestSignalId; now: number; prev: number } => d.now !== null && d.prev !== null && d.prev > 0)
        .map((d) => ({ ...d, ratio: d.now / d.prev }))
        .filter((d) => d.ratio < C.drop)
        .sort((a, b) => a.ratio - b.ratio);
      if (drops[0]) {
        dropped = drops[0].id;
        why = ` On day ${failedAt}, ${dropLine(dropped, drops[0].now, drops[0].prev, failedAt - 1)}.`;
      } else {
        why = ` Viewers on day ${failedAt} reacted about as well as on day ${failedAt - 1}, so the likely reason is outside the video: fewer new people are interested in this topic, or other Shorts got better reactions.`;
      }
    } else if (failedAt === 1 && test) {
      const daily: Partial<Record<TrustSignalId, TestSignalId>> = { viewed: 'stayed', watched: 'watched' };
      const below = test.signals
        .filter((sig) => daily[sig.id] && sig.usual > 0)
        .map((sig) => ({ ...sig, value: today[daily[sig.id] as TestSignalId] ?? sig.value }))
        .map((sig) => ({ ...sig, ratio: sig.value / sig.usual }))
        .filter((sig) => sig.ratio < C.drop)
        .sort((a, b) => a.ratio - b.ratio)[0];
      if (below) {
        dropped = daily[below.id] as TestSignalId;
        why = ` The first viewers liked it less than your usual Short: ${problem(below)}.`;
      }
    }
  }

  const v = (k: number) => n(viewsOn(k - 1));
  let message: string;
  if (failedAt === 1) {
    message = `Day 1 got ${v(1)} views${usualFirstDay !== null ? `, under your usual first day (${n(usualFirstDay)})` : ''}: the first viewers didn’t pass YouTube’s test.${why}`;
  } else if (failedAt) {
    const share = Math.round((rounds[failedAt - 1].change ?? 0) * 100);
    const passed =
      failedAt === 2 ? `Day 1 passed (${v(1)} views${usualFirstDay !== null ? `; your usual first day: ${n(usualFirstDay)}` : ''})` : `Views grew on day 2 (${v(1)} → ${v(2)})`;
    message = `${passed}. Day ${failedAt} didn’t grow: ${v(failedAt)} views, ${share}% of day ${failedAt - 1}, so YouTube didn’t widen it.${why} That’s why it didn’t go viral.`;
  } else if (passedAll) {
    message = `Views grew every day (${v(1)} → ${v(2)} → ${v(3)}): YouTube kept widening it. This is how a Short spreads.`;
  } else {
    const done = rounds.filter((r) => r.state === 'pass').length;
    message = `${done} day${done === 1 ? '' : 's'} passed so far. The next day isn’t in YouTube Analytics yet (about 3 days behind). Check again soon.`;
  }
  return {
    rounds,
    failedAt,
    passedAll,
    usualFirstDay,
    dropped,
    nextDay,
    message,
    fix: dropped ? ROUND_FIX[dropped] : failedAt ? 'Try the same kind of Short on a topic more people care about, and compare.' : null,
  };
}
