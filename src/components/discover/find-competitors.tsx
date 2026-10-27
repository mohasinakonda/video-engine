'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, RefreshCw, Search, Wand2 } from 'lucide-react';
import { reportKey } from '@/lib/channel-doctor-storage';
import { RerunConfirm, isFresh } from './rerun-confirm';
import { ProgressSteps, type ProgressStep } from '@/components/youtube-doctor/progress-steps';
import { useAnalysisStream } from '@/components/youtube-doctor/use-diagnosis';
import { StreamError } from './stream-error';
import { formatCompact } from '@/components/youtube-doctor/format';
import { CompetitorAvatar } from './competitor-avatar';
import { GROUP_INFO, type CompetitorCandidate, type CompetitorGroup, type DiscoverConfig, type DiscoveryResult, type DiscoveryStage, type Relevance } from './types';

const STEPS: ProgressStep<DiscoveryStage>[] = [
  { stage: 'connect', label: 'Connecting to YouTube' },
  { stage: 'your_channel', label: 'Reading your videos' },
  { stage: 'search', label: (n) => (n ? `Searching YouTube for ${n} phrase${n === 1 ? '' : 's'}` : 'Searching YouTube') },
  { stage: 'candidates', label: (n) => (n ? `Checking ${n} channels` : 'Checking the channels we found') },
  { stage: 'classify', label: (n) => (n ? `Comparing ${n} active channels with your topics` : 'Comparing them with your topics') },
];

const RELEVANCE: Record<Relevance, { text: string; className: string }> = {
  high: { text: 'High relevance', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' },
  medium: { text: 'Medium relevance', className: 'bg-sky-500/15 text-sky-200 border-sky-500/30' },
  low: { text: 'Low relevance', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
};

interface FindCompetitorsProps {
  userId: string;
  channelId: string;
  config: DiscoverConfig;
  slotsLeft: number;
  onSaved: () => void;
  /** Called when a run ends (done, refused or failed), since it may have used a search. */
  onSearchUsed?: () => void;
}

/** Search-based discovery: editable phrases, real progress, then pick the channels to keep. */
export function FindCompetitors({ userId, channelId, config, slotsLeft, onSaved, onSearchUsed }: FindCompetitorsProps) {
  const [queries, setQueries] = useState<string[]>(() => Array(config.search.phrasesPerRun).fill(''));
  const [suggesting, setSuggesting] = useState(false);
  const cleanQueries = queries.map((q) => q.trim()).filter(Boolean);
  const discovery = useAnalysisStream<DiscoveryResult, DiscoveryStage>(
    '/api/youtube/discover/discovery',
    reportKey(userId, channelId, 'discovery'),
    { queries: cleanQueries }
  );

  // The page's "searches left today" was read when it opened; refresh it whenever a run ends.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !discovery.running) onSearchUsed?.();
    wasRunning.current = discovery.running;
  }, [discovery.running, onSearchUsed]);

  const [confirming, setConfirming] = useState(false);
  // The same phrases as the results on screen (the server runs them lowercased, up to the admin limit).
  const shownQueries = new Set(discovery.saved?.result.queries ?? []);
  const toRun = Array.from(new Set(cleanQueries.map((q) => q.toLowerCase()))).slice(0, config.search.phrasesPerRun);
  const sameAsShown = toRun.length > 0 && toRun.length === shownQueries.size && toRun.every((q) => shownQueries.has(q));
  const start = () => {
    if (discovery.saved && sameAsShown && isFresh(discovery.saved.analyzedAt)) setConfirming(true);
    else discovery.run();
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch('/api/youtube/discover/queries', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const suggested: string[] = data.queries || [];
      if (suggested.length) setQueries(Array.from({ length: config.search.phrasesPerRun }, (_, i) => suggested[i] ?? ''));
    } finally {
      setSuggesting(false);
    }
  };

  // Fill the phrases once, unless there are earlier results to show.
  useEffect(() => {
    if (!discovery.saved) suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (discovery.running) {
    return (
      <div className="space-y-4">
        <p className="text-lg font-semibold text-white">Finding channels like yours…</p>
        <ProgressSteps reached={discovery.stages} steps={STEPS} counts={discovery.counts} />
        <p className="text-sm text-zinc-400">Usually under a minute. Please keep this tab open.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <p className="text-base font-semibold text-white">What would your viewers search for?</p>
          <p className="text-sm text-zinc-400">We search YouTube for these phrases and look at who is making those videos now.</p>
        </div>
        <div className="space-y-2">
          {queries.map((q, i) => (
            <input
              key={i}
              type="text"
              value={q}
              maxLength={80}
              onChange={(e) => setQueries((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={suggesting ? 'Suggesting…' : `Search phrase ${i + 1}`}
              className="input text-base"
              aria-label={`Search phrase ${i + 1}`}
            />
          ))}
        </div>
        <button type="button" onClick={suggest} disabled={suggesting} className="btn-ghost btn-sm">
          {suggesting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Suggest from my videos
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={cleanQueries.length === 0 || !config.search.available || confirming}
          className="btn-primary px-6 py-3 text-base font-semibold"
        >
          {discovery.saved ? <RefreshCw size={18} /> : <Search size={18} />}
          {discovery.saved ? 'Search again' : 'Find competitors'}
        </button>
        <p className="text-sm text-zinc-400">
          Uses {config.costs.discovery} credits
          {config.search.available && ` · ${config.search.userRunsLeft} search${config.search.userRunsLeft === 1 ? '' : 'es'} left today`}
        </p>
      </div>

      {confirming && discovery.saved && (
        <RerunConfirm
          analyzedAt={discovery.saved.analyzedAt}
          cost={`${config.costs.discovery} credits and one of today’s searches`}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            discovery.run();
          }}
        />
      )}

      {!config.search.available && (
        <p className="text-sm text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          Search is used up for today. It resets at{' '}
          {new Date(config.search.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. You can still add channels by pasting their
          link above.
        </p>
      )}

      {discovery.error && <StreamError error={discovery.error} />}

      {discovery.saved && <Results result={discovery.saved.result} slotsLeft={slotsLeft} onSaved={onSaved} />}
    </div>
  );
}

function Results({ result, slotsLeft, onSaved }: { result: DiscoveryResult; slotsLeft: number; onSaved: () => void }) {
  const [picked, setPicked] = useState<Record<string, CompetitorGroup>>(() =>
    Object.fromEntries(
      result.candidates
        .filter((c) => c.relevance === 'high')
        .slice(0, slotsLeft)
        .map((c) => [c.channel.id, c.suggestedGroup])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const visible = result.candidates.filter((c) => !savedIds.includes(c.channel.id));
  const pickedIds = Object.keys(picked).filter((id) => !savedIds.includes(id));

  const toggle = (c: CompetitorCandidate) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[c.channel.id]) delete next[c.channel.id];
      else next[c.channel.id] = c.suggestedGroup;
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/youtube/discover/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: pickedIds.map((channelId) => ({ channelId, group: picked[channelId] })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save these channels.');
      setSavedIds((prev) => [...prev, ...pickedIds]);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (result.candidates.length === 0) {
    return (
      <div className="p-5 rounded-xl bg-bg-elevated border border-bg-border space-y-2">
        <p className="text-base font-semibold text-white">No matching channels found</p>
        <p className="text-base text-zinc-300">Try different search phrases, or add channels you already know by pasting their link.</p>
        {result.limitations.map((l) => (
          <p key={l} className="text-sm text-zinc-400">{l}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-6 border-t border-bg-border">
      <div>
        <p className="text-lg font-bold text-white">
          {visible.length} channel{visible.length === 1 ? '' : 's'} making videos like yours
        </p>
        <p className="text-sm text-zinc-400">
          Searched: {result.queries.map((q) => `“${q}”`).join(', ')}. Relevance is our estimate from their recent titles, not a YouTube metric.
        </p>
      </div>

      <ul className="space-y-3">
        {visible.map((c) => {
          const on = Boolean(picked[c.channel.id]);
          return (
            <li key={c.channel.id} className={`p-4 rounded-xl border transition-colors ${on ? 'border-emerald-500/50 bg-emerald-500/[0.04]' : 'border-bg-border bg-bg-surface'}`}>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  aria-pressed={on}
                  aria-label={on ? `Don't add ${c.channel.title}` : `Add ${c.channel.title}`}
                  className={`w-6 h-6 mt-2.5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-zinc-950' : 'border-zinc-600'}`}
                >
                  {on && <Check size={15} />}
                </button>
                <CompetitorAvatar src={c.channel.thumbnail} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={c.channel.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-white hover:underline inline-flex items-center gap-1">
                      {c.channel.title}
                      <ExternalLink size={12} className="text-zinc-500" />
                    </a>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${RELEVANCE[c.relevance].className}`}>{RELEVANCE[c.relevance].text}</span>
                    {c.channel.subscriberCount !== null && (
                      <span className="text-sm text-zinc-400">{formatCompact(c.channel.subscriberCount)} subscribers</span>
                    )}
                  </div>
                  <ul className="text-sm text-zinc-300 space-y-0.5">
                    {c.reasons.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                  {c.exampleTitles.length > 0 && (
                    <p className="text-sm text-zinc-400">
                      For example: {c.exampleTitles.map((t) => `“${t}”`).join(' · ')}
                    </p>
                  )}
                  {on && (
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      Save as
                      <select
                        value={picked[c.channel.id]}
                        onChange={(e) => setPicked((prev) => ({ ...prev, [c.channel.id]: e.target.value as CompetitorGroup }))}
                        className="input text-sm py-1 w-auto"
                      >
                        {(Object.keys(GROUP_INFO) as CompetitorGroup[]).map((g) => (
                          <option key={g} value={g}>
                            {GROUP_INFO[g].label} competitor
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {result.limitations.length > 0 && (
        <ul className="text-sm text-zinc-400 space-y-0.5">
          {result.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-4 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-bg-elevated border border-bg-border shadow-lg">
        <p className="flex-1 text-base text-zinc-200">
          {pickedIds.length} selected{pickedIds.length > slotsLeft && <span className="text-amber-300"> · only {slotsLeft} more fit on your list</span>}
        </p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={pickedIds.length === 0 || pickedIds.length > slotsLeft || saving}
          className="btn-primary px-5 text-base"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save {pickedIds.length || ''} to my competitors
        </button>
      </div>
    </div>
  );
}
