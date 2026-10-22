'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import { GAP_LABELS, LEVEL_TEXT, MOMENTUM_LABELS } from './opportunity-labels';
import { ConfidenceReasons, EvidenceList } from './opportunity-sections';
import type { useResearch } from './research-panel';
import { FORMAT_LABELS, type DiscoverConfig, type Opportunity } from './types';
import { Badge } from '@/components/ui/badge';

const DIAGNOSIS_TEXT: Record<string, string> = {
  retention: 'viewers leave early',
  packaging: 'titles and thumbnails get too few clicks',
  topic: 'some topics don’t land with your audience',
  acquisition: 'YouTube recommends your videos less',
  consistency: 'uploads are irregular',
};

/** "What should I make next?": ranked opportunities, answer first, evidence one tap away. */
export function NextVideos({
  config,
  research,
  onGoToMarket,
}: {
  config: DiscoverConfig;
  research: ReturnType<typeof useResearch>;
  onGoToMarket: () => void;
}) {
  const result = research.saved?.result;
  const opportunities = result?.opportunities;

  if (!result || !opportunities) {
    return (
      <section className="card space-y-3">
        <h2 className="text-xl font-bold text-white">What should you make next?</h2>
        <p className="text-base text-zinc-300">Run market research first. We then compare what works for your competitors with your own channel.</p>
        <button type="button" onClick={onGoToMarket} className="btn-primary w-fit">
          <Sparkles size={16} />
          Go to market research
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">What should you make next?</h2>
        <p className="text-base text-zinc-400 mt-1">
          Ranked by our opportunity score (0–100). It’s our decision-support estimate from the evidence below, not a YouTube metric or a promise of views.
        </p>
        <p className="text-sm text-zinc-500 mt-1">Video ideas are written by AI from the evidence and checked so they don’t copy competitor titles. Make them your own.</p>
        {result.phase1?.primary && (
          <p className="text-sm text-emerald-300 mt-2">
            Adjusted to your Channel Doctor diagnosis: {DIAGNOSIS_TEXT[result.phase1.primary] ?? result.phase1.primary}.
          </p>
        )}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-base text-zinc-300 p-5 rounded-xl bg-bg-surface border border-bg-border">
          No clear opportunity in this research. Your competitors had few standout videos on shared topics. Try 90 days, or add more competitors close to your niche.
        </p>
      ) : (
        <ol className="space-y-4">
          {opportunities.map((o, i) => (
            <OpportunityCard key={o.id} opportunity={o} rank={i + 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function OpportunityCard({ opportunity: o, rank }: { opportunity: Opportunity; rank: number }) {
  const [open, setOpen] = useState(false);
  const lead = o.whyNow ?? o.evidence[0]?.statement;

  return (
    <li className={`rounded-2xl border p-5 space-y-3 ${rank === 1 ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : 'border-bg-border bg-bg-surface'}`}>
      <div className="flex items-start gap-4">
        <span className="w-9 h-9 rounded-full bg-white text-zinc-950 text-base font-bold flex items-center justify-center shrink-0">{rank}</span>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xl font-bold text-white leading-snug">{o.recommendedAngle ?? o.topic}</p>
          <p className="text-sm text-zinc-400">
            Topic: {o.topic}
            {o.audience && ` · For: ${o.audience}`}
          </p>
          {o.angleSource === 'fallback' && <p className="text-xs text-zinc-500">The AI writer couldn’t write an original idea for this one, so this is a plain starting point.</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white tabular-nums">{o.scores.total}</p>
          <p className="text-xs text-zinc-500">our score</p>
        </div>
      </div>

      {lead && <p className="text-base text-zinc-200 leading-relaxed">{lead}</p>}

      <div className="flex flex-wrap gap-1.5">
        {o.gapTypes.map((g) => (
          <Badge key={g} tone="warn" title={GAP_LABELS[g].help}>
            {GAP_LABELS[g].text}
          </Badge>
        ))}
        <Chip>{MOMENTUM_LABELS[o.momentum]}</Chip>
        <Chip>Competition: {LEVEL_TEXT[o.competition]}</Chip>
        <Chip>Fit: {LEVEL_TEXT[o.channelFit]}</Chip>
        {o.recommendedFormat && (
          <Chip>
            {FORMAT_LABELS[o.recommendedFormat]}
            {o.productionDifficulty && ` · ${LEVEL_TEXT[o.productionDifficulty].toLowerCase()} effort`}
          </Chip>
        )}
        <EvidenceBadge confidence={o.confidence} />
      </div>

      <button type="button" onClick={() => setOpen(!open)} className="text-sm font-medium text-zinc-300 hover:text-white inline-flex items-center gap-1">
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {open ? 'Hide the evidence' : 'Why this idea?'}
      </button>

      {open && (
        <div className="space-y-5 pt-3 border-t border-bg-border">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Why this opportunity</p>
            <EvidenceList evidence={o.evidence} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Confidence: {o.confidence}</p>
            <ConfidenceReasons opportunity={o} />
          </div>
        </div>
      )}

      <Link href={`/discover/opportunity/${o.id}`} className="btn-secondary w-fit">
        Open full details
        <ArrowRight size={15} />
      </Link>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <Badge dot={false}>{children}</Badge>;
}
