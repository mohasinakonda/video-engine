'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, CircleDashed } from 'lucide-react';
import type { DiagnosisResult } from '@/lib/youtube/diagnosis';
import { computeHealthScore, type HealthBand, type HealthScore } from '@/lib/youtube/analysis/health-score';
import { MetricCards } from './metric-cards';

const BAND: Record<HealthBand, { label: string; ring: string; pill: string; Icon: typeof AlertCircle }> = {
  healthy: { label: 'Healthy', ring: '#34d399', pill: 'bg-emerald-500/15 text-emerald-200', Icon: CheckCircle2 },
  fair: { label: 'Fair', ring: '#fbbf24', pill: 'bg-amber-500/15 text-amber-200', Icon: AlertCircle },
  attention: { label: 'Needs attention', ring: '#fb7185', pill: 'bg-rose-500/15 text-rose-200', Icon: AlertCircle },
};

const barColor = (score: number) => (score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-rose-400');

const TILE_KEYS = ['views', 'watchHours', 'ctr', 'netSubscribers'] as const;

function Gauge({ health, size }: { health: HealthScore; size: number }) {
  const stroke = size >= 160 ? 16 : 8;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const band = health.band ? BAND[health.band] : null;
  const label = health.score === null ? 'No health score yet: not enough data' : `Channel health score ${health.score} out of 100, ${band?.label}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-zinc-800" strokeWidth={stroke} strokeDasharray={health.score === null ? '6 8' : undefined} />
        {health.score !== null && band && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={band.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * health.score) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${size >= 160 ? 'text-5xl' : 'text-lg'} font-extrabold text-white tabular-nums leading-none`}>{health.score ?? '—'}</span>
        {size >= 160 && <span className="mt-1 text-sm text-zinc-400">{health.score === null ? 'no score yet' : 'out of 100'}</span>}
      </div>
    </div>
  );
}

/** The top of the diagnosis: score, main drag, how it's made, and the four key numbers. */
export function HealthScoreCard({ result }: { result: DiagnosisResult }) {
  const health = computeHealthScore(result);
  const [open, setOpen] = useState(false);
  const band = health.band ? BAND[health.band] : null;
  const tiles = TILE_KEYS.map((key) => result.metrics.find((m) => m.key === key)).filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-7 flex flex-col sm:flex-row gap-6 sm:items-center">
        <Gauge health={health} size={200} />
        <div className="space-y-3 min-w-0">
          <p className="text-xs font-semibold tracking-wider uppercase text-zinc-400">Rendoza health score</p>
          <div className="flex flex-wrap items-center gap-2">
            {band ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${band.pill}`}>
                <band.Icon size={14} aria-hidden="true" />
                {band.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-zinc-800 text-zinc-200">
                <CircleDashed size={14} aria-hidden="true" />
                Not enough data
              </span>
            )}
            <span className="text-sm text-zinc-400">Based on {health.usedParts} of 6 parts</span>
          </div>
          {health.score === null ? (
            <>
              <h2 className="text-2xl font-bold text-white leading-snug">Not enough data for a score yet.</h2>
              <p className="text-base text-zinc-300">{health.reason}</p>
            </>
          ) : health.mainDrag ? (
            <>
              <h2 className="text-2xl font-bold text-white leading-snug">Main drag: {health.mainDrag.drag}.</h2>
              <p className="text-base text-zinc-300">{health.mainDrag.detail}.</p>
            </>
          ) : (
            <h2 className="text-2xl font-bold text-white leading-snug">Every part of your channel is in good shape.</h2>
          )}
          <button type="button" onClick={() => setOpen(!open)} className="text-sm font-semibold text-emerald-300 hover:text-emerald-200" aria-expanded={open}>
            {open ? 'Hide how this score is calculated' : 'How this score is calculated'}
          </button>
        </div>
      </section>

      {open && (
        <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 sm:p-6 space-y-4">
          <p className="text-base font-semibold text-white">{health.score === null ? 'The parts we could measure' : `What makes up the ${health.score}`}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
            {health.parts.map((part) => (
              <div key={part.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-white">
                    {part.name} <span className="font-normal text-zinc-400">· {Math.round(part.weight * 100)}%</span>
                  </span>
                  <span className={`text-sm tabular-nums ${part.score === null ? 'font-medium text-zinc-400' : 'font-bold text-white'}`}>
                    {part.score ?? 'Not scored'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  {part.score !== null && <div className={`h-full rounded-full ${barColor(part.score)}`} style={{ width: `${Math.max(2, part.score)}%` }} />}
                </div>
                <p className="text-xs text-zinc-400">{part.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Each part scores 0–100 from your own numbers, then they are weighted. Parts YouTube didn’t share data for are left out and the
            rest reweighted. This is Rendoza’s score, not one from YouTube. 70–100 Healthy · 40–69 Fair · 0–39 Needs attention.
          </p>
        </section>
      )}

      {tiles.length > 0 && <MetricCards metrics={tiles} previousLabel={`the ${result.current.days} days before`} />}
    </div>
  );
}

/** A small read-only score for other tabs, from a diagnosis already saved in this tab. */
export function HealthScoreChip({ result, onOpen }: { result: DiagnosisResult; onOpen: () => void }) {
  const health = computeHealthScore(result);
  if (health.score === null || !health.band) return null;
  return (
    <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 p-3 rounded-xl border border-bg-border bg-bg-surface text-left hover:border-zinc-600">
      <Gauge health={health} size={52} />
      <span className="text-sm text-zinc-300">
        Health score <span className="font-semibold text-white">{health.score}</span> · {BAND[health.band].label}
        <span className="block text-xs text-zinc-500">From your last diagnosis ({result.current.days} days). Open diagnosis →</span>
      </span>
    </button>
  );
}
