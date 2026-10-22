'use client';

import { Check, Minus, TrendingUp } from 'lucide-react';
import { formatCompact } from '@/components/youtube-doctor/format';
import type { ChannelPatterns as Patterns, ChartPoint } from '@/lib/youtube/audit/patterns';

const times = (x: number) => (x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`);

/** What goes with more (or fewer) views on the video's own channel, and where this video sits. */
export function ChannelPatterns({ patterns, bare = false }: { patterns: Patterns; bare?: boolean }) {
  const formatName = patterns.format === 'short' ? 'Shorts' : 'videos';
  const hint = `What its ${patterns.sample} ${formatName} from the past year have in common when they do well or badly. It shows what goes together here; it doesn’t prove that’s why.`;
  const body = (
    <>

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
                    {up ? `${times(p.lift)} more views` : `${times(1 / p.lift)} fewer views`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden">
                  <div className={`h-full rounded-full ${up ? 'bg-emerald-400/70' : 'bg-amber-400/70'}`} style={{ width: `${Math.max(6, width)}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    With it: usually {formatCompact(p.withMedian)} views ({p.withCount} videos) · without: {formatCompact(p.withoutMedian)} ({p.withoutCount})
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
                  usually {formatCompact(p.withMedian)} views with it ({p.withCount}) · {formatCompact(p.withoutMedian)} without ({p.withoutCount})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {patterns.chart.length >= 5 && <ViewsByLength points={patterns.chart} format={patterns.format} />}
    </>
  );
  if (bare)
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">{hint}</p>
        {body}
      </div>
    );
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-300" />
          What wins on this channel
        </h3>
        <p className="text-sm text-zinc-400">{hint}</p>
      </div>
      {body}
    </section>
  );
}

const LENGTHS = {
  short: [
    { label: 'Under 30 sec', max: 30 },
    { label: '30–60 sec', max: 60 },
    { label: '1–3 min', max: Infinity },
  ],
  video: [
    { label: 'Under 8 min', max: 480 },
    { label: '8–15 min', max: 900 },
    { label: '15–30 min', max: 1800 },
    { label: '30–60 min', max: 3600 },
    { label: '1 hour+', max: Infinity },
  ],
} as const;

function middle(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Typical views per length range, with the range this video is in marked. */
function ViewsByLength({ points, format }: { points: ChartPoint[]; format: Patterns['format'] }) {
  const ranges = LENGTHS[format === 'short' ? 'short' : 'video'];
  const rangeOf = (sec: number) => ranges.findIndex((r) => sec < r.max);
  const self = points.find((p) => p.isThis);
  const groups = ranges
    .map((r, i) => {
      const views = points.filter((p) => !p.isThis && rangeOf(p.durationSec) === i).map((p) => p.views);
      return { label: r.label, count: views.length, median: views.length ? middle(views) : null, hasThis: !!self && rangeOf(self.durationSec) === i };
    })
    .filter((g) => g.count > 0 || g.hasThis);
  const max = Math.max(1, ...groups.map((g) => g.median ?? 0));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-300">Views by length</p>
        <p className="text-xs text-zinc-500">Typical views of its other videos in each length range. Older videos had more time to collect views.</p>
      </div>
      <ul className="space-y-2.5">
        {groups.map((g) => (
          <li key={g.label} className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className={g.hasThis ? 'text-amber-200 font-semibold' : 'text-zinc-200'}>
                {g.label}
                {g.hasThis && ' · this video’s length'}
              </span>
              <span className="tabular-nums text-zinc-400">
                {g.median === null ? 'no other videos' : `${formatCompact(g.median)} typical · ${g.count} ${g.count === 1 ? 'video' : 'videos'}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
              <div className={`h-full rounded-full ${g.hasThis ? 'bg-amber-300/80' : 'bg-sky-400/70'}`} style={{ width: `${g.median ? Math.max(2, (g.median / max) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {self && (
        <p className="text-sm text-zinc-300">
          This video: <span className="font-semibold text-white tabular-nums">{formatCompact(self.views)} views</span> at{' '}
          {self.durationSec < 60 ? `${self.durationSec} sec` : `${Math.round(self.durationSec / 60)} min`}.
        </p>
      )}
    </div>
  );
}
