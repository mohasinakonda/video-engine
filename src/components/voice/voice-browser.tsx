'use client';

import { useMemo, useState } from 'react';
import { Search, Play, Pause, Check } from 'lucide-react';
import type { InworldVoice, VoiceFilter } from '@/lib/inworld-voices';
import { VOICE_FILTERS } from '@/lib/inworld-voices';

interface VoiceBrowserProps {
  voices: InworldVoice[];
  selectedId: string;
  onSelect: (voice: InworldVoice) => void;
  onPreview: (voice: InworldVoice) => void;
  previewingId: string | null;
}

const FILTER_LABELS: Record<VoiceFilter, string> = {
  all: 'All',
  narration: 'Narration',
  conversational: 'Conversational',
  character: 'Characters',
  advertising: 'Ads & Promo',
};

export default function VoiceBrowser({
  voices,
  selectedId,
  onSelect,
  onPreview,
  previewingId,
}: VoiceBrowserProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VoiceFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voices.filter((v) => {
      if (filter !== 'all' && !v.tags.includes(filter)) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q)
      );
    });
  }, [voices, query, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="relative mb-3">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search voices…"
          className="w-full bg-bg-surface border border-bg-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {VOICE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-bg-surface text-slate-400 border border-bg-border hover:text-slate-200'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Voice list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-8">
            No voices match your search.
          </p>
        )}
        {filtered.map((voice) => {
          const isSelected = voice.id === selectedId;
          const isPreviewing = voice.id === previewingId;
          return (
            <div
              key={voice.id}
              onClick={() => onSelect(voice)}
              className={`group flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-indigo-500/10 border-indigo-500/50'
                  : 'bg-bg-surface/40 border-bg-border hover:border-slate-600'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(voice);
                }}
                aria-label={isPreviewing ? `Stop preview ${voice.name}` : `Preview ${voice.name}`}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isPreviewing
                    ? 'bg-indigo-500 text-white'
                    : 'bg-bg-surface border border-bg-border text-slate-300 hover:bg-indigo-500/20 hover:text-white'
                }`}
              >
                {isPreviewing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white truncate">{voice.name}</span>
                  {isSelected && <Check size={13} className="text-indigo-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-slate-500 truncate">{voice.description}</p>
              </div>

              <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-slate-600 border border-bg-border rounded px-1.5 py-0.5">
                {voice.language.slice(0, 2).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
