'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AudioChunk, ChunkStatus } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ChunkStatus, { label: string; className: string; icon: React.ReactNode }> = {
  PENDING: {
    label: 'Queued',
    className: 'badge-pending',
    icon: <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />,
  },
  PROCESSING: {
    label: 'Generating',
    className: 'badge-processing',
    icon: <Loader2 size={10} className="animate-spin" />,
  },
  COMPLETED: {
    label: 'Completed',
    className: 'badge-completed',
    icon: <CheckCircle2 size={10} />,
  },
  FAILED: {
    label: 'Failed',
    className: 'badge-failed',
    icon: <AlertCircle size={10} />,
  },
};

// ─── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPlaying(false);
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(el.duration);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, [audioUrl]);

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 mt-3 p-2.5 rounded-lg bg-bg-base/60 border border-bg-border">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        onClick={toggle}
        className="w-7 h-7 rounded-full bg-accent-purple flex items-center justify-center flex-shrink-0
                   hover:bg-accent-purple-light transition-colors"
      >
        {playing
          ? <Pause size={12} className="text-white" />
          : <Play size={12} className="text-white ml-0.5" />
        }
      </button>

      {/* Timeline */}
      <div className="flex-1">
        <div
          className="h-1.5 bg-bg-border rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            el.currentTime = ratio * duration;
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-accent-purple to-accent-purple-light rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 tabular-nums">
        {formatTime(current)} / {formatTime(duration)}
      </span>
    </div>
  );
}

// ─── Single Chunk Card ────────────────────────────────────────────────────────

interface ChunkCardProps {
  chunk: AudioChunk;
  onRetry?: (chunk: AudioChunk) => void;
  onTextChange?: (index: number, text: string) => void;
  editingEnabled: boolean;
}

function ChunkCard({ chunk, onRetry, onTextChange, editingEnabled }: ChunkCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[chunk.status];

  return (
    <div className={`card transition-all duration-200 animate-slide-up
                     ${chunk.status === 'PROCESSING' ? 'border-blue-800/50 glow-cyan' : ''}
                     ${chunk.status === 'COMPLETED' ? 'border-emerald-800/30' : ''}
                     ${chunk.status === 'FAILED' ? 'border-red-800/40' : ''}`}>
      {/* Chunk Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Index badge */}
          <span className="w-7 h-7 rounded-lg bg-bg-border flex items-center justify-center
                           text-xs font-bold text-slate-300 flex-shrink-0">
            {chunk.index + 1}
          </span>

          <div>
            <p className="text-xs font-semibold text-white">
              Chunk {chunk.index + 1}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cfg.className}>
                {cfg.icon}
                {cfg.label}
              </span>
              {chunk.status === 'COMPLETED' && chunk.durationMs > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock size={9} />
                  {formatMs(chunk.durationMs)}
                </span>
              )}
              {chunk.retryCount && chunk.retryCount > 0 && (
                <span className="text-[10px] text-amber-500">
                  retry #{chunk.retryCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {chunk.status === 'FAILED' && onRetry && (
            <button
              onClick={() => onRetry(chunk)}
              className="btn-ghost text-xs text-amber-400 hover:text-amber-300"
            >
              <RotateCcw size={12} />
              Retry
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="btn-ghost"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Processing bar */}
      {chunk.status === 'PROCESSING' && (
        <div className="h-1 bg-bg-border rounded-full overflow-hidden mb-2 animate-fade-in">
          <div className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full animate-pulse w-2/3" />
        </div>
      )}

      {/* Error message */}
      {chunk.status === 'FAILED' && chunk.error && (
        <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2 mb-2 animate-fade-in">
          {chunk.error}
        </p>
      )}

      {/* In-progress error/status message */}
      {chunk.status === 'PROCESSING' && chunk.error && (
        <p className="text-[11px] text-amber-400 mb-2 animate-fade-in">{chunk.error}</p>
      )}

      {/* Audio Player */}
      {chunk.status === 'COMPLETED' && chunk.audioUrl && (
        <AudioPlayer audioUrl={chunk.audioUrl} />
      )}

      {/* Expandable text editor */}
      {expanded && (
        <div className="mt-3 animate-fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-600 uppercase tracking-wide">Script Text</span>
            <span className="text-[10px] text-slate-600">
              {chunk.text.trim().split(/\s+/).length} words
            </span>
          </div>
          {editingEnabled ? (
            <textarea
              className="textarea text-xs leading-relaxed min-h-[80px] font-mono"
              value={chunk.text}
              onChange={(e) => onTextChange?.(chunk.index, e.target.value)}
              rows={5}
            />
          ) : (
            <div className="bg-bg-base/50 border border-bg-border rounded-lg p-3 text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
              {chunk.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AudioTimelineProps {
  chunks: AudioChunk[];
  onRetry?: (chunk: AudioChunk) => void;
  onTextChange?: (index: number, text: string) => void;
  editingEnabled?: boolean;
}

export default function AudioTimeline({
  chunks,
  onRetry,
  onTextChange,
  editingEnabled = true,
}: AudioTimelineProps) {
  const completed = chunks.filter((c) => c.status === 'COMPLETED').length;
  const totalDurationMs = chunks
    .filter((c) => c.status === 'COMPLETED')
    .reduce((acc, c) => acc + c.durationMs, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {chunks.length > 0 && (
        <div className="flex items-center gap-5 px-1 mb-2 animate-fade-in">
          <span className="text-sm font-semibold text-white">{completed}/{chunks.length} chunks</span>
          {totalDurationMs > 0 && (
            <span className="flex items-center gap-1 text-xs text-accent-purple-light">
              <Clock size={12} />
              {formatMs(totalDurationMs)} total
            </span>
          )}
          {/* Progress mini bar */}
          <div className="flex-1 h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-purple to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: chunks.length > 0 ? `${(completed / chunks.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Chunk cards */}
      {chunks.map((chunk) => (
        <ChunkCard
          key={chunk.index}
          chunk={chunk}
          onRetry={onRetry}
          onTextChange={onTextChange}
          editingEnabled={editingEnabled}
        />
      ))}
    </div>
  );
}
