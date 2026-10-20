'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, ChevronDown, Info, Lightbulb, Target, TriangleAlert } from 'lucide-react';
import type { DiagnosisResult } from '@/lib/youtube/diagnosis';
import type { Confidence, Evidence, ReportAction, ReportBottleneck, VideoAnalysis } from '@/lib/youtube/types';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { formatCompact, formatDuration } from './format';

/*
 * Reading order for a busy creator:
 *   1. VerdictCard – the answer, in one big line.
 *   2. FixFirstCard – the one thing to do now.
 *   3. NextSteps – at most two more.
 *   4. Everything else (evidence, numbers) is one click away.
 */

const EVIDENCE_LABEL: Record<Confidence, { text: string; tone: BadgeTone }> = {
  high: { text: 'Strong evidence', tone: 'good' },
  medium: { text: 'Good evidence', tone: 'info' },
  low: { text: 'Early signal', tone: 'neutral' },
};

export function EvidenceBadge({ confidence }: { confidence: Confidence }) {
  const { text, tone } = EVIDENCE_LABEL[confidence];
  return <Badge tone={tone}>{text}</Badge>;
}

/** Kept for places that show a confidence next to a measured statement. */
export const ConfidenceBadge = EvidenceBadge;

function WorthCheckingBadge() {
  return (
    <Badge tone="warn" title="The numbers line up, but they don't prove the cause.">
      Worth checking
    </Badge>
  );
}

/** "Why we think this": the measured evidence, closed by default so it doesn't compete with the answer. */
export function WhyWeThinkThis({ ids, evidence, extra }: { ids: string[]; evidence: Evidence[]; extra?: string }) {
  const [open, setOpen] = useState(false);
  const items = ids.map((id) => evidence.find((e) => e.id === id)).filter((e): e is Evidence => Boolean(e));
  if (items.length === 0 && !extra) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5 font-medium"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        Why we think this
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {extra && <li className="text-sm text-zinc-300 leading-relaxed">{extra}</li>}
          {items.map((e) => (
            <li key={e.id} className="text-sm text-zinc-300 leading-relaxed pl-3 border-l-2 border-zinc-700">
              {e.statement}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 1. The answer: what is holding the channel back, in one line a creator reads in two seconds. */
export function VerdictCard({ result }: { result: DiagnosisResult }) {
  const { report } = result;
  const primary = report.primaryBottleneck;
  return (
    <section className={`rounded-2xl border p-6 sm:p-7 space-y-3 ${primary ? 'bg-rose-500/[0.07] border-rose-500/30' : 'bg-emerald-500/[0.07] border-emerald-500/30'}`}>
      <p className={`text-sm font-semibold uppercase tracking-wide ${primary ? 'text-rose-300' : 'text-emerald-300'}`}>
        {primary ? 'Your biggest problem right now' : 'Your channel at a glance'}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{report.headline}</h2>
      <p className="text-base text-zinc-300 leading-relaxed max-w-3xl">{report.summary}</p>
      {primary && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <EvidenceBadge confidence={primary.confidence} />
          {primary.isHypothesis && <WorthCheckingBadge />}
        </div>
      )}
      {primary && <WhyWeThinkThis ids={primary.evidenceIds} evidence={result.evidence} extra={primary.explanation} />}
    </section>
  );
}

/** 2 + 3. One clear first step, then at most two more. */
export function ActionPlan({ actions, evidence }: { actions: ReportAction[]; evidence: Evidence[] }) {
  if (actions.length === 0) return null;
  const [first, ...rest] = actions;
  const next = rest.slice(0, 2);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/[0.06] p-6 sm:p-7 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300 flex items-center gap-2">
          <Target size={16} />
          Do this first
        </p>
        <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">{first.title}</h3>
        <p className="text-base text-zinc-200 leading-relaxed">{first.how}</p>
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge confidence={first.confidence} />
          <span className="px-2 py-0.5 rounded-full border border-zinc-700 text-xs text-zinc-300">
            {first.effort === 'low' ? 'Quick to do' : first.effort === 'medium' ? 'Takes some work' : 'Bigger project'}
          </span>
        </div>
        <WhyWeThinkThis ids={first.evidenceIds} evidence={evidence} extra={first.why} />
      </div>

      {next.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Then</h3>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {next.map((action, i) => (
              <li key={action.priority} className="rounded-xl border border-bg-border bg-bg-surface p-5 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-white text-zinc-950 text-sm font-bold flex items-center justify-center shrink-0">{i + 2}</span>
                  <h4 className="text-base font-semibold text-white leading-snug pt-0.5">{action.title}</h4>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{action.how}</p>
                <WhyWeThinkThis ids={action.evidenceIds} evidence={evidence} extra={action.why} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** Other problems, kept short: title plus evidence on demand. */
export function OtherProblems({ bottlenecks, evidence }: { bottlenecks: ReportBottleneck[]; evidence: Evidence[] }) {
  if (bottlenecks.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <TriangleAlert size={18} className="text-amber-400" />
        Also worth fixing
      </h3>
      <ul className="space-y-3">
        {bottlenecks.map((b) => (
          <li key={b.category} className="rounded-xl border border-bg-border bg-bg-surface p-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-white">{b.title}</h4>
              <EvidenceBadge confidence={b.confidence} />
              {b.isHypothesis && <WorthCheckingBadge />}
            </div>
            <WhyWeThinkThis ids={b.evidenceIds} evidence={evidence} extra={b.explanation} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StrengthList({ result }: { result: DiagnosisResult }) {
  const { strengths } = result.report;
  if (strengths.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <CheckCircle2 size={18} className="text-emerald-400" />
        Keep doing this
      </h3>
      <ul className="space-y-3">
        {strengths.map((s, i) => (
          <li key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-1.5">
            <h4 className="text-base font-semibold text-white">{s.title}</h4>
            <p className="text-sm text-zinc-300 leading-relaxed">{s.explanation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LABEL_STYLE: Record<VideoAnalysis['label'], { text: string; className: string }> = {
  outperformer: { text: 'Doing great', className: 'text-emerald-300' },
  typical: { text: 'Normal', className: 'text-zinc-300' },
  underperformer: { text: 'Below normal', className: 'text-rose-300' },
  not_comparable: { text: 'Too new to compare', className: 'text-zinc-500' },
};

/** Videos ranked by how they did compared with similar videos on the channel, not by raw views. */
export function VideoTable({ videos, onSelect }: { videos: VideoAnalysis[]; onSelect?: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'video' | 'short'>('all');
  const rows = videos
    .filter((v) => filter === 'all' || v.format === filter)
    .sort((a, b) => (b.relativeViews ?? -1) - (a.relativeViews ?? -1));

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Your videos, best to weakest</h3>
          <p className="text-sm text-zinc-400 mt-0.5">Compared with your other videos of the same type and age.{onSelect ? ' Tap a video for its own check-up.' : ''}</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-bg-elevated border border-bg-border">
          {(['all', 'video', 'short'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm ${filter === key ? 'bg-white text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'}`}
            >
              {key === 'all' ? 'All' : key === 'video' ? 'Videos' : 'Shorts'}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-bg-border border-t border-bg-border">
        {rows.map((v) => {
          const style = LABEL_STYLE[v.label];
          const content = (
            <>
              {v.thumbnailUrl ? (
                <Image src={v.thumbnailUrl} alt="" width={112} height={63} className="w-24 sm:w-28 aspect-video rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-24 sm:w-28 aspect-video rounded-md bg-bg-elevated shrink-0" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-base text-zinc-100 font-medium line-clamp-2">{v.title}</p>
                <p className="text-sm text-zinc-400">
                  {v.format === 'short' ? 'Short' : 'Video'} · {v.stats ? `${formatCompact(v.stats.views)} views` : 'No views this period'}
                  {v.stats?.avgViewDurationSec != null && ` · watched ${formatDuration(v.stats.avgViewDurationSec)} on average`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-bold tabular-nums ${style.className}`}>
                  {v.relativeViews !== null ? `${v.relativeViews.toFixed(1)}×` : '—'}
                </p>
                <p className={`text-xs ${style.className}`}>{style.text}</p>
              </div>
            </>
          );
          return (
            <li key={v.id}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(v.id)} className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-bg-hover">
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-4 px-5 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TrafficBars({ traffic }: { traffic: NonNullable<DiagnosisResult['traffic']> }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Where your viewers come from</h3>
        <p className="text-sm text-zinc-400 mt-0.5">Home page and suggested videos mean YouTube is recommending you.</p>
      </div>
      <ul className="space-y-3">
        {traffic.slice(0, 6).map((t) => (
          <li key={t.source}>
            <div className="flex justify-between text-sm text-zinc-200 mb-1.5">
              <span>{t.label}</span>
              <span className="tabular-nums font-semibold">{t.sharePct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${Math.max(1, t.sharePct)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What couldn't be measured: important for honesty, but folded so it doesn't scare. */
export function LimitationsCard({ limitations, aiSource }: { limitations: string[]; aiSource: 'ai' | 'fallback' }) {
  const [open, setOpen] = useState(false);
  const items = aiSource === 'fallback' ? ['The AI write-up was unavailable, so this report shows the measured findings only.', ...limitations] : limitations;
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-bg-border bg-bg-surface p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 text-left">
        <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Info size={16} className="text-zinc-400" />
          What we couldn&apos;t measure ({items.length})
        </span>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mt-3 space-y-2 text-sm text-zinc-400 leading-relaxed list-disc pl-5">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Short summary block used on the single-video page. */
export function SummaryCard({ summary, source }: { summary: string; source: 'ai' | 'fallback' }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-elevated p-5 sm:p-6 flex gap-3">
      <Lightbulb size={22} className="text-amber-300 shrink-0 mt-0.5" />
      <div className="space-y-1.5">
        <p className="text-base text-zinc-100 leading-relaxed">{summary}</p>
        <p className="text-xs text-zinc-500">{source === 'ai' ? 'Written by AI from your numbers.' : 'Built from your numbers.'}</p>
      </div>
    </section>
  );
}
