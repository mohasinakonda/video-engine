'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, HelpCircle, Info, Lightbulb, MessageCircle, MessagesSquare, Stethoscope, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import { formatAgo, formatCompact } from '@/components/youtube-doctor/format';
import { ChannelPatterns } from './channel-patterns';
import { DescriptionAndTags, Playbook } from './playbook';
import type { AuditFinding, FindingArea, FindingImpact, FindingKind, PerformanceLabel, ThemeKind, VideoAuditReport } from './types';
import type { ViewerThemes } from '@/lib/youtube/audit/ai/comments';

const PERFORMANCE: Record<PerformanceLabel, { label: string; tone: BadgeTone }> = {
  standout: { label: 'Standout for its channel', tone: 'good' },
  above: { label: 'Above its channel’s usual', tone: 'good' },
  typical: { label: 'About its channel’s usual', tone: 'neutral' },
  below: { label: 'Below its channel’s usual', tone: 'warn' },
  well_below: { label: 'Well below its channel’s usual', tone: 'bad' },
  not_comparable: { label: 'Can’t compare yet', tone: 'neutral' },
};

const AREA: Record<FindingArea, string> = {
  performance: 'Performance',
  title: 'Title',
  thumbnail: 'Thumbnail',
  metadata: 'Description',
  format: 'Length',
  viewers: 'Viewers',
  pattern: 'Pattern',
  rhythm: 'Upload rhythm',
  comparison: 'You vs them',
  audience: 'Audience',
};

const THEMES: { kind: ThemeKind; title: string; icon: typeof ThumbsUp; className: string; hint: string }[] = [
  { kind: 'complaint', title: 'What viewers didn’t like', icon: ThumbsDown, className: 'text-amber-300', hint: 'About the video itself' },
  { kind: 'question', title: 'What viewers still want to know', icon: HelpCircle, className: 'text-sky-300', hint: 'Ideas for a video of your own' },
  { kind: 'liked', title: 'What viewers liked', icon: ThumbsUp, className: 'text-emerald-300', hint: 'Worth doing yourself' },
  { kind: 'discussion', title: 'What viewers debated', icon: MessagesSquare, className: 'text-zinc-300', hint: 'How much the topic moved people' },
];

export function FindingList({ title, findings, icon: Icon, className }: { title: string; findings: AuditFinding[]; icon: typeof Info; className: string }) {
  if (!findings.length) return null;
  return (
    <section className="space-y-2">
      <h3 className={`text-base font-semibold inline-flex items-center gap-2 ${className}`}>
        <Icon size={17} />
        {title}
      </h3>
      <ul className="space-y-2">
        {findings.map((f) => (
          <li key={f.id} className="rounded-xl border border-bg-border bg-bg-surface p-4 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge dot={false}>{AREA[f.area]}</Badge>
              <EvidenceBadge confidence={f.confidence} />
            </div>
            <p className="text-base text-zinc-100">{f.statement}</p>
            {f.evidence && <p className="text-sm text-zinc-400">{f.evidence}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What viewers say, grouped by kind, with counts and real example comments. */
export function ViewerThemesView({ viewers }: { viewers: ViewerThemes }) {
  const themes = viewers.themes;
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
        <MessageCircle size={17} />
        What viewers say
      </h3>
      <p className="text-sm text-zinc-400 -mt-1">From the {viewers.read} most relevant comments. Counts are comments; names are never read.</p>
      {themes.length === 0 ? (
        <p className="text-base text-zinc-400">No clear themes in the comments.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {THEMES.map(({ kind, title, icon: Icon, className, hint }) => {
            const list = themes.filter((t) => t.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind} className="rounded-xl border border-bg-border bg-bg-surface p-4 space-y-3">
                <div>
                  <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${className}`}>
                    <Icon size={15} />
                    {title}
                  </p>
                  <p className="text-xs text-zinc-500">{hint}</p>
                </div>
                <ul className="space-y-3">
                  {list.map((t) => (
                    <li key={t.theme} className="space-y-1">
                      <p className="text-base text-zinc-100">
                        {t.theme} <span className="text-sm text-zinc-500 tabular-nums">· {t.count}</span>
                      </p>
                      {t.examples.map((e) => (
                        <p key={e} className="text-sm text-zinc-400 border-l-2 border-bg-border pl-2">
                          “{e}”
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const IMPACT_DOTS: Record<FindingImpact, number> = { high: 3, medium: 2, low: 1 };

/** The findings that best explain the result: in its direction, biggest impact first. */
function mainReasons(report: VideoAuditReport): AuditFinding[] {
  const label = report.performance.label;
  const kinds: FindingKind[] = label === 'standout' || label === 'above' ? ['strength', 'note'] : label === 'below' || label === 'well_below' ? ['weakness', 'note'] : ['strength', 'weakness', 'note'];
  const order: Record<FindingImpact, number> = { high: 0, medium: 1, low: 2 };
  return report.findings
    // The views gap itself is the result, not a reason; a note about it (e.g. its age) is.
    .filter((f) => !(f.area === 'performance' && f.kind !== 'note') && (f.impact ?? 'medium') !== 'low' && kinds.includes(f.kind))
    .sort((a, b) => order[a.impact ?? 'medium'] - order[b.impact ?? 'medium'] || kinds.indexOf(a.kind) - kinds.indexOf(b.kind))
    .slice(0, 3);
}

function ImpactDots({ impact }: { impact: FindingImpact }) {
  const n = IMPACT_DOTS[impact];
  return (
    <span className="inline-flex items-center gap-0.5" title={`${impact} impact`} aria-label={`${impact} impact`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < n ? 'bg-amber-300' : 'bg-zinc-700'}`} />
      ))}
    </span>
  );
}

/** One video's audit: why it did what it did, what to reuse, then the evidence; polish last. */
export function AuditReport({ report }: { report: VideoAuditReport }) {
  const { video, performance: p } = report;
  const perf = PERFORMANCE[p.label];
  const reasons = mainReasons(report);
  const shown = new Set(reasons.map((f) => f.id));
  const major = report.findings.filter((f) => (f.impact ?? 'medium') !== 'low' && !shown.has(f.id));
  const weaknesses = major.filter((f) => f.kind === 'weakness');
  const strengths = major.filter((f) => f.kind === 'strength');
  const notes = major.filter((f) => f.kind === 'note');
  const small = report.findings.filter((f) => f.impact === 'low');

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 flex flex-col sm:flex-row gap-4">
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
          {video.thumbnailUrl ? (
            <Image src={video.thumbnailUrl} alt="" width={256} height={144} className="w-full sm:w-64 aspect-video rounded-xl object-cover" />
          ) : (
            <div className="w-full sm:w-64 aspect-video rounded-xl bg-bg-elevated" />
          )}
        </a>
        <div className="min-w-0 space-y-2">
          <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-white leading-snug hover:underline inline-flex gap-1.5">
            {video.title}
            <ExternalLink size={14} className="shrink-0 mt-1.5 text-zinc-500" />
          </a>
          <p className="text-sm text-zinc-400">
            {video.channelTitle} · {video.views !== null ? `${formatCompact(video.views)} views · ` : ''}
            {formatAgo(report.ageDays)} · {report.format === 'short' ? 'Short' : 'Video'}
            {video.durationSec && report.format === 'video' ? ` · ${Math.round(video.durationSec / 60)} min` : ''}
            {report.madeForKids && ' · Made for kids'}
          </p>
          <div>
            <Badge tone={perf.tone}>
              {perf.label}
              {p.ratio !== null && ` · ${p.ratio}×`}
            </Badge>
          </div>
          {p.baselineViews !== null && p.label !== 'not_comparable' && (
            <p className="text-xs text-zinc-500">
              Its channel usually gets {formatCompact(p.baselineViews)} views ({p.baselineSample} of its {report.format === 'short' ? 'Shorts' : 'videos'} from the past year).
            </p>
          )}
        </div>
      </section>

      {report.isOwn && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-sky-500/30 bg-sky-500/10">
          <p className="flex-1 text-base text-sky-50">This is your own video. Channel Doctor’s check-up adds its click rate, retention and traffic sources.</p>
          <Link href={`/youtube-doctor/video/${video.id}`} className="btn-secondary btn-sm shrink-0">
            <Stethoscope size={14} />
            Open the check-up
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
        <p className="text-lg text-white leading-relaxed">{report.verdict}</p>
        {reasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-300">The main reasons</p>
            <ol className="space-y-2">
              {reasons.map((f, i) => (
                <li key={f.id} className="flex gap-3 rounded-xl bg-bg-elevated border border-bg-border p-3">
                  <span className="text-base font-bold text-zinc-500 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-base text-zinc-100">{f.statement}</p>
                    {f.evidence && <p className="text-sm text-zinc-400">{f.evidence}</p>}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <ImpactDots impact={f.impact ?? 'medium'} />
                      <span>{AREA[f.area]}</span>
                      <EvidenceBadge confidence={f.confidence} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {report.lessons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-300 inline-flex items-center gap-1.5">
              <Lightbulb size={15} className="text-amber-300" />
              For your channel
            </p>
            <ul className="space-y-1.5">
              {report.lessons.map((l) => (
                <li key={l} className="text-base text-zinc-200 flex gap-2">
                  <span className="text-amber-300">→</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Playbook report={report} />

      {report.patterns && <ChannelPatterns patterns={report.patterns} />}

      <FindingList title="Weak points" findings={weaknesses} icon={AlertTriangle} className="text-amber-300" />
      <FindingList title="What works" findings={strengths} icon={CheckCircle2} className="text-emerald-300" />

      {report.viewers && <ViewerThemesView viewers={report.viewers} />}

      <FindingList title="Notes" findings={notes} icon={Info} className="text-zinc-300" />

      <DescriptionAndTags report={report} />

      {small.length > 0 && (
        <details className="rounded-2xl border border-bg-border bg-bg-surface p-5 group">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
            <span>
              <span className="flex text-base font-semibold text-white items-center gap-2">
                <Wrench size={16} className="text-zinc-400" />
                Small things ({small.length})
              </span>
              <span className="block text-sm text-zinc-400">Polish worth knowing, but not why the video did what it did.</span>
            </span>
            <ChevronDown size={18} className="text-zinc-400 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-4 space-y-2">
            {small.map((f) => (
              <li key={f.id} className="text-base text-zinc-300 space-y-0.5">
                <p>
                  <span className={f.kind === 'weakness' ? 'text-amber-300' : f.kind === 'strength' ? 'text-emerald-300' : 'text-zinc-500'}>
                    {f.kind === 'weakness' ? '△' : f.kind === 'strength' ? '✓' : '·'}
                  </span>{' '}
                  {f.statement}
                </p>
                {f.evidence && <p className="text-sm text-zinc-500 pl-4">{f.evidence}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {report.limitations.length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-500">
          {report.limitations.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
