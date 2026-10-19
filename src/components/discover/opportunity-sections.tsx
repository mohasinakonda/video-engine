import Image from 'next/image';
import { formatCompact } from '@/components/youtube-doctor/format';
import { SCORE_PARTS, SOURCE_LABELS } from './opportunity-labels';
import type { Opportunity } from './types';

/** Each reason with its source, period and calculation. */
export function EvidenceList({ evidence }: { evidence: Opportunity['evidence'] }) {
  return (
    <ul className="space-y-2.5">
      {evidence.map((e) => (
        <li key={e.id} className="text-base text-zinc-200">
          ✓ {e.statement}
          <span className="block text-xs text-zinc-500 mt-0.5">
            {SOURCE_LABELS[e.source]} · {e.period}
            {e.calculation && ` · ${e.calculation}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreBreakdown({ opportunity: o }: { opportunity: Opportunity }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400">
        {o.signalsUsed} of 7 signals available. Weights are set by Rendoza; the score is our estimate, not a YouTube metric.
      </p>
      <ul className="space-y-1.5">
        {SCORE_PARTS.map(({ key, label }) => {
          const value = o.scores[key];
          return (
            <li key={key} className="grid grid-cols-[150px_1fr_36px] sm:grid-cols-[190px_1fr_40px] items-center gap-3 text-sm">
              <span className="text-zinc-400">{label}</span>
              <span className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                {value !== null && <span className="block h-full bg-emerald-500/70" style={{ width: `${value}%` }} />}
              </span>
              <span className="text-right text-zinc-300 tabular-nums">{value ?? '—'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ConfidenceReasons({ opportunity: o }: { opportunity: Opportunity }) {
  return (
    <ul className="text-base text-zinc-300 space-y-1">
      {o.confidenceReasons.map((r) => (
        <li key={r}>· {r}</li>
      ))}
    </ul>
  );
}

export function CompetitorStandouts({ signals, withThumbnails = false }: { signals: Opportunity['competitorSignals']; withThumbnails?: boolean }) {
  if (signals.length === 0) return <p className="text-base text-zinc-400">No single standout video; the signal comes from how much competitors cover this topic.</p>;
  return (
    <div className="space-y-2">
      <ul className="space-y-2.5">
        {signals.map((c) => (
          <li key={c.videoId} className="flex gap-3 items-start">
            {withThumbnails && (
              <a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noopener noreferrer" className="shrink-0 hidden sm:block">
                <Image src={`https://i.ytimg.com/vi/${c.videoId}/mqdefault.jpg`} alt="" width={120} height={68} className="w-[120px] h-[68px] rounded-md object-cover" />
              </a>
            )}
            <div className="text-sm min-w-0">
              <a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noopener noreferrer" className="text-base text-zinc-100 hover:underline">
                {c.title}
              </a>
              <p className="text-zinc-500">
                {c.ratio}× their usual · {formatCompact(c.views)} views vs usually {formatCompact(c.baselineViews)} · compared with {c.sampleSize} of their videos
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">Evidence of demand, not titles to copy.</p>
    </div>
  );
}
