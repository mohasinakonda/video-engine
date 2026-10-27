'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronUp, Lightbulb, Loader2, Search, Users } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { TextLink } from '@/components/ui/text-link';
import { formatAgo, formatCompact } from '@/components/youtube-doctor/format';
import { StreamError } from '@/components/discover/stream-error';
import { FollowButton } from '@/components/discover/follow-button';
import { RerunConfirm, isFresh } from '@/components/discover/rerun-confirm';
import { useAuth } from '@/contexts/auth-context';
import { loadReport, reportKey, saveReport } from '@/lib/channel-doctor-storage';
import { getYouTubeApiKey } from '@/lib/store';
import { COMPETITOR_SCAN, type ChannelSize, type TopicLandscape, type TopicVideo } from '@/lib/youtube/create/topic-landscape';
import { runStream, type StreamFailure } from './run-stream';
import { IncludedNote } from './included-note';
import { priceTag } from './pricing';
import type { CreateConfig, VideoProject } from './types';

type Sort = 'relevance' | 'perDay' | 'usual' | 'newest' | 'views';
type Kind = 'video' | 'short' | 'all';

const SORTS: { id: Sort; label: string; by: (v: TopicVideo) => number }[] = [
  // Results saved before the rank existed keep their order (the sort is stable).
  { id: 'relevance', label: 'YouTube’s order', by: (v) => -(v.rank ?? 0) },
  { id: 'perDay', label: 'Views per day', by: (v) => v.viewsPerDay ?? -1 },
  { id: 'usual', label: 'Beat their usual', by: (v) => v.usualRatio ?? v.perSubscriber ?? -1 },
  { id: 'newest', label: 'Newest', by: (v) => -v.ageDays },
  { id: 'views', label: 'Most viewed', by: (v) => v.views ?? -1 },
];

const SIZE: Record<ChannelSize, string> = { tiny: 'under 10K', small: '10K–100K', mid: '100K–1M', big: '1M+', unknown: 'hidden' };
const CROWD: Record<TopicLandscape['summary']['crowd'], { label: string; tone: BadgeTone }> = {
  quiet: { label: 'Quiet', tone: 'good' },
  active: { label: 'Active', tone: 'info' },
  crowded: { label: 'Crowded', tone: 'warn' },
};

/** "21,206×" says nothing; past 100× it's simply far beyond. */
const times = (x: number | null) => (x === null ? null : x >= 100 ? '100×+' : `${x >= 10 ? Math.round(x) : x}×`);

type TopicResult = { landscape: TopicLandscape; followed?: string[] };

/**
 * "Who made videos on this": the followed competitors' uploads on the brief's topic when there are
 * enough, else a YouTube search; read on request and kept in this tab only. Uses the user's own
 * API key if they saved one in Settings. Any result's channel can be followed in one click.
 */
export function TopicSearch({ project, topic, config, onProject }: { project: VideoProject; topic: string; config: CreateConfig; onProject: (p: VideoProject) => void }) {
  const projectId = project.id;
  const tag = priceTag(project, config, 'topicSearch');
  const { user } = useAuth();
  const key = user ? reportKey(user.id, 'topic', projectId, topic.toLowerCase().slice(0, 80)) : null;
  const [saved, setSaved] = useState<{ result: TopicResult; analyzedAt: string } | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<StreamFailure | null>(null);
  const [sort, setSort] = useState<Sort>('relevance');
  const [kind, setKind] = useState<Kind>('video');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!key) return;
    const found = loadReport<TopicResult>(key);
    setSaved(found);
    setFollowed(new Set(found?.result.followed ?? []));
    if (found) setOpen(true);
  }, [key]);

  /** 'auto' answers from followed channels when it can; 'youtube' always runs a YouTube search. */
  const run = async (scope: 'auto' | 'youtube' = 'auto') => {
    setRunning(true);
    setFailure(null);
    const ownKey = (await getYouTubeApiKey().catch(() => '')) || undefined;
    const out = await runStream<TopicResult & { project: VideoProject }>(`/api/create/projects/${projectId}/topic-search`, { youtubeApiKey: ownKey, scope });
    setRunning(false);
    if (!out.ok) return setFailure(out.error);
    onProject(out.data.project);
    if (key) saveReport(key, out.data);
    setSaved({ result: out.data, analyzedAt: new Date().toISOString() });
    setFollowed(new Set(out.data.followed ?? []));
  };

  const markFollowed = (channelId: string) => setFollowed((prev) => new Set(prev).add(channelId));

  const l = saved?.result.landscape;
  const counts = useMemo(() => {
    const shorts = l?.videos.filter((v) => v.format === 'short').length ?? 0;
    return { all: l?.videos.length ?? 0, short: shorts, video: (l?.videos.length ?? 0) - shorts };
  }, [l]);
  // Long videos first, like YouTube's results page, unless there are none.
  const shownKind: Kind = counts[kind] > 0 ? kind : 'all';
  const sorted = useMemo(() => {
    if (!l) return [];
    const by = SORTS.find((s) => s.id === sort)!.by;
    const ofKind = shownKind === 'all' ? l.videos : l.videos.filter((v) => (shownKind === 'short' ? v.format === 'short' : v.format !== 'short'));
    return [...ofKind].sort((a, b) => by(b) - by(a));
  }, [l, sort, shownKind]);

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
            <div className="space-y-1">
              <button
                type="button"
                className="btn-secondary"
                disabled={running || confirming}
                onClick={() => (saved && isFresh(saved.analyzedAt) ? setConfirming(true) : run('auto'))}
              >
                {running ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {l ? 'Search again' : 'Find videos on this'}
              </button>
              <IncludedNote note={tag.note} included={tag.included} />
            </div>
            <span className="text-xs text-zinc-500">
              {config.topicSearchesPerDay} per day. {saved && `Searched ${new Date(saved.analyzedAt).toLocaleString()}; kept in this tab only.`}
            </span>
          </div>
          {confirming && saved && (
            <RerunConfirm
              analyzedAt={saved.analyzedAt}
              cost={`${tag.included ? 'one of this video’s included searches' : 'credits'} and possibly one of today’s ${config.topicSearchesPerDay} YouTube searches`}
              onCancel={() => setConfirming(false)}
              onConfirm={() => {
                setConfirming(false);
                run('auto');
              }}
            />
          )}
          {running && <p className="text-sm text-zinc-400">Checking your competitors, then YouTube if needed… usually under 10 seconds.</p>}
          {failure && <StreamError error={failure} />}

          {l && (
            <div className="space-y-4">
              {l.source === 'competitors' && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-bg-elevated border border-bg-border">
                  <p className="text-sm text-zinc-200 inline-flex items-center gap-1.5">
                    <Users size={14} className="text-zinc-400" />
                    From your competitors: no YouTube search needed.
                  </p>
                  <button type="button" className="btn-ghost btn-sm" disabled={running} onClick={() => run('youtube')}>
                    <Search size={14} />
                    Search all of YouTube
                  </button>
                </div>
              )}
              {l.source !== 'competitors' && followed.size < COMPETITOR_SCAN.minFollowed && (
                <div className="flex gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                  <Lightbulb size={16} className="text-sky-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-sky-50">
                    Add {COMPETITOR_SCAN.minFollowed} or more channels you compete with (use the “Add to competitors” buttons below). Next time we check their videos first, with no
                    YouTube search, and they power{' '}
                    <Link href="/discover?tab=market" className="font-semibold underline">
                      Market research
                    </Link>
                    . You have {followed.size} now.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={CROWD[l.summary.crowd].tone}>{CROWD[l.summary.crowd].label}</Badge>
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

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Show</span>
                <Segmented
                  size="sm"
                  label="Show"
                  value={shownKind}
                  onChange={setKind}
                  options={(
                    [
                      ['video', 'Long videos'],
                      ['short', 'Shorts'],
                      ['all', 'All'],
                    ] as const
                  ).map(([id, label]) => ({
                    id,
                    label: (
                      <>
                        {label} <span className="tabular-nums opacity-60">{counts[id]}</span>
                      </>
                    ),
                  }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Sort by</span>
                <Segmented size="sm" label="Sort by" value={sort} onChange={setSort} options={SORTS.map((x) => ({ id: x.id, label: x.label }))} />
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
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <TextLink href={`/discover/video/${v.id}`}>Why did this work?</TextLink>
                        <FollowButton compact channelId={v.channelId} channelTitle={v.channelTitle} followed={followed.has(v.channelId)} onFollowed={markFollowed} />
                      </div>
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
