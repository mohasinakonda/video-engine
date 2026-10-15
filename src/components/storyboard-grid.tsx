'use client';

import { useMemo, useState } from 'react';
import { Images, ChevronDown, ChevronUp } from 'lucide-react';
import type { SceneItem } from '@/types';
import SceneCard from './scene-card';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StoryboardGridProps {
  scenes: SceneItem[];
  projectId?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  stylePrompt?: string;
  onRegenerate: (scene: SceneItem, newPrompt?: string) => void;
  onUpload: (scene: SceneItem, file: File) => void;
  onUpdateDuration?: (sceneId: number, deltaSec: number) => void;
  disabled?: boolean;
}

type SceneFilter = 'all' | 'ready' | 'pending' | 'generating' | 'failed';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 60; // render 60 scenes at a time

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryboardGrid({
  scenes,
  projectId,
  aspectRatio = '16:9',
  stylePrompt,
  onRegenerate,
  onUpload,
  onUpdateDuration,
  disabled,
}: StoryboardGridProps) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<SceneFilter>('all');

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = scenes.length;
    const imageReady = scenes.filter(
      (s) => s.status === 'IMAGE_READY' || s.status === 'GENERATING_MOTION' || s.status === 'MOTION_READY'
    ).length;
    const motionReady = scenes.filter((s) => s.status === 'MOTION_READY').length;
    const failed = scenes.filter((s) => s.status === 'FAILED').length;
    const pending = scenes.filter((s) => s.status === 'PENDING').length;
    const generating = scenes.filter(
      (s) => s.status === 'GENERATING_IMAGE' || s.status === 'GENERATING_MOTION'
    ).length;

    const imagePercent = total > 0 ? Math.round((imageReady / total) * 100) : 0;
    const motionPercent = total > 0 ? Math.round((motionReady / total) * 100) : 0;

    return { total, imageReady, motionReady, failed, pending, generating, imagePercent, motionPercent };
  }, [scenes]);

  // ─── Filter + Pagination ─────────────────────────────────────────────────────

  const filteredScenes = useMemo(() => {
    switch (filter) {
      case 'ready':
        return scenes.filter(
          (s) => s.status === 'IMAGE_READY' || s.status === 'GENERATING_MOTION' || s.status === 'MOTION_READY'
        );
      case 'pending':
        return scenes.filter((s) => s.status === 'PENDING');
      case 'generating':
        return scenes.filter((s) => s.status === 'GENERATING_IMAGE' || s.status === 'GENERATING_MOTION');
      case 'failed':
        return scenes.filter((s) => s.status === 'FAILED');
      default:
        return scenes;
    }
  }, [scenes, filter]);

  const totalPages = Math.ceil(filteredScenes.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleScenes = filteredScenes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const filterChips: { id: SceneFilter; label: string; count: number; tone?: 'danger' }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'ready', label: 'Ready', count: stats.imageReady },
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'generating', label: 'Generating', count: stats.generating },
    { id: 'failed', label: 'Failed', count: stats.failed, tone: 'danger' },
  ];

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center mb-4">
          <Images size={28} className="text-zinc-600" />
        </div>
        <h3 className="text-base font-semibold text-zinc-300 mb-1">No scenes yet</h3>
        <p className="text-sm text-zinc-500 max-w-xs">
          Generate scenes from your script to populate the storyboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Slim toolbar: filters + progress ───────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {filterChips
              .filter((c) => c.id === 'all' || c.id === filter || c.count > 0)
              .map((c) => {
                const active = filter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setFilter(c.id);
                      setPage(0);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors border ${
                      active
                        ? 'bg-white text-zinc-950 border-white font-semibold'
                        : c.tone === 'danger'
                          ? 'text-red-300 border-red-900/60 hover:bg-red-950/40'
                          : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-zinc-800/60'
                    }`}
                  >
                    <span>{c.label}</span>
                    <span className={`font-mono text-2xs ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>{c.count}</span>
                  </button>
                );
              })}
          </div>

          {/* Progress summary: ring + counts */}
          <div className="flex items-center gap-3">
            <ProgressRing percent={stats.imagePercent} active={stats.generating > 0} />
            <div className="leading-tight">
              <p className="text-xs font-medium text-zinc-100">
                {stats.imageReady}
                <span className="text-zinc-500"> / {stats.total} images</span>
              </p>
              <p className="text-2xs text-zinc-500 mt-0.5">
                {stats.motionReady > 0 ? `${stats.motionReady} motion clips` : 'No motion clips yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scene Grid (Google Flow Studio Gallery) ─────────────────────────── */}
      {visibleScenes.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-12">No scenes match this filter.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-3.5">
        {visibleScenes.map((scene) => (
          <SceneCard
            key={scene.sceneId}
            scene={scene}
            projectId={projectId}
            aspectRatio={aspectRatio}
            stylePrompt={stylePrompt}
            onRegenerate={onRegenerate}
            onUpload={onUpload}
            onUpdateDuration={onUpdateDuration}
            disabled={disabled}
          />
        ))}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <ChevronUp size={13} />
            Previous {PAGE_SIZE}
          </button>
          <span className="text-xs text-zinc-500">
            Page {safePage + 1} / {totalPages} · Scenes {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredScenes.length)}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Next {PAGE_SIZE}
            <ChevronDown size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ percent, active }: { percent: number; active?: boolean }) {
  const size = 34;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const done = percent >= 100;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className={`-rotate-90 ${active ? 'animate-pulse' : ''}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ${done ? 'stroke-emerald-400' : 'stroke-white'}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xs font-bold font-mono text-zinc-200">
        {percent}
      </span>
    </div>
  );
}
