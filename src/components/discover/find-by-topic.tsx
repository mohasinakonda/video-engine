'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, ScanSearch, Search } from 'lucide-react';
import { loadReport, reportKey, saveReport } from '@/lib/channel-doctor-storage';
import { formatCompact } from '@/components/youtube-doctor/format';
import type { ChannelHit } from '@/lib/youtube/discover/channel-search';
import { CompetitorAvatar } from './competitor-avatar';
import { FollowButton } from './follow-button';
import { RerunConfirm, isFresh } from './rerun-confirm';
import type { DiscoverConfig } from './types';

type Found = { query: string; channels: ChannelHit[] };
const PREVIEW = 10;

/**
 * "Search a topic": type what you make videos about, see the channels behind its top YouTube
 * videos, and add the ones you compete with. One search, no credits; the result stays in this
 * tab only.
 */
export function FindByTopic({
  userId,
  config,
  slotsLeft,
  onFollowed,
  onSearchUsed,
}: {
  userId: string;
  config: DiscoverConfig;
  slotsLeft: number;
  onFollowed: () => void;
  onSearchUsed?: () => void;
}) {
  const key = reportKey(userId, 'channel-search', 'last');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<{ result: Found; analyzedAt: string } | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [left, setLeft] = useState(config.topicSearch?.left ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const found = loadReport<Found>(key);
    if (!found) return;
    setSaved(found);
    setQuery(found.result.query);
    setFollowed(new Set(found.result.channels.filter((c) => c.following).map((c) => c.channelId)));
  }, [key]);

  useEffect(() => setLeft(config.topicSearch?.left ?? 0), [config.topicSearch?.left]);

  const perDay = config.topicSearch?.perDay ?? 0;
  const canSearch = !!config.topicSearch?.available && left > 0;

  const search = async () => {
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/youtube/discover/channel-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The search didn’t work. Please try again.');
      const result: Found = { query: data.query, channels: data.channels };
      saveReport(key, result);
      setSaved({ result, analyzedAt: new Date().toISOString() });
      setFollowed(new Set(result.channels.filter((c) => c.following).map((c) => c.channelId)));
      setLeft(data.searchesLeft);
      setShowAll(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      onSearchUsed?.();
    }
  };

  const start = () => {
    if (!query.trim() || busy) return;
    const same = saved && saved.result.query.toLowerCase() === query.trim().toLowerCase();
    if (same && isFresh(saved.analyzedAt)) setConfirming(true);
    else search();
  };

  const markFollowed = (channelId: string) => {
    setFollowed((prev) => new Set(prev).add(channelId));
    // Keep the tab's copy current, so a refresh doesn’t offer "Add to competitors" again.
    if (saved) {
      const result = { ...saved.result, channels: saved.result.channels.map((c) => (c.channelId === channelId ? { ...c, following: true } : c)) };
      saveReport(key, result);
    }
    onFollowed();
  };

  const channels = saved?.result.channels ?? [];
  const shown = showAll ? channels : channels.slice(0, PREVIEW);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), start())}
            placeholder="What do you make videos about? e.g. budget travel, ঘরোয়া রান্না"
            className="input text-base flex-1"
            aria-label="Topic"
            maxLength={100}
          />
          <button type="button" onClick={start} disabled={!query.trim() || busy || !canSearch} className="btn-primary text-base px-5">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          {canSearch
            ? `We look at the top YouTube videos on this topic and show who made them. No credits. ${left} of ${perDay} topic searches left today (shared with Create).`
            : left === 0
              ? `You’ve used today’s ${perDay} topic searches. They reset tomorrow. You can still add channels by link.`
              : 'Today’s YouTube search limit for our app is used up. You can still add channels by link.'}
        </p>
      </div>

      {confirming && saved && <RerunConfirm analyzedAt={saved.analyzedAt} cost="1 of your topic searches" onConfirm={search} onCancel={() => setConfirming(false)} />}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {slotsLeft === 0 && channels.length > 0 && <p className="text-sm text-amber-300">Your list is full. Remove or pause a channel to add another.</p>}

      {saved && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            {channels.length === 0 ? (
              <>No channels found for “{saved.result.query}”. Try different words.</>
            ) : (
              <>
                {channels.length} channel{channels.length === 1 ? '' : 's'} made the top videos for “{saved.result.query}”. Add the ones that make videos like yours.
              </>
            )}
          </p>
          <ul className="space-y-2">
            {shown.map((c) => (
              <li key={c.channelId} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-bg-border bg-bg-surface">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <CompetitorAvatar src={c.thumbnail} size={40} />
                  <div className="min-w-0 space-y-0.5">
                    <a href={`https://www.youtube.com/channel/${c.channelId}`} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-white hover:underline truncate block">
                      {c.title}
                    </a>
                    <p className="text-sm text-zinc-400">
                      {c.subscribers === null ? 'Subscribers hidden' : `${formatCompact(c.subscribers)} subscribers`} · {c.videosInResults} video{c.videosInResults === 1 ? '' : 's'} in these results
                    </p>
                    <a
                      href={`https://www.youtube.com/watch?v=${c.topVideo.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 min-w-0"
                    >
                      {c.topVideo.thumbnailUrl && <Image src={c.topVideo.thumbnailUrl} alt="" width={48} height={27} className="w-12 aspect-video rounded object-cover shrink-0" />}
                      <span className="truncate">
                        {c.topVideo.title}
                        {c.topVideo.views !== null && ` · ${formatCompact(c.topVideo.views)} views`}
                      </span>
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:ml-auto">
                  {config.audit?.hasAccess && (
                    <Link href={`/discover/channel/${c.channelId}?from=competitors`} className="btn-ghost btn-sm text-amber-300" title="What works on this channel">
                      <ScanSearch size={14} />
                      Analyze
                    </Link>
                  )}
                  <FollowButton
                    channelId={c.channelId}
                    channelTitle={c.title}
                    followed={followed.has(c.channelId)}
                    onFollowed={markFollowed}
                    className={slotsLeft === 0 ? 'pointer-events-none opacity-50' : ''}
                  />
                </div>
              </li>
            ))}
          </ul>
          {channels.length > PREVIEW && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${channels.length} channels`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
