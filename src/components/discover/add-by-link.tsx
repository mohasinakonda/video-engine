'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { GROUP_INFO, type CompetitorGroup } from './types';

/** Paste a channel link, @handle or any video link. No search quota is used. */
export function AddByLink({ onAdded, disabled }: { onAdded: () => void; disabled?: boolean }) {
  const [input, setInput] = useState('');
  const [group, setGroup] = useState<CompetitorGroup>('direct');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/youtube/discover/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, group }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add this channel.');
      if (data.added?.length === 0) throw new Error('This channel is already on your list.');
      setInput('');
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="youtube.com/@channel, or any of their video links"
          className="input text-base flex-1"
          aria-label="Channel link"
          disabled={disabled}
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as CompetitorGroup)}
          className="input text-base sm:w-40"
          aria-label="Competitor type"
          disabled={disabled}
        >
          {(Object.keys(GROUP_INFO) as CompetitorGroup[]).map((g) => (
            <option key={g} value={g}>
              {GROUP_INFO[g].label}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={!input.trim() || busy || disabled} className="btn-primary text-base px-5">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Add
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
