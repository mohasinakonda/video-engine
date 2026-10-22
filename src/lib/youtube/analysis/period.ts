import type { DateRange, RangeKey } from '../types';

/** YouTube Analytics data lags; the last few days are usually incomplete. */
export const DATA_LAG_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS: Record<RangeKey, number> = { '28d': 28, '90d': 90 };

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * The selected period, ending on the last fully reported day, and the previous period of
 * exactly the same length immediately before it.
 */
export function getPeriods(range: RangeKey, now: Date = new Date()): { current: DateRange; previous: DateRange } {
  const days = RANGE_DAYS[range];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = today - DATA_LAG_DAYS * DAY_MS;
  const start = end - (days - 1) * DAY_MS;
  const prevEnd = start - DAY_MS;
  const prevStart = prevEnd - (days - 1) * DAY_MS;
  return {
    current: { startDate: iso(start), endDate: iso(end), days },
    previous: { startDate: iso(prevStart), endDate: iso(prevEnd), days },
  };
}

/** Whole days between two dates (YYYY-MM-DD or ISO). */
export function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);
}

export function isRangeKey(value: unknown): value is RangeKey {
  return value === '28d' || value === '90d';
}
