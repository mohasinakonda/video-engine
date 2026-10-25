'use client';

import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RetentionAnomaly, RetentionPoint } from '@/lib/youtube/types';
import { formatDuration } from './format';

const MARKER_COLOR: Record<RetentionAnomaly['kind'], string> = {
  early_exit: '#f43f5e',
  steep_drop: '#f43f5e',
  rewatch_spike: '#10b981',
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
          <CartesianGrid stroke="#E5E0D8" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 1]}
            tickFormatter={label}
            tick={{ fill: '#78716c', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: '#78716c', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #E5E0D8', color: '#1c1917', borderRadius: 8, fontSize: 14 }}
            labelFormatter={(x) => label(Number(x))}
            formatter={(v) => [`${v}% still watching`, 'Retention']}
          />
          <Line type="monotone" dataKey="watching" stroke="#1c1917" strokeWidth={2} dot={false} />
          {anomalies
            .filter((a) => a.severity !== 'minor')
            .map((a, i) => {
              const point = nearest(a.atRatio);
              return point ? (
                <ReferenceDot key={i} x={point.x} y={point.watching} r={5} fill={MARKER_COLOR[a.kind]} stroke="#ffffff" />
              ) : null;
            })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
