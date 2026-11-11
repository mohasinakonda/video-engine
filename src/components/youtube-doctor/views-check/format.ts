/** Number and text formatting shared by the views check report. */
import type { Interactions, TestSignalId } from '@/lib/youtube/views-check/types';

export const DAY_MS = 86_400_000;

/** 0.42 → "42%" */
export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`;
}

/** 3737 → "3,737" */
export function num(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-US');
}

/** 67 → "1:07" */
export function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

/** "1 day", "3 days" */
export function plural(n: number, word: string): string {
  return `${num(n)} ${word}${n === 1 ? '' : 's'}`;
}

export function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** Share who watched to the end; above 100% means rewatches/loops, not more people. */
export function endPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v > 1 ? `${Math.round(v * 100)}% (loops)` : `${Math.round(v * 100)}%`;
}

/** A test signal as shown: stayed is shown as swiped away (1 − stayed), as in YouTube Studio. */
export function signalText(id: TestSignalId, v: number | null): string {
  if (v === null) return '—';
  if (id === 'stayed') return `${Math.round((1 - v) * 100)}%`;
  if (id === 'watched') return `${Math.round(v * 100)}%`;
  return `${v.toFixed(1)}%`;
}

export const SIGNAL_LABEL: Record<TestSignalId, string> = {
  stayed: 'Swiped away',
  watched: 'Watched',
  reacted: 'Engagement',
};

/** (likes + comments + shares) ÷ views, in percent. */
export function engagementPct(interactions: Interactions | null | undefined, views: number): number | null {
  if (!interactions || views <= 0) return null;
  return ((interactions.likes + interactions.comments + interactions.shares) / views) * 100;
}

/** "today", "1 day ago", "74 days ago" */
export function ageText(publishedAt: string, now: string): string {
  const days = Math.max(0, Math.floor((Date.parse(now) - Date.parse(publishedAt)) / DAY_MS));
  return days === 0 ? 'today' : `${plural(days, 'day')} ago`;
}
