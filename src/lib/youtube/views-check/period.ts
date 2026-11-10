import type { DateRange } from '../types';

/** The analytics window for one video: from its publish day (or the period start) to the period end. */
export function videoRange(publishedAt: string, period: DateRange): DateRange | null {
  const published = publishedAt.slice(0, 10);
  if (!published || published > period.endDate) return null;
  const startDate = published > period.startDate ? published : period.startDate;
  const days = Math.floor((Date.parse(period.endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  return { startDate, endDate: period.endDate, days };
}
