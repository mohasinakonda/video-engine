'use client';

import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RetentionAnomaly, RetentionPoint } from '@/lib/youtube/types';
import { formatDuration } from './format';

const MARKER_COLOR: Record<RetentionAnomaly['kind'], string> = {
  early_exit: '#f43f5e',
  steep_drop: '#f43f5e',
  rewatch_spike: '#34d399',
  weak_vs_similar: '#f59e0b',
};

/** Audience retention curve with the detected moments marked. */
export function RetentionChart({
  points,
  anomalies,
  durationSec,
}: {
  points: RetentionPoint[];
  anomalies: RetentionAnomaly[];
  durationSec: number | null;
}) {
  const data = points.map((p) => ({ x: p.ratio, watching: Math.round(p.watchRatio * 1000) / 10 }));
  const label = (ratio: number) => (durationSec ? formatDuration(ratio * durationSec) : `${Math.round(ratio * 100)}%`);
  const nearest = (ratio: number) => data.reduce((best, d) => (Math.abs(d.x - ratio) < Math.abs(best.x - ratio) ? d : best), data[0]);

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 1]}
            tickFormatter={label}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 14 }}
            labelFormatter={(x) => label(Number(x))}
            formatter={(v) => [`${v}% still watching`, 'Retention']}
          />
          <Line type="monotone" dataKey="watching" stroke="#e4e4e7" strokeWidth={2} dot={false} />
          {anomalies
            .filter((a) => a.severity !== 'minor')
            .map((a, i) => {
              const point = nearest(a.atRatio);
              return point ? (
                <ReferenceDot key={i} x={point.x} y={point.watching} r={5} fill={MARKER_COLOR[a.kind]} stroke="#09090b" />
              ) : null;
            })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
