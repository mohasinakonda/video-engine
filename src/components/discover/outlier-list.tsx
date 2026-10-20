import Image from 'next/image';
import Link from 'next/link';
import { ScanSearch } from 'lucide-react';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import { formatAgo, formatCompact } from '@/components/youtube-doctor/format';
import { FORMAT_LABELS, type Outlier, type ResearchWindow, type TopicSummary } from './types';

/** The market's standout videos, each with the numbers behind "standout". */
export function OutlierList({ outliers, period, topics, canAnalyze = false }: { outliers: Outlier[]; period: ResearchWindow; topics: TopicSummary[]; canAnalyze?: boolean }) {
  const topicLabel = new Map(topics.map((t) => [t.id, t.label]));
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Videos that beat their channel’s usual</h3>
        <p className="text-sm text-zinc-400 mt-0.5">
          “5.9×” means 5.9 times the views that channel usually gets for the same kind of video (Short or long). Calculated by us from
          public view counts, not a YouTube metric.
        </p>
      </div>

      {outliers.length === 0 ? (
        <p className="text-base text-zinc-300 p-5 rounded-xl bg-bg-surface border border-bg-border">
          None of your competitors’ videos from the last {period === '30d' ? '30' : '90'} days clearly beat their usual.
          {period === '30d' && ' Try 90 days for a bigger sample.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {outliers.slice(0, 15).map((o) => (
            <li key={o.videoId} className="flex gap-4 p-4 rounded-xl border border-bg-border bg-bg-surface">
              <a href={`https://www.youtube.com/watch?v=${o.videoId}`} target="_blank" rel="noopener noreferrer" className="shrink-0 hidden sm:block">
                {o.thumbnailUrl ? (
                  <Image src={o.thumbnailUrl} alt="" width={160} height={90} className="w-40 h-[90px] rounded-lg object-cover" />
                ) : (
                  <div className="w-40 h-[90px] rounded-lg bg-bg-elevated" />
                )}
              </a>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-200 text-lg font-bold tabular-nums">{o.ratio}×</span>
                  <a
                    href={`https://www.youtube.com/watch?v=${o.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-white leading-snug hover:underline"
                  >
                    {o.title}
                  </a>
                </div>
                <p className="text-sm text-zinc-400">
                  {o.channelTitle} · {o.format === 'short' ? 'Short' : 'Video'} · {formatAgo(o.ageDays)}
                </p>
                <p className="text-sm text-zinc-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {formatCompact(o.views)} views · usually {formatCompact(o.baselineViews)} · compared with {o.sampleSize} of their{' '}
                    {o.format === 'short' ? 'Shorts' : 'videos'}
                  </span>
                  <EvidenceBadge confidence={o.confidence} />
                </p>
                {canAnalyze && (
                  <Link href={`/discover/video/${o.videoId}?from=market`} className="btn-ghost btn-xs text-amber-300 w-fit">
                    <ScanSearch size={13} />
                    Why did this work?
                  </Link>
                )}
                {(o.topicId || o.contentFormat) && (
                  <div className="flex flex-wrap gap-1.5">
                    {o.topicId && topicLabel.get(o.topicId) && (
                      <span className="px-2 py-0.5 rounded-md bg-bg-elevated border border-bg-border text-xs text-zinc-300">Topic: {topicLabel.get(o.topicId)}</span>
                    )}
                    {o.contentFormat && (
                      <span className="px-2 py-0.5 rounded-md bg-bg-elevated border border-bg-border text-xs text-zinc-300">{FORMAT_LABELS[o.contentFormat]}</span>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
