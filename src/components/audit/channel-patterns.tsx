'use client';

import { Check, Minus, TrendingUp } from 'lucide-react';
import { formatCompact } from '@/components/youtube-doctor/format';
import type { ChannelPatterns as Patterns, ChartPoint } from '@/lib/youtube/audit/patterns';

const times = (x: number) => (x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`);

/** What goes with more (or fewer) views on the video's own channel, and where this video sits. */
export function ChannelPatterns({ patterns }: { patterns: Patterns }) {
  const formatName = patterns.format === 'short' ? 'Shorts' : 'videos';
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-300" />
          What wins on this channel
        </h3>
        <p className="text-sm text-zinc-400">
          Its {patterns.sample} {formatName} from the past year, grouped by what they have in common. These show what goes together here, not what causes views.
        </p>
      </div>

      {patterns.patterns.length === 0 ? (
        <p className="text-base text-zinc-400">No clear pattern: groups of its videos get about the same views.</p>
      ) : (
        <ul className="space-y-2">
          {patterns.patterns.map((p) => {
            const up = p.lift > 1;
            const width = Math.min(100, (Math.abs(Math.log(p.lift)) / Math.log(10)) * 100);
            return (
              <li key={p.traits.join('+')} className="rounded-xl bg-bg-elevated border border-bg-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base text-zinc-100">{p.label}</p>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${up ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {up ? `${times(p.lift)} views` : `${times(1 / p.lift)} fewer`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden">
                  <div className={`h-full rounded-full ${up ? 'bg-emerald-400/70' : 'bg-amber-400/70'}`} style={{ width: `${Math.max(6, width)}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    Median {formatCompact(p.withMedian)} for {p.withCount} with it · {formatCompact(p.withoutMedian)} for {p.withoutCount} without
                  </span>
                  <span className={`inline-flex items-center gap-1 ${p.thisHas ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {p.thisHas ? <Check size={12} /> : <Minus size={12} />}
                    {p.thisHas ? 'This video has it' : 'This video doesn’t'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(patterns.neutral ?? []).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-zinc-300">This video’s choices that make little difference here</p>
          <ul className="space-y-1">
            {patterns.neutral.map((p) => (
              <li key={p.traits.join('+')} className="text-sm text-zinc-400 flex flex-wrap justify-between gap-x-3">
                <span className="text-zinc-200">{p.label}</span>
                <span className="tabular-nums">
                  {formatCompact(p.withMedian)} with ({p.withCount}) · {formatCompact(p.withoutMedian)} without ({p.withoutCount})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {patterns.chart.length >= 5 && <ViewsByLength points={patterns.chart} />}
    </section>
  );
}

const W = 600;
const H = 220;
const PAD = { l: 44, r: 12, t: 10, b: 28 };

/** Each video by length and views (log scale); this video is highlighted. */
function ViewsByLength({ points }: { points: ChartPoint[] }) {
  const minutes = points.map((p) => p.durationSec / 60);
  const logs = points.map((p) => Math.log10(Math.max(1, p.views)));
  const xMax = Math.max(1, ...minutes) * 1.05;
  const yMin = Math.floor(Math.min(...logs));
  const yMax = Math.ceil(Math.max(...logs)) || 1;
  const x = (m: number) => PAD.l + (m / xMax) * (W - PAD.l - PAD.r);
  const y = (l: number) => H - PAD.b - ((l - yMin) / Math.max(1, yMax - yMin)) * (H - PAD.t - PAD.b);
  const ticks = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);
  const xTicks = [0, xMax / 2, xMax].map((m) => Math.round(m));
  const ordered = [...points].sort((a, b) => Number(a.isThis) - Number(b.isThis));

  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-semibold text-zinc-300">Views by length</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Each of the channel’s videos by length and views; this video is highlighted">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-zinc-800" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="fill-zinc-500 text-[11px]">
              {formatCompact(10 ** t)}
            </text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            {m} min
          </text>
        ))}
        {ordered.map((p) => (
          <circle
            key={p.id}
            cx={x(p.durationSec / 60)}
            cy={y(Math.log10(Math.max(1, p.views)))}
            r={p.isThis ? 7 : 4}
            className={p.isThis ? 'fill-amber-300 stroke-zinc-950' : 'fill-sky-400/50'}
            strokeWidth={p.isThis ? 2 : 0}
          >
            <title>{`${p.isThis ? 'This video: ' : ''}${p.title} · ${formatCompact(p.views)} views · ${Math.round(p.durationSec / 60)} min`}</title>
          </circle>
        ))}
      </svg>
      <p className="text-xs text-zinc-500 inline-flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" /> This video
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400/50" /> Its other videos
        </span>
        Older videos had more time to collect views.
      </p>
    </figure>
  );
}
