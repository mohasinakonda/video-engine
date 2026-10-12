'use client';

import { useMemo, useState } from 'react';
import { Search, Play, Pause, Check } from 'lucide-react';
import type { VoicePreset, VoiceFilter } from '@/lib/voice-catalog';
import { VOICE_FILTERS } from '@/lib/voice-catalog';

interface VoiceBrowserProps {
  voices: VoicePreset[];
  selectedId: string;
  onSelect: (voice: VoicePreset) => void;
  onPreview: (voice: VoicePreset) => void;
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
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search voices…"
          className="w-full bg-bg-surface border border-bg-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
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
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-600'
                : 'bg-bg-surface text-zinc-400 border border-bg-border hover:text-zinc-200'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Voice list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1 space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-8">
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
                  ? 'bg-zinc-800/80 border-white/40 ring-1 ring-white/10'
                  : 'bg-bg-surface/40 border-bg-border hover:border-zinc-700'
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
                    ? 'bg-white text-zinc-950'
                    : 'bg-bg-surface border border-bg-border text-zinc-300 hover:bg-zinc-850 hover:text-white'
                }`}
              >
                {isPreviewing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white truncate">{voice.name}</span>
                  {isSelected && <Check size={13} className="text-white flex-shrink-0" />}
                </div>
                <p className="text-xs text-zinc-400 truncate">{voice.description}</p>
              </div>

              <span className="flex-shrink-0 text-2xs uppercase tracking-wide text-zinc-400 border border-bg-border rounded px-1.5 py-0.5">
                {voice.language.slice(0, 2).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
