/**
 * YouTube retention → seconds, the channel's "usual Short", and where viewers fall away.
 * Pure, so it is tested without the API.
 */
import { RULES } from './rules-config';
import { median, round } from './signals';
import type { RetentionPoint } from './types';

interface RawPoint {
  /** `elapsedVideoTimeRatio`, 0.01–1. */
  ratio: number;
  /** `audienceWatchRatio`: can be above 1 for Shorts because of loops. */
  watchRatio: number;
}

/**
 * Converts one video's retention to "percent of starting viewers" per whole second.
 * The start is the first reported point, so the curve begins at 100 even when loops push the
 * raw values above 1.
 */
export function normalizeRetention(points: RawPoint[], durationSec: number): RetentionPoint[] {
  const sorted = points.filter((p) => Number.isFinite(p.ratio) && Number.isFinite(p.watchRatio)).sort((a, b) => a.ratio - b.ratio);
  if (sorted.length < 5 || durationSec <= 0) return [];
  const start = sorted[0].watchRatio;
  if (start <= 0) return [];

  const at = (ratio: number) => {
    if (ratio <= sorted[0].ratio) return sorted[0].watchRatio;
    for (let i = 1; i < sorted.length; i++) {
      if (ratio <= sorted[i].ratio) {
        const a = sorted[i - 1];
        const b = sorted[i];
        return a.watchRatio + (b.watchRatio - a.watchRatio) * ((ratio - a.ratio) / (b.ratio - a.ratio));
      }
    }
    return sorted[sorted.length - 1].watchRatio;
  };

  const out: RetentionPoint[] = [];
  for (let sec = 0; sec <= Math.floor(durationSec); sec++) {
    out.push({ sec, pct: round((at(sec / durationSec) / start) * 100, 1) });
  }
  return out;
}

/** The median curve of several Shorts, per second, only where at least `RULES.minBaselineShorts` cover that second. */
export function usualCurve(curves: RetentionPoint[][]): RetentionPoint[] | null {
  const usable = curves.filter((c) => c.length > 0);
  if (usable.length < RULES.minBaselineShorts) return null;
  const maxSec = Math.max(...usable.map((c) => c[c.length - 1].sec));
  const out: RetentionPoint[] = [];
  for (let sec = 0; sec <= maxSec; sec++) {
    const values = usable.map((c) => c.find((p) => p.sec === sec)?.pct).filter((v): v is number => v !== undefined);
    if (values.length < RULES.minBaselineShorts) break;
    out.push({ sec, pct: round(median(values) as number, 1) });
  }
  return out.length ? out : null;
}

export function pctAt(curve: RetentionPoint[], sec: number): number | null {
  if (curve.length === 0) return null;
  if (sec <= curve[0].sec) return curve[0].pct;
  for (let i = 1; i < curve.length; i++) {
    if (sec <= curve[i].sec) {
      const a = curve[i - 1];
      const b = curve[i];
      return a.pct + (b.pct - a.pct) * ((sec - a.sec) / (b.sec - a.sec));
    }
  }
  return null;
}

export interface Drop {
  start: number;
  end: number;
  fromPct: number;
  toPct: number;
}

/**
 * Stretches where viewers leave much faster than normal: more than `steepDropPerSec` points a
 * second and, when a baseline exists, clearly faster than the usual Short at the same second.
 * The first seconds always fall fast on Shorts, so there only the baseline can flag a drop.
 */
export function findDrops(curve: RetentionPoint[], usual: RetentionPoint[] | null): Drop[] {
  const steep: boolean[] = [];
  for (let i = 0; i < curve.length - 1; i++) {
    const sec = curve[i].sec;
    const fall = curve[i].pct - curve[i + 1].pct;
    const usualA = usual ? pctAt(usual, sec) : null;
    const usualB = usual ? pctAt(usual, sec + 1) : null;
    const usualFall = usualA !== null && usualB !== null ? usualA - usualB : null;
    if (sec < RULES.dropIgnoreBeforeSec) {
      steep.push(usualFall !== null && fall - usualFall > RULES.steepVsUsualPerSec * 2);
    } else {
      steep.push(fall > RULES.steepDropPerSec && (usualFall === null || fall - usualFall > RULES.steepVsUsualPerSec));
    }
  }

  const drops: Drop[] = [];
  let i = 0;
  while (i < steep.length) {
    if (!steep[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < steep.length && steep[j + 1]) j++;
    drops.push({ start: curve[i].sec, end: curve[j + 1].sec, fromPct: curve[i].pct, toPct: curve[j + 1].pct });
    i = j + 1;
  }
  return drops;
}

/** Average fall per second over a stretch (points of starting viewers). */
export function fallPerSec(curve: RetentionPoint[], start: number, end: number): number | null {
  const a = pctAt(curve, start);
  const b = pctAt(curve, end);
  if (a === null || b === null || end <= start) return null;
  return (a - b) / (end - start);
}
