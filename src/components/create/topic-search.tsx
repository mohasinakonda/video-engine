'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, ScanSearch, Search } from 'lucide-react';
import { formatAgo, formatCompact } from '@/components/youtube-doctor/format';
import { StreamError } from '@/components/discover/stream-error';
import { useAuth } from '@/contexts/auth-context';
import { loadReport, reportKey, saveReport } from '@/lib/channel-doctor-storage';
import { getYouTubeApiKey } from '@/lib/store';
import type { ChannelSize, TopicLandscape, TopicVideo } from '@/lib/youtube/create/topic-landscape';
import { runStream, type StreamFailure } from './run-stream';
import type { CreateConfig } from './types';

type Sort = 'perDay' | 'usual' | 'newest' | 'views';

const SORTS: { id: Sort; label: string; by: (v: TopicVideo) => number }[] = [
  { id: 'perDay', label: 'Views per day', by: (v) => v.viewsPerDay ?? -1 },
  { id: 'usual', label: 'Beat their usual', by: (v) => v.usualRatio ?? v.perSubscriber ?? -1 },
  { id: 'newest', label: 'Newest', by: (v) => -v.ageDays },
  { id: 'views', label: 'Most viewed', by: (v) => v.views ?? -1 },
];

const SIZE: Record<ChannelSize, string> = { tiny: 'under 10K', small: '10K–100K', mid: '100K–1M', big: '1M+', unknown: 'hidden' };
const CROWD = {
  quiet: { label: 'Quiet', className: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  active: { label: 'Active', className: 'bg-sky-500/10 text-sky-200 border-sky-500/30' },
  crowded: { label: 'Crowded', className: 'bg-amber-500/10 text-amber-200 border-amber-500/30' },
};

/** "21,206×" says nothing; past 100× it's simply far beyond. */
const times = (x: number | null) => (x === null ? null : x >= 100 ? '100×+' : `${x >= 10 ? Math.round(x) : x}×`);

/**
 * "Who made videos on this": a YouTube search for the brief's topic, read on request and kept in
 * this tab only. Uses the user's own API key if they saved one in Settings.
 */
export function TopicSearch({ projectId, topic, config }: { projectId: string; topic: string; config: CreateConfig }) {
  const { user } = useAuth();
  const key = user ? reportKey(user.id, 'topic', projectId, topic.toLowerCase().slice(0, 80)) : null;
  const [saved, setSaved] = useState<{ result: { landscape: TopicLandscape }; analyzedAt: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<StreamFailure | null>(null);
  const [sort, setSort] = useState<Sort>('perDay');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!key) return;
    const found = loadReport<{ landscape: TopicLandscape }>(key);
    setSaved(found);
    if (found) setOpen(true);
  }, [key]);

  const run = async () => {
    setRunning(true);
    setFailure(null);
    const ownKey = (await getYouTubeApiKey().catch(() => '')) || undefined;
    const out = await runStream<{ landscape: TopicLandscape }>(`/api/create/projects/${projectId}/topic-search`, { youtubeApiKey: ownKey });
    setRunning(false);
    if (!out.ok) return setFailure(out.error);
    if (key) saveReport(key, out.data);
    setSaved({ result: out.data, analyzedAt: new Date().toISOString() });
  };

  const l = saved?.result.landscape;
  const sorted = useMemo(() => {
    if (!l) return [];
    const by = SORTS.find((s) => s.id === sort)!.by;
    return [...l.videos].sort((a, b) => by(b) - by(a));
  }, [l, sort]);

  if (config.topicSearchesPerDay <= 0) return null;

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <button type="button" className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="block text-lg font-semibold text-white">Who made videos on this?</span>
          <span className="block text-sm text-zinc-400">What’s already on YouTube for “{topic}”, and how it performs.</span>
        </span>
        {open ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
      </button>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" disabled={running} onClick={run}>
              {running ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {l ? 'Search again' : 'Search YouTube'} · {config.costs.topicSearch} credits
            </button>
            <span className="text-xs text-zinc-500">
              {config.topicSearchesPerDay} per day. {saved && `Searched ${new Date(saved.analyzedAt).toLocaleString()}; kept in this tab only.`}
            </span>
          </div>
          {running && <p className="text-sm text-zinc-400">Searching YouTube and reading each channel’s usual… usually under 10 seconds.</p>}
          {failure && <StreamError error={failure} />}

          {l && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg border text-sm font-medium ${CROWD[l.summary.crowd].className}`}>{CROWD[l.summary.crowd].label}</span>
                <span className="text-sm text-zinc-300">
                  {l.summary.found} videos from {l.summary.channels} channels · {l.summary.last90} in the last 90 days
                  {l.summary.medianViews !== null && ` · typical ${formatCompact(l.summary.medianViews)} views`}
                </span>
              </div>
              <ul className="space-y-1">
                {l.signals.map((s) => (
                  <li key={s} className="text-base text-zinc-100">
                    → {s}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-zinc-500">
                Channel sizes: {(Object.keys(SIZE) as ChannelSize[]).filter((k) => l.summary.sizes[k]).map((k) => `${l.summary.sizes[k]} ${SIZE[k]}`).join(' · ')}
              </p>

              {l.similar.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <p className="text-sm font-semibold text-amber-200 inline-flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    Close to your plan
                  </p>
                  {l.similar.map((s) => (
                    <p key={s.id} className="text-sm text-amber-100">
                      “{s.title}” is close to your “{s.to}”. Think about a different angle or wording.
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-500 mr-1">Sort</span>
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSort(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs border ${sort === s.id ? 'bg-white text-zinc-950 border-white' : 'bg-bg-elevated text-zinc-300 border-bg-border'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <ul className="space-y-2">
                {(showAll ? sorted : sorted.slice(0, 10)).map((v) => (
                  <li key={v.id} className="flex gap-3 p-3 rounded-xl bg-bg-elevated border border-bg-border">
                    <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {v.thumbnailUrl ? (
                        <Image src={v.thumbnailUrl} alt="" width={128} height={72} className="w-28 sm:w-32 aspect-video rounded-lg object-cover" />
                      ) : (
                        <div className="w-28 sm:w-32 aspect-video rounded-lg bg-bg-surface" />
                      )}
                    </a>
                    <div className="min-w-0 flex-1 space-y-1">
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white line-clamp-2 hover:underline">
                        {v.title}
                      </a>
                      <p className="text-xs text-zinc-400">
                        {v.channelTitle} ({v.subscribers === null ? 'subscribers hidden' : `${formatCompact(v.subscribers)} subs`}) · {formatAgo(v.ageDays)}
                        {v.format === 'short' && ' · Short'}
                        {v.bangla && ' · বাংলা'}
                      </p>
                      <p className="text-xs flex flex-wrap gap-x-3 gap-y-0.5">
                        {v.views !== null && <span className="text-zinc-200">{formatCompact(v.views)} views</span>}
                        {v.viewsPerDay !== null && (
                          <span className="text-zinc-300">
                            {formatCompact(v.viewsPerDay)}/day{v.isNew && <span className="text-sky-300"> · new</span>}
                          </span>
                        )}
                        {v.perSubscriber !== null && <span className={v.perSubscriber >= 2 ? 'text-emerald-300' : 'text-zinc-400'}>{times(v.perSubscriber)} its subscribers</span>}
                        {v.usualRatio !== null && <span className={v.usualRatio >= 2 ? 'text-emerald-300' : 'text-zinc-400'}>{times(v.usualRatio)} its usual</span>}
                      </p>
                      <Link href={`/discover/video/${v.id}`} className="text-xs text-amber-300 hover:underline inline-flex items-center gap-1">
                        <ScanSearch size={12} />
                        Why did this work?
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              {sorted.length > 10 && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
                </button>
              )}
              <ul className="space-y-0.5 text-xs text-zinc-500">
                {l.limitations.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
