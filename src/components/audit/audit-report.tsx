'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle, Info, Lightbulb, MessageCircle, MessagesSquare, Scale, Stethoscope, ThumbsDown, ThumbsUp } from 'lucide-react';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import { formatAgo, formatCompact } from '@/components/youtube-doctor/format';
import type { AuditFinding, FindingArea, PerformanceLabel, ThemeKind, VideoAuditReport } from './types';
import type { ViewerThemes } from '@/lib/youtube/audit/ai/comments';

const PERFORMANCE: Record<PerformanceLabel, { label: string; className: string }> = {
  standout: { label: 'Standout for its channel', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
  above: { label: 'Above its channel’s usual', className: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  typical: { label: 'About its channel’s usual', className: 'bg-white/5 text-zinc-200 border-bg-border' },
  below: { label: 'Below its channel’s usual', className: 'bg-amber-500/10 text-amber-200 border-amber-500/30' },
  well_below: { label: 'Well below its channel’s usual', className: 'bg-rose-500/10 text-rose-200 border-rose-500/30' },
  not_comparable: { label: 'Can’t compare yet', className: 'bg-white/5 text-zinc-400 border-bg-border' },
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
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-bg-border text-xs text-zinc-300">{AREA[f.area]}</span>
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

/** One video's audit: the verdict first, then what to learn, then the evidence. */
export function AuditReport({ report }: { report: VideoAuditReport }) {
  const { video, performance: p } = report;
  const perf = PERFORMANCE[p.label];
  const weaknesses = report.findings.filter((f) => f.kind === 'weakness');
  const strengths = report.findings.filter((f) => f.kind === 'strength');
  const notes = report.findings.filter((f) => f.kind === 'note');

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
          </p>
          <span className={`inline-block px-2.5 py-1 rounded-lg border text-sm font-medium ${perf.className}`}>
            {perf.label}
            {p.ratio !== null && ` · ${p.ratio}×`}
          </span>
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

      {!report.isOwn && (
        <Link href={`/discover/compare?theirs=${video.id}`} className="btn-secondary btn-sm w-fit">
          <Scale size={14} />
          Compare with one of my videos
        </Link>
      )}

      <FindingList title="Weak points" findings={weaknesses} icon={AlertTriangle} className="text-amber-300" />
      <FindingList title="What works" findings={strengths} icon={CheckCircle2} className="text-emerald-300" />

      {report.viewers && <ViewerThemesView viewers={report.viewers} />}

      <FindingList title="Notes" findings={notes} icon={Info} className="text-zinc-300" />

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
