'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Clock, Flag, Stethoscope } from 'lucide-react';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import type { CheckpointState } from '@/lib/youtube/create/measure';
import { THESIS_MIN_DAYS, expectationText, type Measurement, type Outcome, type SignalBucket, type ViewsBucket } from '@/lib/youtube/create/outcome';
import type { Thesis } from './types';

export interface PerformanceResult {
  format: 'short' | 'video';
  checkpoints: CheckpointState[];
  measurements: Measurement[];
  outcomes: Outcome[];
  limitations: string[];
}

const BUCKET_STYLE: Record<ViewsBucket | SignalBucket, { label: string; className: string }> = {
  well_above: { label: 'Well above usual', className: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30' },
  above: { label: 'Above usual', className: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30' },
  typical: { label: 'Usual', className: 'text-zinc-200 bg-white/5 border-bg-border' },
  below: { label: 'Below usual', className: 'text-amber-200 bg-amber-500/10 border-amber-500/30' },
  well_below: { label: 'Well below usual', className: 'text-rose-200 bg-rose-500/10 border-rose-500/30' },
  unknown: { label: 'Not enough data', className: 'text-zinc-400 bg-white/5 border-bg-border' },
};

const fmt = (n: number | null, digits = 0) => (n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits }));
const pct = (n: number | null, digits = 1) => (n === null ? '—' : `${(n * 100).toFixed(digits)}%`);
const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium' });

function Bucket({ value }: { value: ViewsBucket | SignalBucket }) {
  const s = BUCKET_STYLE[value];
  return <span className={`px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

/** One measured checkpoint at a time; the timeline switches between them. */
export function PerformanceView({ result, thesis, videoId }: { result: PerformanceResult; thesis: Thesis | null; videoId: string }) {
  const [selected, setSelected] = useState(result.outcomes.length - 1);
  const outcome = result.outcomes[selected];
  const m = result.measurements[selected];

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-1.5" aria-label="Checkpoints">
        {result.checkpoints.map((c) => {
          const index = result.outcomes.findIndex((o) => o.days === c.days);
          const active = index === selected;
          return (
            <li key={c.days}>
              <button
                type="button"
                disabled={index < 0}
                onClick={() => setSelected(index)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border ${
                  active ? 'bg-white text-zinc-950 border-white' : index >= 0 ? 'bg-bg-elevated text-zinc-200 border-bg-border hover:border-zinc-400' : 'bg-bg-elevated text-zinc-500 border-bg-border'
                }`}
              >
                {index >= 0 ? <Check size={14} /> : <Clock size={14} />}
                Day {c.days}
                {index < 0 && <span className="font-normal">· {date(c.readyOn)}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {outcome && m && (
        <>
          <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Day {outcome.days}</h2>
              <EvidenceBadge confidence={outcome.confidence} />
            </div>
            <p className="text-lg text-zinc-100 leading-relaxed">{outcome.summary}</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400">
                    <th className="font-medium py-2 pr-3">At the same age</th>
                    <th className="font-medium py-2 pr-3 text-right">This video</th>
                    <th className="font-medium py-2 pr-3 text-right">Your usual</th>
                    <th className="font-medium py-2" />
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  <tr className="border-t border-bg-border">
                    <td className="py-2 pr-3">Views</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">{fmt(m.views)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.baselineViews)}</td>
                    <td className="py-2 text-right">
                      <Bucket value={outcome.views} />
                    </td>
                  </tr>
                  <tr className="border-t border-bg-border">
                    <td className="py-2 pr-3">Average % viewed</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.avgViewPct === null ? '—' : `${m.avgViewPct.toFixed(1)}%`}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.baselineAvgViewPct === null ? '—' : `${m.baselineAvgViewPct.toFixed(1)}%`}</td>
                    <td className="py-2 text-right">
                      <Bucket value={outcome.retention} />
                    </td>
                  </tr>
                  {result.format === 'video' && (
                    <tr className="border-t border-bg-border">
                      <td className="py-2 pr-3">Click rate {m.impressions !== null && <span className="text-zinc-500">({fmt(m.impressions)} impressions)</span>}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{pct(m.ctr)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{pct(m.baselineCtr)}</td>
                      <td className="py-2 text-right">
                        <Bucket value={outcome.ctr} />
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-bg-border">
                    <td className="py-2 pr-3">Views from recommendations</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{pct(m.discoveryShare, 0)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{pct(m.channelDiscoveryShare, 0)}</td>
                    <td className="py-2 text-right">
                      <Bucket value={outcome.discovery} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500">
              “Your usual” is the median of {m.baselineSample} of your {result.format === 'short' ? 'Shorts' : 'videos'} from the past year, each at the same age. Click rate
              and recommendations are compared with your channel over the same days.
            </p>
          </section>

          <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
            <p className="text-base font-semibold text-white inline-flex items-center gap-2">
              <Flag size={16} />
              What to do next
            </p>
            <p className="text-base text-zinc-300">{outcome.nextStep}</p>
            {['packaging', 'retention', 'execution', 'discovery'].includes(outcome.bottleneck) && (
              <Link href={`/youtube-doctor/video/${videoId}`} className="btn-secondary btn-sm w-fit">
                <Stethoscope size={14} />
                Video check-up in Channel Doctor
              </Link>
            )}
          </section>

          {thesis && (
            <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
              <p className="text-base font-semibold text-white">What we expected → what happened</p>
              <p className="text-base text-zinc-400">{expectationText(thesis)}</p>
              <p className="text-base text-zinc-100">{outcome.thesisText}</p>
              {outcome.days < THESIS_MIN_DAYS && <p className="text-sm text-zinc-500">The idea is judged from day {THESIS_MIN_DAYS}.</p>}
            </section>
          )}
        </>
      )}

      {result.limitations.length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-400">
          {result.limitations.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
