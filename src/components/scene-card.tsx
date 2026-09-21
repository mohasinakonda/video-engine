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
  Download,
  Maximize2,
  Eye,
  Compass,
  Sparkles,
  Users,
  Landmark,
  CloudSun,
  Mountain,
  Film,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import type { SceneItem, MotionProfile, ShotType } from '@/types';
import { generateBRollPrompt } from '@/lib/pollinations';

// ─── Motion Profile Labels ─────────────────────────────────────────────────────

const MOTION_LABELS: Record<MotionProfile, { label: string; icon: React.ReactNode }> = {
  zoom_in: { label: 'Zoom In', icon: <ZoomIn size={9} /> },
  zoom_out: { label: 'Zoom Out', icon: <ZoomOut size={9} /> },
  pan_left: { label: 'Pan Left', icon: <ArrowLeft size={9} /> },
  pan_right: { label: 'Pan Right', icon: <ArrowRight size={9} /> },
};

// ─── Shot Type / B-Roll Metadata ───────────────────────────────────────────────

export const SHOT_TYPE_CONFIG: Record<
  ShotType,
  {
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    badgeColor: string;
  }
> = {
  AERIAL_GEOMETRY: {
    label: 'Drone / Aerial Geometry',
    shortLabel: 'Aerial',
    icon: Compass,
    badgeColor: 'bg-indigo-950/70 text-indigo-300 border-indigo-700/50 hover:bg-indigo-900/60',
  },
  MACRO_TEXTURE: {
    label: 'Macro & Texture Detail',
    shortLabel: 'Macro',
    icon: Sparkles,
    badgeColor: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/60',
  },
  CULTURAL_HUMAN: {
    label: 'Culture & Daily Life',
    shortLabel: 'Culture',
    icon: Users,
    badgeColor: 'bg-amber-950/70 text-amber-300 border-amber-700/50 hover:bg-amber-900/60',
  },
  HISTORICAL_HERITAGE: {
    label: 'History & Heritage',
    shortLabel: 'Heritage',
    icon: Landmark,
    badgeColor: 'bg-violet-950/70 text-violet-300 border-violet-700/50 hover:bg-violet-900/60',
  },
  ATMOSPHERIC_MOOD: {
    label: 'Atmospheric Mood & Light',
    shortLabel: 'Mood',
    icon: CloudSun,
    badgeColor: 'bg-sky-950/70 text-sky-300 border-sky-700/50 hover:bg-sky-900/60',
  },
  WIDE_ESTABLISHING: {
    label: 'Wide Establishing Shot',
    shortLabel: 'Establishing',
    icon: Mountain,
    badgeColor: 'bg-teal-950/70 text-teal-300 border-teal-700/50 hover:bg-teal-900/60',
  },
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
  onUpdateDuration?: (sceneId: number, deltaSec: number) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SceneCard({ scene, onRegenerate, onUpload, onUpdateDuration, disabled }: SceneCardProps) {
  const [hovering, setHovering] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(scene.visualPrompt);
  const [bRollMenuOpen, setBRollMenuOpen] = useState(false);
  const [isSwitchingBRoll, setIsSwitchingBRoll] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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

  async function handleSwitchShotType(targetType: ShotType) {
    setBRollMenuOpen(false);
    setIsSwitchingBRoll(true);
    try {
      const context = scene.narrationLine || scene.visualPrompt;
      const res = await generateBRollPrompt(context, targetType);
      const updatedScene: SceneItem = {
        ...scene,
        shotType: targetType,
        bRollFocus: res.b_roll_focus,
        visualPrompt: res.visual_prompt,
      };
      setPromptDraft(res.visual_prompt);
      onRegenerate(updatedScene, res.visual_prompt);
    } catch (err) {
      console.error('Failed to switch B-Roll perspective:', err);
    } finally {
      setIsSwitchingBRoll(false);
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
      <div
        className={`relative aspect-video bg-bg-elevated overflow-hidden ${scene.imageUrl ? 'cursor-pointer' : ''}`}
        onClick={() => { if (scene.imageUrl && !isGenerating) setPreviewOpen(true); }}
        title={scene.imageUrl ? 'Click to preview image in high resolution' : undefined}
      >
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
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center gap-2 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {scene.imageUrl && (
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600/90 text-white text-[11px] font-medium hover:bg-sky-500 transition-colors shadow-sm"
                title="Preview in high resolution"
              >
                <Maximize2 size={11} />
                View
              </button>
            )}
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
            {scene.imageUrl && (
              <a
                href={scene.imageUrl}
                download={`scene_${scene.sceneId}.jpg`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-700/50 text-cyan-300 text-[11px] font-medium hover:text-white hover:bg-cyan-900 transition-colors"
                title="Download this image"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={11} />
                Save
              </a>
            )}
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-2.5 space-y-1.5">
        {/* Time range + duration + status */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono">{timeRange}</span>
          <div className="flex items-center gap-1.5">
            {onUpdateDuration ? (
              <div className="flex items-center bg-bg-base/90 border border-bg-border/80 rounded px-1 py-0.5 text-[9px] font-mono text-slate-300">
                <button
                  type="button"
                  onClick={() => onUpdateDuration(scene.sceneId, -0.5)}
                  disabled={disabled || parseFloat(duration) <= 1.0}
                  title="Shorten scene length (-0.5s)"
                  className="px-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors font-bold"
                >
                  −
                </button>
                <span className="font-semibold px-0.5 text-purple-300">{duration}s</span>
                <button
                  type="button"
                  onClick={() => onUpdateDuration(scene.sceneId, 0.5)}
                  disabled={disabled || parseFloat(duration) >= 30.0}
                  title="Lengthen scene length (+0.5s)"
                  className="px-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors font-bold"
                >
                  +
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-purple-300/90 font-mono font-medium">{duration}s</span>
            )}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${statusClass(scene.status)}`}>
              {isGenerating && <Loader2 size={8} className="animate-spin" />}
              {statusLabel(scene.status)}
            </span>
          </div>
        </div>

        {/* B-Roll Perspective Badge & Interactive Switcher */}
        <div className="relative">
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setBRollMenuOpen((v) => !v)}
              disabled={disabled || isGenerating || isSwitchingBRoll}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium border transition-all ${
                scene.shotType && SHOT_TYPE_CONFIG[scene.shotType]
                  ? SHOT_TYPE_CONFIG[scene.shotType].badgeColor
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/60'
              }`}
              title="Change B-roll perspective (Drone, Macro, Culture, History, etc.)"
            >
              {isSwitchingBRoll ? (
                <Loader2 size={9} className="animate-spin text-accent-purple" />
              ) : scene.shotType && SHOT_TYPE_CONFIG[scene.shotType] ? (
                <>
                  {(() => {
                    const IconComponent = SHOT_TYPE_CONFIG[scene.shotType!].icon;
                    return <IconComponent size={9} />;
                  })()}
                  <span>{SHOT_TYPE_CONFIG[scene.shotType].shortLabel} B-Roll</span>
                </>
              ) : (
                <>
                  <Film size={9} />
                  <span>B-Roll Cutaway</span>
                </>
              )}
              <ChevronDown size={8} className="opacity-60 ml-0.5" />
            </button>

            {scene.bRollFocus && (
              <span
                className="text-[9px] text-slate-400 truncate max-w-[135px] font-normal"
                title={`B-Roll Motif: ${scene.bRollFocus}`}
              >
                {scene.bRollFocus}
              </span>
            )}
          </div>

          {/* B-Roll Perspective Selector Dropdown */}
          {bRollMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-lg bg-bg-surface border border-bg-border shadow-xl shadow-black/80 p-1 space-y-0.5 animate-fade-in backdrop-blur-md"
              onMouseLeave={() => setBRollMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider border-b border-bg-border/60">
                Switch B-Roll Perspective
              </div>
              {(Object.keys(SHOT_TYPE_CONFIG) as ShotType[]).map((type) => {
                const conf = SHOT_TYPE_CONFIG[type];
                const IconComponent = conf.icon;
                const isSelected = scene.shotType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSwitchShotType(type)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[10px] transition-colors text-left ${
                      isSelected
                        ? 'bg-accent-purple/20 text-white font-medium'
                        : 'text-slate-300 hover:bg-bg-elevated hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <IconComponent size={11} className={isSelected ? 'text-accent-purple' : 'text-slate-400'} />
                      <span>{conf.label}</span>
                    </div>
                    {isSelected && <Check size={10} className="text-accent-purple" />}
                  </button>
                );
              })}
            </div>
          )}
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

      {/* Lightbox Full Preview Modal */}
      {previewOpen && scene.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] bg-bg-surface border border-bg-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border bg-bg-elevated/80">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-accent-purple/20 text-accent-purple text-xs font-bold">
                  Scene #{scene.sceneId}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {timeRange} ({duration}s)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 text-[10px] font-mono font-bold">
                  1920 × 1080 FHD
                </span>
                {scene.shotType && SHOT_TYPE_CONFIG[scene.shotType] && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${SHOT_TYPE_CONFIG[scene.shotType].badgeColor}`}>
                    {(() => {
                      const Icon = SHOT_TYPE_CONFIG[scene.shotType!].icon;
                      return <Icon size={10} />;
                    })()}
                    {SHOT_TYPE_CONFIG[scene.shotType].shortLabel} B-Roll
                  </span>
                )}
                {scene.bRollFocus && (
                  <span className="text-xs text-slate-300 font-medium truncate max-w-xs">
                    · {scene.bRollFocus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={scene.imageUrl}
                  download={`scene_${scene.sceneId}.jpg`}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  title="Download full image"
                >
                  <Download size={13} />
                  Download
                </a>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Image Preview */}
            <div className="relative flex-1 min-h-[350px] max-h-[65vh] bg-black/95 flex items-center justify-center p-3 overflow-hidden">
              <img
                src={scene.imageUrl}
                alt={`Scene ${scene.sceneId}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Footer details */}
            <div className="px-5 py-3 border-t border-bg-border bg-bg-surface space-y-1 text-left">
              {scene.narrationLine && (
                <p className="text-xs text-slate-300">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] mr-1.5">Narration:</span>
                  {scene.narrationLine}
                </p>
              )}
              <p className="text-xs text-slate-400">
                <span className="text-slate-500 font-semibold uppercase text-[10px] mr-1.5">Visual Prompt:</span>
                {scene.visualPrompt}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
