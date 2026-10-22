'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyPoint } from '@/lib/youtube/types';
import { formatCompact, formatDate } from './format';

const SERIES = {
  views: { label: 'Views', value: (d: DailyPoint) => d.views, format: (v: number) => formatCompact(v) },
  watch: { label: 'Watch hours', value: (d: DailyPoint) => d.minutesWatched / 60, format: (v: number) => `${v.toFixed(1)} h` },
  subs: {
    label: 'Net subscribers',
    value: (d: DailyPoint) => (d.subscribersGained ?? 0) - (d.subscribersLost ?? 0),
    format: (v: number) => (v > 0 ? `+${v}` : `${v}`),
  },
} as const;
type SeriesKey = keyof typeof SERIES;

/** Daily trend for the selected period. Not rendered when there is no daily data. */
export function TrendChart({ daily }: { daily: DailyPoint[] }) {
  const [series, setSeries] = useState<SeriesKey>('views');
  const active = SERIES[series];
  const data = daily.map((d) => ({ date: d.date, value: active.value(d) }));

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">Day by day</h3>
        <div className="flex gap-1" role="tablist">
          {(Object.keys(SERIES) as SeriesKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={series === key}
              onClick={() => setSeries(key)}
              className={`px-3 py-1.5 rounded-md text-sm ${series === key ? 'bg-white text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'}`}
            >
              {SERIES[key].label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d).replace(/ \d{4}$/, '')}
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => active.format(v)}
              tick={{ fill: '#a1a1aa', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 14 }}
              labelFormatter={(d) => formatDate(String(d))}
              formatter={(v) => [active.format(Number(v)), active.label]}
            />
            <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#trendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
