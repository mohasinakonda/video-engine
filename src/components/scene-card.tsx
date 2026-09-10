'use client';

import { useState, useRef } from 'react';
import {
  RefreshCw,
  Upload,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  Video,
  ImageIcon,
} from 'lucide-react';
import type { SceneItem, MotionProfile } from '@/types';

// ─── Motion Profile Labels ─────────────────────────────────────────────────────

const MOTION_LABELS: Record<MotionProfile, { label: string; icon: React.ReactNode }> = {
  zoom_in: { label: 'Zoom In', icon: <ZoomIn size={9} /> },
  zoom_out: { label: 'Zoom Out', icon: <ZoomOut size={9} /> },
  pan_left: { label: 'Pan Left', icon: <ArrowLeft size={9} /> },
  pan_right: { label: 'Pan Right', icon: <ArrowRight size={9} /> },
};

// ─── Status Colors ─────────────────────────────────────────────────────────────

function statusClass(status: SceneItem['status']): string {
  switch (status) {
    case 'PENDING': return 'bg-slate-800 text-slate-400 border-slate-700';
    case 'GENERATING_IMAGE': return 'bg-blue-950/80 text-blue-400 border-blue-800/50';
    case 'IMAGE_READY': return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50';
    case 'GENERATING_MOTION': return 'bg-violet-950/80 text-violet-400 border-violet-800/50';
    case 'MOTION_READY': return 'bg-cyan-950/80 text-cyan-400 border-cyan-800/50';
    case 'FAILED': return 'bg-red-950/80 text-red-400 border-red-800/50';
    default: return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

function statusLabel(status: SceneItem['status']): string {
  switch (status) {
    case 'PENDING': return 'Pending';
    case 'GENERATING_IMAGE': return 'Generating…';
    case 'IMAGE_READY': return 'Image Ready';
    case 'GENERATING_MOTION': return 'Animating…';
    case 'MOTION_READY': return 'Motion Ready';
    case 'FAILED': return 'Failed';
    default: return status;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SceneCardProps {
  scene: SceneItem;
  onRegenerate: (scene: SceneItem, newPrompt?: string) => void;
  onUpload: (scene: SceneItem, file: File) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SceneCard({ scene, onRegenerate, onUpload, disabled }: SceneCardProps) {
  const [hovering, setHovering] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(scene.visualPrompt);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGenerating =
    scene.status === 'GENERATING_IMAGE' || scene.status === 'GENERATING_MOTION';

  const duration = (scene.audioEndSec - scene.audioStartSec).toFixed(1);
  const timeRange = `${scene.audioStartSec.toFixed(1)}s – ${scene.audioEndSec.toFixed(1)}s`;

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(scene, file);
      e.target.value = '';
    }
  }

  function handleRegenerate() {
    if (editingPrompt) {
      setEditingPrompt(false);
      onRegenerate({ ...scene, visualPrompt: promptDraft }, promptDraft);
    } else {
      onRegenerate(scene);
    }
  }

  return (
    <div
      className={`relative group rounded-xl border overflow-hidden transition-all duration-200
        ${hovering ? 'border-accent-purple/40 shadow-lg shadow-purple-900/20' : 'border-bg-border'}
        ${isGenerating ? 'animate-pulse-border' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); if (editingPrompt) setEditingPrompt(false); }}
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        {scene.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={scene.imageUrl}
            alt={`Scene ${scene.sceneId}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={20} className="text-accent-purple animate-spin" />
                <p className="text-[10px] text-slate-500">
                  {scene.status === 'GENERATING_IMAGE' ? 'Generating image…' : 'Animating…'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-700">
                <ImageIcon size={20} />
                <p className="text-[10px]">No image</p>
              </div>
            )}
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white">
          #{scene.sceneId}
        </div>

        {/* Motion profile badge */}
        {scene.motionProfile && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-medium text-cyan-300">
            {MOTION_LABELS[scene.motionProfile].icon}
            {MOTION_LABELS[scene.motionProfile].label}
          </div>
        )}

        {/* Motion Ready icon */}
        {scene.status === 'MOTION_READY' && (
          <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Video size={11} className="text-cyan-400" />
          </div>
        )}

        {/* Hover overlay */}
        {hovering && !isGenerating && !disabled && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center gap-2 animate-fade-in">
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-purple/80 text-white text-[11px] font-medium hover:bg-accent-purple transition-colors"
              title="Regenerate image"
            >
              <RefreshCw size={11} />
              Regen
            </button>
            <button
              onClick={() => { setEditingPrompt(true); setPromptDraft(scene.visualPrompt); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-elevated/90 text-slate-300 text-[11px] font-medium hover:text-white transition-colors"
              title="Edit prompt"
            >
              <Edit2 size={11} />
              Edit
            </button>
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-elevated/90 text-slate-300 text-[11px] font-medium hover:text-white transition-colors"
              title="Upload replacement image"
            >
              <Upload size={11} />
              Upload
            </button>
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-2.5 space-y-1.5">
        {/* Time range + duration + status */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500 font-mono">{timeRange} · {duration}s</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${statusClass(scene.status)}`}>
            {isGenerating && <Loader2 size={8} className="animate-spin" />}
            {statusLabel(scene.status)}
          </span>
        </div>

        {/* Narration line */}
        {editingPrompt ? (
          <div className="space-y-1.5 animate-fade-in">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Visual Prompt</p>
            <textarea
              className="textarea text-[11px] h-16"
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleRegenerate}
                disabled={!promptDraft.trim()}
                className="flex-1 btn-primary text-[11px] py-1 justify-center"
              >
                <RefreshCw size={10} />
                Regenerate
              </button>
              <button
                onClick={() => setEditingPrompt(false)}
                className="btn-ghost text-[11px] py-1 px-2"
              >
                <X size={10} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
            {scene.narrationLine || scene.visualPrompt}
          </p>
        )}

        {/* Error message */}
        {scene.error && scene.status === 'FAILED' && (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-950/40 border border-red-800/30 animate-fade-in">
            <AlertTriangle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-400 line-clamp-2">{scene.error}</p>
          </div>
        )}

        {/* Retry info */}
        {scene.error && isGenerating && (
          <p className="text-[10px] text-amber-500/80">{scene.error}</p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
