'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import { GAP_LABELS, LEVEL_TEXT, MOMENTUM_LABELS } from '@/components/discover/opportunity-labels';
import { CompetitorStandouts, ConfidenceReasons, EvidenceList, ScoreBreakdown } from '@/components/discover/opportunity-sections';
import { FORMAT_LABELS, type Opportunity, type ResearchResult } from '@/components/discover/types';
import { useAuth } from '@/contexts/auth-context';
import { findSavedOpportunity } from '@/lib/channel-doctor-storage';

const LABEL_TEXT = {
  outperformer: 'did better than your usual',
  typical: 'did about as usual',
  underperformer: 'did worse than your usual',
  not_comparable: 'not comparable yet',
} as const;

/** One opportunity in full: what, why, the market, your channel, the gap, the idea and the confidence. */
export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<{ opportunity: Opportunity; analyzedAt: string } | null | 'missing'>(null);

  useEffect(() => {
    if (!user) return;
    const saved = findSavedOpportunity<ResearchResult>(user.id, id);
    const opportunity = saved?.result.opportunities.find((o) => o.id === id);
    setState(saved && opportunity ? { opportunity, analyzedAt: saved.analyzedAt } : 'missing');
  }, [user, id]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  /** Starts a Create project from this idea. Only scores and labels are sent on; the server drops the rest. */
  const createBrief = async (o: Opportunity) => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/create/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: 'opportunity', opportunity: o }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start the video.');
      router.push(`/create/${data.project.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href="/discover?tab=next" className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to next-video ideas
        </Link>

        {state === null || isLoading ? (
          <div className="card flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-zinc-400" />
          </div>
        ) : state === 'missing' ? (
          <section className="card space-y-3">
            <h1 className="text-xl font-bold text-white">This idea isn’t available here</h1>
            <p className="text-base text-zinc-300">
              Research results stay only in the browser tab where you ran them, and aren’t saved on our servers. Run the research again to see this idea.
            </p>
            <Link href="/discover?tab=market" className="btn-primary w-fit">
              Go to market research
            </Link>
          </section>
        ) : (
          <Detail opportunity={state.opportunity} analyzedAt={state.analyzedAt} onCreateBrief={createBrief} creating={creating} createError={createError} />
        )}
      </div>
    </div>
  );
}

function Detail({
  opportunity: o,
  analyzedAt,
  onCreateBrief,
  creating,
  createError,
}: {
  opportunity: Opportunity;
  analyzedAt: string;
  onCreateBrief: (o: Opportunity) => void;
  creating: boolean;
  createError: string;
}) {
  const gapEvidence = o.evidence.filter((e) => e.source === 'calculated' && !e.calculation);
  return (
    <div className="space-y-6">
      {/* Overview */}
      <section className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/[0.04] p-6 space-y-3">
        <p className="text-sm text-zinc-400">
          {o.angleSource === 'ai' ? 'Video idea (written by AI from the evidence)' : 'Starting point'} · topic: {o.topic}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug">{o.recommendedAngle ?? o.topic}</h1>
        {o.whyNow && <p className="text-lg text-zinc-200 leading-relaxed">{o.whyNow}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-3xl font-bold text-white tabular-nums">{o.scores.total}</span>
          <span className="text-sm text-zinc-400 mr-2">/ 100 · our opportunity score</span>
          <EvidenceBadge confidence={o.confidence} />
        </div>
        <button type="button" onClick={() => onCreateBrief(o)} disabled={creating} className="btn-primary px-6 py-3 text-base font-semibold">
          {creating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          Create video brief
        </button>
        {createError && <p className="text-sm text-rose-300">{createError}</p>}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Fact label="Momentum" value={MOMENTUM_LABELS[o.momentum]} />
        <Fact label="Competition" value={LEVEL_TEXT[o.competition]} />
        <Fact label="Fit with your channel" value={LEVEL_TEXT[o.channelFit]} />
        <Fact label="Production effort" value={o.productionDifficulty ? LEVEL_TEXT[o.productionDifficulty] : '—'} />
      </div>

      <Section title="Why we think this exists">
        <EvidenceList evidence={o.evidence} />
      </Section>

      <Section title="What’s missing on your channel">
        {o.gapTypes.length === 0 ? (
          <p className="text-base text-zinc-300">No clear gap: you already cover this topic in a similar way. It ranks for how well it works for others.</p>
        ) : (
          <ul className="space-y-3">
            {o.gapTypes.map((g) => (
              <li key={g}>
                <p className="text-base font-semibold text-amber-100">{GAP_LABELS[g].text}</p>
                <p className="text-sm text-zinc-400">{GAP_LABELS[g].help}</p>
              </li>
            ))}
            {gapEvidence.length > 0 && <p className="text-sm text-zinc-500">Details are in the evidence above.</p>}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="The market">
          <CompetitorStandouts signals={o.competitorSignals} withThumbnails />
        </Section>
        <Section title="Your channel">
          {o.yourVideos.length === 0 ? (
            <p className="text-base text-zinc-300">You have no videos on this topic in the analyzed sample.</p>
          ) : (
            <ul className="space-y-2">
              {o.yourVideos.map((v) => (
                <li key={v.id} className="text-base">
                  <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-zinc-100 hover:underline">
                    {v.title}
                  </a>
                  {v.label && <span className="block text-sm text-zinc-500">Channel Doctor: {LABEL_TEXT[v.label]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Recommended format">
          {o.recommendedFormat ? (
            <>
              <p className="text-lg font-semibold text-white">{FORMAT_LABELS[o.recommendedFormat]}</p>
              <p className="text-sm text-zinc-400">
                {o.productionDifficulty && `${LEVEL_TEXT[o.productionDifficulty]} effort with our video engine. `}
                {o.angleRationale}
              </p>
            </>
          ) : (
            <p className="text-base text-zinc-300">No format stands out for this topic.</p>
          )}
          {o.audience && <p className="text-base text-zinc-300 pt-2">For: {o.audience}</p>}
        </Section>
        <Section title={`Confidence: ${o.confidence}`}>
          <ConfidenceReasons opportunity={o} />
        </Section>
      </div>

      <Section title="How the score was made">
        <ScoreBreakdown opportunity={o} />
      </Section>

      <p className="text-sm text-zinc-500">
        From research at {new Date(analyzedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}, last {o.window === '30d' ? '30' : '90'} days.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-bg-border bg-bg-surface">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
