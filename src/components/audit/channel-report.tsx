'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Lightbulb, ScanSearch, Stethoscope } from 'lucide-react';
import { formatCompact } from '@/components/youtube-doctor/format';
import { FindingList } from './audit-report';
import type { ChannelAuditReport, RankedVideo } from './types';

function VideoList({ title, videos, hint }: { title: string; videos: RankedVideo[]; hint: string }) {
  if (!videos.length) return null;
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-zinc-400">{hint}</p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {videos.map((v) => (
          <li key={v.id} className="flex gap-3 p-3 rounded-xl border border-bg-border bg-bg-surface">
            {v.thumbnailUrl ? (
              <Image src={v.thumbnailUrl} alt="" width={112} height={63} className="w-28 aspect-video rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-28 aspect-video rounded-lg bg-bg-elevated shrink-0" />
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-white line-clamp-2">{v.title}</p>
              <p className="text-xs text-zinc-400">
                <span className="font-semibold text-zinc-200 tabular-nums">{v.ratio}×</span> its usual · {formatCompact(v.views)} views · {v.format === 'short' ? 'Short' : 'Video'}
              </p>
              <Link href={`/discover/video/${v.id}?from=competitors`} className="text-xs text-amber-300 hover:underline inline-flex items-center gap-1">
                <ScanSearch size={12} />
                Analyze this video
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated border border-bg-border p-3">
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}

/** What works on one channel: verdict and lessons first, then the patterns and the videos behind them. */
export function ChannelReport({ report }: { report: ChannelAuditReport }) {
  const { channel, stats } = report;
  const weaknesses = report.findings.filter((f) => f.kind === 'weakness');
  const strengths = report.findings.filter((f) => f.kind === 'strength');
  const notes = report.findings.filter((f) => f.kind === 'note');

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
        <div className="flex items-center gap-3">
          {channel.thumbnail ? (
            <Image src={channel.thumbnail} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-bg-elevated" />
          )}
          <div className="min-w-0">
            <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-white hover:underline inline-flex items-center gap-1.5">
              {channel.title}
              <ExternalLink size={14} className="text-zinc-500" />
            </a>
            <p className="text-sm text-zinc-400">
              {channel.subscriberCount !== null && `${formatCompact(channel.subscriberCount)} subscribers · `}
              {stats.videosRead} recent videos read
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Beat its usual by 2×+" value={stats.hitRate === null ? '—' : `${Math.round(stats.hitRate * 100)}%`} />
          <Stat label="Uploads, last 90 days" value={String(stats.uploadsLast90Days)} />
          <Stat label="Days between uploads" value={stats.medianDaysBetweenUploads === null ? '—' : String(stats.medianDaysBetweenUploads)} />
          <Stat label="Shorts" value={stats.shortsShare === null ? '—' : `${Math.round(stats.shortsShare * 100)}%`} />
        </div>
      </section>

      {report.isOwn && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-sky-500/30 bg-sky-500/10">
          <p className="flex-1 text-base text-sky-50">This is your own channel. Channel Doctor adds your click rate, retention and traffic.</p>
          <Link href="/youtube-doctor" className="btn-secondary btn-sm shrink-0">
            <Stethoscope size={14} />
            Open Channel Doctor
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
        <p className="text-lg text-white leading-relaxed">{report.verdict}</p>
        {report.lessons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-300 inline-flex items-center gap-1.5">
              <Lightbulb size={15} className="text-amber-300" />
              Worth testing on your channel
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

      <FindingList title="What works" findings={strengths} icon={CheckCircle2} className="text-emerald-300" />
      <FindingList title="Weak points" findings={weaknesses} icon={AlertTriangle} className="text-amber-300" />

      <VideoList title="Its standouts" videos={report.standouts} hint="Videos that got at least 2× this channel’s usual views for their format." />
      <VideoList title="Its weakest" videos={report.weakest} hint="Videos below half of this channel’s usual." />

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
