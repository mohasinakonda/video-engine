import { formatCompact } from '@/components/youtube-doctor/format';
import type { ChannelProfile, ResearchWindow } from './types';

interface Row {
  label: string;
  help?: string;
  value: (p: ChannelProfile) => string;
}

const usual = (p: ChannelProfile, format: 'short' | 'video') => {
  const b = p.baselines[format];
  if (b.sampleSize === 0) return '—';
  if (b.strength === 'insufficient' || b.medianViews === null) return `Too few (${b.sampleSize})`;
  return formatCompact(b.medianViews);
};

const ROWS = (period: ResearchWindow): Row[] => [
  { label: 'Uploads, last 30 days', value: (p) => `${p.uploadsLast30Days}${p.coverageDays < 30 ? '+' : ''}` },
  { label: 'Uploads, last 90 days', value: (p) => `${p.uploadsLast90Days}${p.coverageDays < 90 ? '+' : ''}` },
  {
    label: 'Days between uploads',
    help: 'Typical gap over the last 90 days',
    value: (p) => (p.medianDaysBetweenUploads === null ? '—' : p.medianDaysBetweenUploads < 1 ? 'Several a day' : String(p.medianDaysBetweenUploads)),
  },
  { label: 'Shorts', help: 'Share of recent uploads 3 minutes or shorter', value: (p) => (p.shortsShare === null ? '—' : `${Math.round(p.shortsShare * 100)}%`) },
  { label: 'Usual views, long videos', help: 'Median of recent long videos', value: (p) => usual(p, 'video') },
  { label: 'Usual views, Shorts', help: 'Median of recent Shorts', value: (p) => usual(p, 'short') },
  {
    label: 'Videos beating their usual',
    help: `In the last ${period === '30d' ? '30' : '90'} days`,
    value: (p) => (p.eligibleInWindow === 0 ? '—' : `${p.outliersInWindow} of ${p.eligibleInWindow}`),
  },
];

/** You vs each competitor, measured the same way from public data. No subscriber or total-view vanity numbers. */
export function CompareTable({ you, competitors, period }: { you: ChannelProfile; competitors: ChannelProfile[]; period: ResearchWindow }) {
  const columns = [you, ...competitors];
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-white">You vs your competitors</h3>
        <p className="text-sm text-zinc-400 mt-0.5">Everyone measured the same way, from public data. “+” means the channel posts so often we read only part of the period.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-bg-border">
        <table className="w-full text-base">
          <thead>
            <tr className="bg-bg-elevated">
              <th className="text-left font-medium text-zinc-400 p-3 min-w-[200px]" />
              {columns.map((p, i) => (
                <th key={p.channel.id} className={`text-right font-semibold p-3 min-w-[130px] ${i === 0 ? 'text-emerald-300' : 'text-white'}`}>
                  {i === 0 ? 'You' : p.channel.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS(period).map((row) => (
              <tr key={row.label} className="border-t border-bg-border">
                <th scope="row" className="text-left font-normal p-3 align-top">
                  <span className="block text-zinc-200">{row.label}</span>
                  {row.help && <span className="block text-sm text-zinc-500">{row.help}</span>}
                </th>
                {columns.map((p, i) => (
                  <td key={p.channel.id} className={`text-right p-3 tabular-nums align-top ${i === 0 ? 'text-emerald-200 font-semibold' : 'text-zinc-200'}`}>
                    {row.value(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
