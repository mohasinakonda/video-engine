/**
 * The Shorts health score (CHS) of a channel. Pure.
 *
 *   CHS = 0.70 × P + 0.30 × T
 *   P = median, over the newest Shorts, of each Short's score against fixed healthy lines:
 *       the Trust Score's 5 metrics and weights, S = min(100, 70 × value ÷ line), 70 = at the line.
 *   T = 70 + (median Trust Score of the newest Shorts − median of the ones before), kept in 0–100.
 * 70 is the bottom of "Healthy": a channel at every line with no change scores 70.
 *
 * P uses fixed lines, not the channel's own median: against its own median every channel would sit
 * at the same score. Missing metrics are left out (weights shared), never counted as 0. Rendoza's score, not
 * YouTube's; it says nothing about restrictions or strikes.
 */
import { median } from '../analysis/stats';
import { VIEWS_RULES as R } from './rules-config';
import { trustValue } from './test-score';
import type { HealthBandId, HealthPart, ShortsHealth, ShortTimeline, TrustSignalId } from './types';

const H = R.health;
const W = R.test.weights;
const IDS: TrustSignalId[] = ['viewed', 'watched', 'shares', 'likes', 'subscribed'];
const NAMES: Record<TrustSignalId, string> = {
  viewed: 'Viewed (not swiped away)',
  watched: 'Average % viewed',
  shares: 'Shares',
  likes: 'Likes',
  subscribed: 'New subscribers',
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const rate = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** The average-%-viewed line for a Short of this length. */
export function watchedLine(durationSec: number | null): number {
  const sec = durationSec ?? 60;
  return H.watchedByLength.find((b) => sec <= b.upToSec)?.line ?? 0.5;
}

function lineOf(id: TrustSignalId, t: ShortTimeline): number {
  return id === 'watched' ? watchedLine(t.durationSec) : H.lines[id as Exclude<TrustSignalId, 'watched'>];
}

const partScore = (value: number, line: number) => Math.min(100, (H.atLine * value) / line);

/** One Short against the healthy lines; null without viewed or watched. */
function absoluteScore(t: ShortTimeline): { score: number; parts: Partial<Record<TrustSignalId, number>> } | null {
  const parts: Partial<Record<TrustSignalId, number>> = {};
  for (const id of IDS) {
    const v = trustValue(t, id);
    if (v !== null) parts[id] = partScore(v, lineOf(id, t));
  }
  if (parts.viewed === undefined && parts.watched === undefined) return null;
  const ids = Object.keys(parts) as TrustSignalId[];
  const weight = ids.reduce((s, id) => s + W[id], 0);
  return { score: ids.reduce((s, id) => s + W[id] * (parts[id] as number), 0) / weight, parts };
}

export function bandOf(score: number): HealthBandId {
  const B = H.bands;
  return score >= B.excellent ? 'excellent' : score >= B.healthy ? 'healthy' : score >= B.average ? 'average' : score >= B.weak ? 'weak' : 'critical';
}

/** "62% swipe away (healthy: 45% or less)" */
function partText(p: Omit<HealthPart, 'text'>): string {
  if (p.id === 'viewed') return `${pct(1 - p.value)} of viewers swipe away (healthy: ${pct(1 - p.line)} or less)`;
  if (p.id === 'watched') return `viewers watch ${pct(p.value)} on average (healthy for this length: ${pct(p.line)}+)`;
  const what = p.id === 'shares' ? 'share' : p.id === 'likes' ? 'like' : 'subscribe';
  return `${rate(p.value)} of viewers ${what} (healthy: ${rate(p.line)}+)`;
}

const DRAG: Record<TrustSignalId, string> = {
  viewed: 'Most viewers swipe away in the first seconds',
  watched: 'Viewers leave before the end',
  shares: 'Few viewers share your Shorts',
  likes: 'Few viewers like your Shorts',
  subscribed: 'Viewers don’t subscribe',
};

/** `shorts`: the channel's judged Shorts, newest first, with their Trust Score filled in. */
export function shortsHealth(shorts: ShortTimeline[]): ShortsHealth {
  const scored = shorts
    .filter((t) => t.views >= H.minViews)
    .slice(0, H.maxShorts)
    .map((t) => ({ t, abs: absoluteScore(t) }))
    .filter((x): x is { t: ShortTimeline; abs: NonNullable<ReturnType<typeof absoluteScore>> } => x.abs !== null);

  if (scored.length < H.minShorts) {
    return {
      score: null,
      band: null,
      provisional: true,
      shorts: scored.length,
      p: null,
      t: null,
      parts: [],
      trend: null,
      headline: 'Not enough data for a score yet.',
      detail: `We need at least ${H.minShorts} Shorts with ${H.minViews}+ views each; you have ${scored.length}.`,
    };
  }

  const p = median(scored.map((x) => x.abs.score)) as number;
  const parts: HealthPart[] = IDS.flatMap((id) => {
    const rows = scored.filter((x) => x.abs.parts[id] !== undefined);
    if (!rows.length) return [];
    return [
      {
        id,
        name: NAMES[id],
        weight: W[id],
        score: Math.round(median(rows.map((x) => x.abs.parts[id] as number)) as number),
        value: median(rows.map((x) => trustValue(x.t, id) as number)) as number,
        line: id === 'watched' ? (median(rows.map((x) => watchedLine(x.t.durationSec))) as number) : H.lines[id as Exclude<TrustSignalId, 'watched'>],
        text: '',
      },
    ];
  });
  for (const part of parts) part.text = partText(part);

  // Trend: Trust Scores (against the channel's own usual Short) of the newest vs the ones before.
  const withTest = scored.filter((x) => x.t.test).map((x) => x.t.test!.score);
  const size = Math.min(H.trendWindow, Math.floor(withTest.length / 2));
  let trend: ShortsHealth['trend'] = null;
  if (size >= H.minTrend) {
    const recent = median(withTest.slice(0, size)) as number;
    const previous = median(withTest.slice(size, size * 2)) as number;
    trend = { recent, previous, diff: recent - previous, recentCount: size, previousCount: size };
  }
  const t = trend ? clamp(H.atLine + trend.diff) : null;
  const score = Math.round(t === null ? p : H.weights.p * p + H.weights.t * t);

  // The one-line problem: the part that costs the most points, or a falling trend when that's worse.
  const costly = [...parts].filter((x) => x.score < H.atLine).sort((a, b) => b.weight * (H.atLine - b.score) - a.weight * (H.atLine - a.score))[0];
  const falling = trend && trend.diff <= -10;
  let headline: string;
  let detail: string;
  if (falling && (!costly || H.weights.t * (H.atLine - (t as number)) > H.weights.p * costly.weight * (H.atLine - costly.score))) {
    headline = 'Main drag: your newest Shorts do worse than the ones before.';
    detail = `Median Trust Score ${Math.round(trend!.recent)} for your last ${trend!.recentCount}, down from ${Math.round(trend!.previous)}.`;
  } else if (costly) {
    headline = `Main drag: ${DRAG[costly.id].charAt(0).toLowerCase()}${DRAG[costly.id].slice(1)}.`;
    detail = `${partText(costly).charAt(0).toUpperCase()}${partText(costly).slice(1)}.`;
  } else {
    headline = 'Your Shorts are at or above the healthy line on every part.';
    detail = trend ? `Median Trust Score ${Math.round(trend.recent)} for your last ${trend.recentCount} (before: ${Math.round(trend.previous)}).` : '';
  }

  return {
    score,
    band: bandOf(score),
    provisional: scored.length < H.confidentShorts,
    shorts: scored.length,
    p: Math.round(p),
    t: t === null ? null : Math.round(t),
    parts,
    trend,
    headline,
    detail,
  };
}
