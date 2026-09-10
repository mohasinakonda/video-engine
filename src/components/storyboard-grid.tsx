'use client';

import { useMemo, useState } from 'react';
import { Images, Video, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { SceneItem } from '@/types';
import SceneCard from './scene-card';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StoryboardGridProps {
  scenes: SceneItem[];
  onRegenerate: (scene: SceneItem, newPrompt?: string) => void;
  onUpload: (scene: SceneItem, file: File) => void;
  disabled?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 60; // render 60 scenes at a time

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryboardGrid({
  scenes,
  onRegenerate,
  onUpload,
  disabled,
}: StoryboardGridProps) {
  const [page, setPage] = useState(0);

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = scenes.length;
    const imageReady = scenes.filter(
      (s) => s.status === 'IMAGE_READY' || s.status === 'GENERATING_MOTION' || s.status === 'MOTION_READY'
    ).length;
    const motionReady = scenes.filter((s) => s.status === 'MOTION_READY').length;
    const failed = scenes.filter((s) => s.status === 'FAILED').length;
    const generating = scenes.filter(
      (s) => s.status === 'GENERATING_IMAGE' || s.status === 'GENERATING_MOTION'
    ).length;

    const imagePercent = total > 0 ? Math.round((imageReady / total) * 100) : 0;
    const motionPercent = total > 0 ? Math.round((motionReady / total) * 100) : 0;

    return { total, imageReady, motionReady, failed, generating, imagePercent, motionPercent };
  }, [scenes]);

  // ─── Pagination ──────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(scenes.length / PAGE_SIZE);
  const visibleScenes = scenes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center mb-4">
          <Images size={28} className="text-slate-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-400 mb-1">No scenes yet</h3>
        <p className="text-sm text-slate-600 max-w-xs">
          Generate scenes from your script to populate the storyboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Progress Header ─────────────────────────────────────────────────── */}
      <div className="bg-bg-surface border border-bg-border rounded-xl p-4 space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-6 text-xs text-slate-400 flex-wrap">
          <StatBadge
            icon={<Images size={12} className="text-emerald-400" />}
            label={`${stats.imageReady} / ${stats.total} Images Ready`}
            color="emerald"
          />
          <StatBadge
            icon={<Video size={12} className="text-cyan-400" />}
            label={`${stats.motionReady} Motion Clips Rendered`}
            color="cyan"
          />
          {stats.failed > 0 && (
            <StatBadge
              icon={<CheckCircle2 size={12} className="text-red-400" />}
              label={`${stats.failed} Failed`}
              color="red"
            />
          )}
          {stats.generating > 0 && (
            <StatBadge
              icon={<Clock size={12} className="text-blue-400" />}
              label={`${stats.generating} Generating…`}
              color="blue"
            />
          )}
        </div>

        {/* Image progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>Images</span>
            <span>{stats.imagePercent}%</span>
          </div>
          <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${stats.imagePercent}%` }}
            />
          </div>
        </div>

        {/* Motion progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>Motion Clips</span>
            <span>{stats.motionPercent}%</span>
          </div>
          <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-700 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${stats.motionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Scene Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {visibleScenes.map((scene) => (
          <SceneCard
            key={scene.sceneId}
            scene={scene}
            onRegenerate={onRegenerate}
            onUpload={onUpload}
            disabled={disabled}
          />
        ))}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <ChevronUp size={13} />
            Previous {PAGE_SIZE}
          </button>
          <span className="text-xs text-slate-500">
            Page {page + 1} / {totalPages} · Scenes {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, scenes.length)}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
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

// ─── Stat Badge ───────────────────────────────────────────────────────────────

function StatBadge({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'emerald' | 'cyan' | 'red' | 'blue';
}) {
  const colorMap = {
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  return (
    <span className={`flex items-center gap-1.5 ${colorMap[color]}`}>
      {icon}
      <span className="text-slate-300">{label}</span>
    </span>
  );
}
