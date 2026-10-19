'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Link2, Loader2, Pause, Play, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { formatCompact } from '@/components/youtube-doctor/format';
import { AddByLink } from './add-by-link';
import { CompetitorAvatar } from './competitor-avatar';
import { FindCompetitors } from './find-competitors';
import { GROUP_INFO, type CompetitorGroup, type DiscoverConfig, type WatchlistEntry } from './types';

type Mode = 'list' | 'find' | 'paste';

/** Competitors tab: the saved list grouped by type, plus the two ways to add channels. */
export function CompetitorsPanel({
  userId,
  channelId,
  config,
  onCountChange,
}: {
  userId: string;
  channelId: string;
  config: DiscoverConfig;
  onCountChange?: (activeCount: number) => void;
}) {
  const [entries, setEntries] = useState<WatchlistEntry[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [channelInfoMissing, setChannelInfoMissing] = useState(false);
  const [mode, setMode] = useState<Mode>('list');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch('/api/youtube/discover/competitors');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load your competitors.');
      setEntries(data.competitors);
      setChannelInfoMissing(data.channelInfo === 'unavailable');
      onCountChange?.(data.competitors.filter((e: WatchlistEntry) => e.active).length);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle size={22} className="text-rose-400" />
        <p className="text-base text-zinc-300">{loadError}</p>
        <button type="button" onClick={load} className="btn-secondary btn-sm">
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }
  if (!entries) {
    return (
      <div className="card flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  const activeCount = entries.filter((e) => e.active).length;
  const slotsLeft = Math.max(0, config.maxCompetitors - activeCount);
  const afterAdd = () => {
    load();
  };

  // First run: two clear ways in, nothing else.
  if (entries.length === 0 && mode === 'list') {
    return (
      <section className="card space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white">Who are your competitors?</h2>
          <p className="text-base text-zinc-400 mt-1">
            Add 2 or more channels that make videos like yours. We only read their public videos, and they never need to sign in.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode('find')} className="text-left p-5 rounded-xl border border-bg-border bg-bg-elevated hover:border-emerald-500/50 space-y-1.5">
            <Search size={20} className="text-emerald-400" />
            <p className="text-base font-semibold text-white">Find them for me</p>
            <p className="text-sm text-zinc-400">We search YouTube and suggest channels. Uses {config.costs.discovery} credits.</p>
          </button>
          <button type="button" onClick={() => setMode('paste')} className="text-left p-5 rounded-xl border border-bg-border bg-bg-elevated hover:border-emerald-500/50 space-y-1.5">
            <Link2 size={20} className="text-sky-400" />
            <p className="text-base font-semibold text-white">I know my competitors</p>
            <p className="text-sm text-zinc-400">Paste their channel links. Free.</p>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={20} className="text-emerald-400" />
              Your competitors
            </h2>
            <p className="text-sm text-zinc-400">
              {activeCount} of {config.maxCompetitors} used in research
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(mode === 'paste' ? 'list' : 'paste')} className={mode === 'paste' ? 'btn-secondary' : 'btn-ghost'}>
              <Link2 size={15} />
              Add by link
            </button>
            <button type="button" onClick={() => setMode(mode === 'find' ? 'list' : 'find')} className={mode === 'find' ? 'btn-secondary' : 'btn-ghost'}>
              <Search size={15} />
              Find more
            </button>
          </div>
        </div>

        {mode === 'paste' && (
          <div className="pt-4 border-t border-bg-border">
            <AddByLink onAdded={afterAdd} disabled={slotsLeft === 0} />
            {slotsLeft === 0 && <p className="text-sm text-amber-300 mt-2">Your list is full. Remove or pause a channel to add another.</p>}
          </div>
        )}
        {mode === 'find' && (
          <div className="pt-4 border-t border-bg-border">
            <FindCompetitors userId={userId} channelId={channelId} config={config} slotsLeft={slotsLeft} onSaved={afterAdd} />
          </div>
        )}
      </section>

      {entries.length === 0 && mode === 'paste' && (
        <p className="text-sm text-zinc-400">Tip: open a competitor’s channel on YouTube and copy the address bar, or copy any of their video links.</p>
      )}

      {channelInfoMissing && (
        <p className="text-sm text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          We couldn’t load channel details from YouTube right now. Reconnect YouTube on the Channel Doctor page if this keeps happening.
        </p>
      )}

      {(Object.keys(GROUP_INFO) as CompetitorGroup[]).map((group) => {
        const rows = entries.filter((e) => e.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold text-white">{GROUP_INFO[group].label}</h3>
              <p className="text-sm text-zinc-500">{GROUP_INFO[group].help}</p>
            </div>
            <ul className="space-y-2">
              {rows.map((entry) => (
                <CompetitorRow key={entry.channelId} entry={entry} canActivate={slotsLeft > 0} onChanged={load} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CompetitorRow({ entry, canActivate, onChanged }: { entry: WatchlistEntry; canActivate: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { channel } = entry;

  const request = async (method: 'PATCH' | 'DELETE', body?: object) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/youtube/discover/competitors/${entry.channelId}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update this channel.');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`p-4 rounded-xl border border-bg-border bg-bg-surface ${entry.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CompetitorAvatar src={channel?.thumbnail} />
          <div className="min-w-0">
            {channel ? (
              <a href={channel.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-white hover:underline inline-flex items-center gap-1 max-w-full">
                <span className="truncate">{entry.label || channel.title}</span>
                <ExternalLink size={12} className="text-zinc-500 shrink-0" />
              </a>
            ) : (
              <p className="text-base font-semibold text-zinc-300">{entry.label || 'Channel unavailable'}</p>
            )}
            <p className="text-sm text-zinc-400">
              {channel
                ? [
                    entry.label && channel.title,
                    channel.subscriberCount !== null && `${formatCompact(channel.subscriberCount)} subscribers`,
                    channel.videoCount !== null && `${formatCompact(channel.videoCount)} videos`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'YouTube didn’t return this channel. It may be private or deleted.'}
              {!entry.active && ' · Paused (not used in research)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <select
            value={entry.group}
            onChange={(e) => request('PATCH', { group: e.target.value })}
            disabled={busy}
            className="input text-sm py-1.5 w-auto"
            aria-label="Competitor type"
          >
            {(Object.keys(GROUP_INFO) as CompetitorGroup[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_INFO[g].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => request('PATCH', { active: !entry.active })}
            disabled={busy || (!entry.active && !canActivate)}
            className="btn-ghost btn-sm"
            title={entry.active ? 'Pause: keep it saved but leave it out of research' : 'Use in research again'}
          >
            {entry.active ? <Pause size={14} /> : <Play size={14} />}
            {entry.active ? 'Pause' : 'Resume'}
          </button>
          <button type="button" onClick={() => request('DELETE')} disabled={busy} className="btn-ghost btn-sm text-rose-400" aria-label={`Remove ${channel?.title || 'channel'}`}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-rose-400 mt-2">{error}</p>}
    </li>
  );
}
