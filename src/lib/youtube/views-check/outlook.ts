/**
 * Will the channel's Shorts grow? A reading of its own numbers, not a YouTube status. Pure.
 *
 * Two questions, each answered from the newest Shorts:
 * - content: do viewers like them? (median swipe-away against the healthy line)
 * - reach: is YouTube showing them to more people than the Shorts before? (views on the upload
 *   day when known, otherwise total views; most of a Short's views arrive in its first days)
 *
 * The answer is a likelihood for the next weeks. To show how far it can be trusted, the same
 * reading is made as of `checkDays` ago and compared with what happened since.
 */
import { median } from '../analysis/stats';
import { VIEWS_RULES as R } from './rules-config';
import type { GrowthOutlook, GrowthOutlookId, OutlookWindow } from './types';

export interface OutlookShort {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  /** Views on the upload day; null when not known. */
  firstDay: number | null;
  /** Estimated swipe-away (0–1); null when not known. */
  swipeAway: number | null;
  /** Average % viewed (0–100); null when not known. */
  viewPct: number | null;
}

const O = R.outlook;
const DAY_MS = 86_400_000;
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const UP: GrowthOutlookId[] = ['growing', 'will_stall'];

interface Reading {
  id: GrowthOutlookId;
  content: GrowthOutlook['content'];
  reach: GrowthOutlook['reach'];
  best: OutlookShort | null;
  /** Shorts old enough to compare. */
  eligible: number;
}

function windowOf(shorts: OutlookShort[], useFirstDay: boolean): OutlookWindow {
  const firstDays = shorts.map((s) => s.firstDay).filter((v): v is number => v !== null);
  return {
    count: shorts.length,
    medianViews: median(shorts.map((s) => s.views)) ?? 0,
    medianFirstDay: useFirstDay ? median(firstDays) : null,
    zeroViewShare: shorts.filter((s) => s.views === 0).length / shorts.length,
  };
}

/** The reading as of `at`, from Shorts published at least minAgeDays before it. */
function readAt(all: OutlookShort[], at: Date): Reading {
  const eligible = all.filter((s) => at.getTime() - Date.parse(s.publishedAt) >= O.minAgeDays * DAY_MS).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const size = Math.min(O.window, Math.floor(eligible.length / 2));

  // Content: the newest Shorts with enough views for a swipe-away to mean something.
  const rated = eligible.slice(0, Math.max(size, O.minWindow)).filter((s) => s.views >= O.minViewsForSwipe && s.swipeAway !== null);
  const medianSwipeAway = rated.length >= O.minWindow ? median(rated.map((s) => s.swipeAway as number)) : null;
  const viewPcts = rated.map((s) => s.viewPct).filter((v): v is number => v !== null);
  const content: GrowthOutlook['content'] = {
    state: medianSwipeAway === null ? 'unknown' : medianSwipeAway <= O.goodSwipeAway ? 'good' : 'weak',
    medianSwipeAway,
    medianViewPct: viewPcts.length ? median(viewPcts) : null,
    shorts: rated.length,
  };

  if (size < O.minWindow) {
    return { id: 'too_early', content, reach: { state: 'unknown', by: null, change: null, recent: null, previous: null }, best: null, eligible: eligible.length };
  }
  const recentShorts = eligible.slice(0, size);
  const previousShorts = eligible.slice(size, size * 2);
  const known = (list: OutlookShort[]) => list.filter((s) => s.firstDay !== null).length >= O.minWindow;
  const byFirstDay = known(recentShorts) && known(previousShorts);
  const recent = windowOf(recentShorts, byFirstDay);
  const previous = windowOf(previousShorts, byFirstDay);
  const now = byFirstDay ? (recent.medianFirstDay as number) : recent.medianViews;
  const before = byFirstDay ? (previous.medianFirstDay as number) : previous.medianViews;
  const change = before > 0 ? now / before : null;
  const state: GrowthOutlook['reach']['state'] = change === null ? (now > 0 ? 'rising' : 'flat') : change >= O.rising ? 'rising' : change <= O.falling ? 'falling' : 'flat';
  const reach: GrowthOutlook['reach'] = { state, by: byFirstDay ? 'first_day' : 'views', change, recent, previous };
  const best = recentShorts.reduce<OutlookShort | null>((b, s) => (!b || s.views > b.views ? s : b), null);

  if (content.state === 'unknown') return { id: 'too_early', content, reach, best, eligible: eligible.length };
  const id: GrowthOutlookId = content.state === 'good' ? (state === 'rising' ? 'growing' : 'held_back') : state === 'rising' ? 'will_stall' : 'not_growing';
  return { id, content, reach, best, eligible: eligible.length };
}

/** What happened after `at`: did Shorts posted since get more views than the ones before? */
function outcome(all: OutlookShort[], at: Date, now: Date): { grew: boolean; change: number | null } | null {
  const t = at.getTime();
  const after = all.filter((s) => {
    const p = Date.parse(s.publishedAt);
    return p > t && now.getTime() - p >= O.minAgeDays * DAY_MS;
  });
  const before = all.filter((s) => {
    const p = Date.parse(s.publishedAt);
    return p <= t && p > t - O.checkDays * DAY_MS;
  });
  if (after.length < O.minWindow || before.length < O.minWindow) return null;
  const a = median(after.map((s) => s.views)) ?? 0;
  const b = median(before.map((s) => s.views)) ?? 0;
  const change = b > 0 ? a / b : null;
  return { grew: change === null ? a > 0 : change >= O.rising, change };
}

export function growthOutlook(shorts: OutlookShort[], now: Date): GrowthOutlook {
  const reading = readAt(shorts, now);
  const at = new Date(now.getTime() - O.checkDays * DAY_MS);
  const past = readAt(shorts, at);
  const happened = past.id === 'too_early' ? null : outcome(shorts, at, now);
  const check = happened ? { days: O.checkDays, said: past.id, grew: happened.grew, matched: UP.includes(past.id) === happened.grew, change: happened.change } : null;
  return { ...words(reading), content: reading.content, reach: reading.reach, check };
}

function words(r: Reading): Pick<GrowthOutlook, 'id' | 'title' | 'detail' | 'nextStep'> {
  const { content, reach } = r;
  const swipe = content.medianSwipeAway !== null ? pct(content.medianSwipeAway) : null;
  const what = reach.by === 'first_day' ? 'views on the upload day' : 'views';
  const trend =
    reach.recent && reach.previous
      ? `Your newest ${reach.recent.count} Shorts got a median of ${n(reach.by === 'first_day' ? (reach.recent.medianFirstDay as number) : reach.recent.medianViews)} ${what}, vs ${n(
          reach.by === 'first_day' ? (reach.previous.medianFirstDay as number) : reach.previous.medianViews,
        )} for the ${reach.previous.count} before.`
      : '';
  const liked = swipe ? `About ${swipe} of viewers swipe away in the first seconds (a healthy Short: 45% or less).` : '';
  const best = r.best && r.best.views > 0 ? ` Your strongest recent one, “${r.best.title}”, got ${n(r.best.views)} views: find what it did differently.` : '';

  switch (r.id) {
    case 'growing':
      return {
        id: r.id,
        title: 'Likely to grow',
        detail: `Viewers like your newest Shorts and YouTube is showing them to more people. ${trend} ${liked}`.trim(),
        nextStep: `Keep posting what your newest Shorts have in common, on a steady schedule.${best}`,
      };
    case 'held_back':
      return {
        id: r.id,
        title: 'Ready to grow, but reach isn’t moving',
        detail: `Viewers like your Shorts, but YouTube isn’t showing them to more people yet. ${trend} ${liked}`.trim(),
        nextStep: `The Shorts themselves hold viewers, so look outside them: post on a steady schedule, try new topics your viewers search for, and don’t post the same idea twice.${best}`,
      };
    case 'will_stall':
      return {
        id: r.id,
        title: 'Growing for now, likely to stall',
        detail: `YouTube is showing your Shorts to more people, but most of them swipe away, so this growth usually doesn’t last. ${trend} ${liked}`.trim(),
        nextStep: `Fix the first 2 seconds before the reach drops: show the result or the question right away, no intro.${best}`,
      };
    case 'not_growing':
      return {
        id: r.id,
        title: 'Unlikely to grow as things are',
        detail: `Most viewers swipe away and YouTube isn’t showing your Shorts to more people. ${trend} ${liked}`.trim(),
        nextStep: `Start with the first 2 seconds: show the result or the question right away, no intro. Change one thing at a time and compare.${best}`,
      };
    default:
      return {
        id: 'too_early',
        title: 'Too early to tell',
        detail:
          content.state === 'unknown' && reach.recent
            ? `We couldn’t read how many viewers swipe away (each Short needs ${O.minViewsForSwipe}+ views, and we need ${O.minWindow} of them).`
            : `We compare your newest Shorts with the ones before them, which needs at least ${O.minWindow * 2} Shorts that are ${O.minAgeDays}+ days old. You have ${r.eligible}.`,
        nextStep: 'Keep posting and check again in a week or two.',
      };
  }
}
