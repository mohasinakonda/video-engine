/**
 * The test YouTube runs on every Short, as creators describe it: show it to a first group of
 * viewers, watch what they do (stop scrolling? watch it through? like, comment, share?), and show
 * it to more people only if they liked it more than other Shorts. Pure.
 *
 * Test score = 100 × weighted average of (this Short ÷ benchmark) for
 *   stayed to watch (50%), average viewed (30%), reactions per 100 views (20%),
 * each ratio capped at 1.5. 100 means "as good as your usual Short".
 * Benchmark = the median of the channel's other Shorts (3 or more), never below a healthy floor,
 * so a channel whose usual Short is weak isn't told it's fine.
 *
 * A Rendoza model, not YouTube's formula (YouTube publishes none). How well it fits each channel is
 * measured on that channel's own views: see `testAgreement`.
 */
import { median } from '../analysis/stats';
import { VIEWS_RULES as R } from './rules-config';
import type { DayViews, RoundRates, ShortTest, ShortTimeline, TestRound, TestRounds, TestSignal, TestSignalId } from './types';

const IDS: TestSignalId[] = ['stayed', 'watched', 'reacted'];
const n = (v: number) => Math.round(v).toLocaleString('en-US');

function valueOf(t: ShortTimeline, id: TestSignalId): number | null {
  if (t.views <= 0) return null;
  if (id === 'stayed') return t.engagedRate;
  if (id === 'watched') return t.avgViewPct === null ? null : t.avgViewPct / 100;
  const i = t.interactions;
  return i ? ((i.likes + i.comments + i.shares) / t.views) * 100 : null;
}

/** "62% swiped away", "65%", "1.4 per 100". Stayed is shown as swiped away (1 − stayed), as in YouTube Studio. */
function show(id: TestSignalId, v: number): string {
  if (id === 'stayed') return `${Math.round((1 - v) * 100)}% swiped away`;
  if (id === 'watched') return `${Math.round(v * 100)}%`;
  return `${v.toFixed(1)}% engagement`;
}

function compared(s: TestSignal): string {
  if (s.id === 'stayed') {
    return s.usual !== null && s.usual >= s.benchmark ? `your usual Short: ${show('stayed', s.usual)}` : `a healthy Short: ${Math.round((1 - s.benchmark) * 100)}% or less`;
  }
  return s.usual !== null && s.usual >= s.benchmark ? `your usual Short: ${show(s.id, s.usual)}` : `a healthy Short: ${show(s.id, s.benchmark)} or more`;
}

function problem(s: TestSignal): string {
  if (s.id === 'stayed') return `${Math.round((1 - s.value) * 100)}% swiped it away in the first seconds (${compared(s)})`;
  if (s.id === 'watched') return `people watched only ${show('watched', s.value)} of it on average (${compared(s)})`;
  return `engagement was only ${s.value.toFixed(1)}%`;
}

const FIX: Record<TestSignalId, string> = {
  stayed: 'Open with the most interesting moment in the very first second: no intro, no setup.',
  watched: 'Make it shorter, or show the payoff earlier so people stay to the end.',
  reacted: 'Give people a reason to react: end on a surprise, or ask a question they want to answer.',
};

/** The test result of one Short, against the channel's other Shorts. Null without enough numbers. */
export function shortTest(t: ShortTimeline, all: ShortTimeline[], usualViews: number | null): ShortTest | null {
  const T = R.test;
  const signals: TestSignal[] = [];
  for (const id of IDS) {
    const value = valueOf(t, id);
    if (value === null) continue;
    const pool = all
      .filter((o) => o.videoId !== t.videoId)
      .map((o) => valueOf(o, id))
      .filter((v): v is number => v !== null);
    const usual = pool.length >= T.minOthers ? median(pool) : null;
    const benchmark = Math.max(usual ?? 0, T.floor[id]);
    signals.push({ id, value, usual, benchmark, ratio: Math.min(T.cap, value / benchmark) });
  }
  if (signals.length < 2) return null;

  const weight = signals.reduce((s, x) => s + T.weights[x.id], 0);
  const score = Math.round((100 * signals.reduce((s, x) => s + T.weights[x.id] * x.ratio, 0)) / weight);
  const weakest = [...signals].sort((a, b) => a.ratio - b.ratio)[0];
  const behind = weakest.ratio < 1 ? weakest : null;
  const result: ShortTest['result'] = score >= T.pass ? 'passed' : score >= T.close ? 'close' : 'failed';
  const tested = t.day1Views !== null && t.day1Views > 0 ? `It got ${n(t.day1Views)} views on its first day. ` : '';

  // Said as the Trust Score: how viewers reacted next to the channel's usual Short (100). No pass or fail.
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
export function testRounds(
  daily: DayViews[],
  publishedAt: string,
  reportedDays: number,
  test: ShortTest | null,
  usualFirstDay: number | null
): TestRounds | null {
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
      const below = test.signals
        .map((sig) => ({ ...sig, value: today[sig.id] ?? sig.value }))
        .map((sig) => ({ ...sig, ratio: sig.value / sig.benchmark }))
        .filter((sig) => sig.ratio < C.drop)
        .sort((a, b) => a.ratio - b.ratio)[0];
      if (below) {
        dropped = below.id;
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
    const passed = failedAt === 2 ? `Day 1 passed (${v(1)} views${usualFirstDay !== null ? `; your usual first day: ${n(usualFirstDay)}` : ''})` : `Views grew on day 2 (${v(1)} → ${v(2)})`;
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
    fix: dropped ? FIX[dropped] : failedAt ? 'Try the same kind of Short on a topic more people care about, and compare.' : null,
  };
}
