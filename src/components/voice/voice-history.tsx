'use client';

import { Play, Pause, Download, Trash2, Clock } from 'lucide-react';

export interface VoiceHistoryEntry {
  id: string;
  text: string;
  voiceName: string;
  engineName: string;
  createdAt: number;
  durationSec: number;
  chars: number;
}

interface VoiceHistoryProps {
  entries: VoiceHistoryEntry[];
  playingId: string | null;
  onPlay: (entry: VoiceHistoryEntry) => void;
  onDownload: (entry: VoiceHistoryEntry) => void;
  onDelete: (id: string) => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function VoiceHistory({
  entries,
  playingId,
  onPlay,
  onDownload,
  onDelete,
}: VoiceHistoryProps) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Recent generations
      </h3>
      <div className="space-y-2">
        {entries.map((entry) => {
          const isPlaying = entry.id === playingId;
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-bg-surface/40 border border-bg-border"
            >
              <button
                onClick={() => onPlay(entry)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isPlaying
                    ? 'bg-indigo-500 text-white'
                    : 'bg-bg-surface border border-bg-border text-slate-300 hover:bg-indigo-500/20 hover:text-white'
                }`}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{entry.text}</p>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>{entry.voiceName}</span>
                  <span>·</span>
                  <span>{entry.engineName}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} />
                    {formatDuration(entry.durationSec)}
                  </span>
                  <span>·</span>
                  <span>{timeAgo(entry.createdAt)}</span>
                </p>
              </div>

              <button
                onClick={() => onDownload(entry)}
                aria-label="Download"
                className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-bg-surface transition-colors"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                aria-label="Delete"
                className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
