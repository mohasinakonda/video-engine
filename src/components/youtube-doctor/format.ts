import type { MetricValue } from '@/lib/youtube/types';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en');

export const formatCompact = (n: number) => compact.format(n);
export const formatWhole = (n: number) => whole.format(Math.round(n));

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${m}:${String(rest).padStart(2, '0')}`;
}

export function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const METRIC_INFO: Record<MetricValue['key'], { label: string; help: string; format: (v: number) => string }> = {
  views: { label: 'Views', help: 'All views in this period, Shorts and videos together.', format: formatCompact },
  watchHours: { label: 'Watch time', help: 'Total hours people spent watching your videos.', format: (v) => `${formatCompact(v)} hours` },
  netSubscribers: { label: 'New subscribers', help: 'Subscribers gained minus subscribers lost.', format: (v) => (v > 0 ? `+${formatWhole(v)}` : formatWhole(v)) },
  avgViewDuration: { label: 'Time per view', help: 'How long one view lasts on average. Shorts make this lower.', format: formatDuration },
  avgViewPct: { label: 'Share watched', help: 'On average, how much of a video people watch before leaving.', format: (v) => `${v.toFixed(0)}%` },
  impressions: { label: 'Times shown', help: 'How often YouTube showed your thumbnails to people.', format: formatCompact },
  ctr: { label: 'Click rate', help: 'Out of every 100 times your thumbnail was shown, how many people clicked.', format: (v) => `${(v * 100).toFixed(1)}%` },
};
