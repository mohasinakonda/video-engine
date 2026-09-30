'use client';

import React from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  Edit2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { SceneItem } from '@/types';
import { SHOT_TYPE_CONFIG, getAspectRatioLabel } from './scene-card-constants';
import PromptModifierChips from './prompt-modifier-chips';

interface SceneStudioModalProps {
  scene: SceneItem;
  currentSrc?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  timeRange: string;
  duration: string;
  promptDraft: string;
  setPromptDraft: (val: string) => void;
  isEnhancingPrompt: boolean;
  isGenerating: boolean;
  isSubmittingRegenerate: boolean;
  disabled?: boolean;
  onClose: () => void;
  onUploadClick: () => void;
  onEnhancePrompt: () => void;
  onAppendModifier: (modifierText: string) => void;
  onRegenerate: () => void;
}

export default function SceneStudioModal({
  scene,
  currentSrc,
  aspectRatio = '16:9',
  timeRange,
  duration,
  promptDraft,
  setPromptDraft,
  isEnhancingPrompt,
  isGenerating,
  isSubmittingRegenerate,
  disabled,
  onClose,
  onUploadClick,
  onEnhancePrompt,
  onAppendModifier,
  onRegenerate,
}: SceneStudioModalProps) {
  const imgSrc = currentSrc || scene.imageUrl;
  const shotConfig = scene.shotType ? SHOT_TYPE_CONFIG[scene.shotType] : null;
  const ShotIcon = shotConfig?.icon;
  const isSubmitDisabled =
    !promptDraft.trim() || isGenerating || isSubmittingRegenerate || disabled;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[92vh] bg-bg-surface border border-bg-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border bg-bg-elevated/80 flex-wrap gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold">
              Scene #{scene.sceneId}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {timeRange} ({duration}s)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 text-[10px] font-mono font-bold">
              {getAspectRatioLabel(aspectRatio)}
            </span>
            {shotConfig && ShotIcon && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${shotConfig.badgeColor}`}
              >
                <ShotIcon size={10} />
                {shotConfig.shortLabel} B-Roll
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-zinc-300 hover:text-white"
              title="Upload local image to replace this scene"
            >
              <Upload size={13} className="text-emerald-400" />
              Replace Image
            </button>
            {imgSrc && (
              <a
                href={imgSrc}
                download={`scene_${scene.sceneId}.jpg`}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="Download full resolution image"
              >
                <Download size={13} />
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Split into Image Display & Creative Studio Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-black/95">
          {/* Image Display */}
          <div className="relative flex-1 min-h-[280px] max-h-[50vh] md:max-h-[62vh] flex items-center justify-center p-4 overflow-hidden">
            {imgSrc && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imgSrc}
                alt={`Scene ${scene.sceneId}`}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            )}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
                <Loader2 size={32} className="text-emerald-400 animate-spin" />
                <p className="text-xs font-medium text-zinc-200">
                  Regenerating scene image with Pollinations AI…
                </p>
              </div>
            )}
          </div>

          {/* Creative Editing Panel */}
          <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-bg-border bg-bg-surface flex flex-col overflow-y-auto p-4 space-y-3.5">
            {/* Narration Excerpt */}
            {scene.narrationLine && (
              <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Narration
                </span>
                <p className="text-xs text-zinc-200 leading-relaxed italic">
                  &ldquo;{scene.narrationLine}&rdquo;
                </p>
              </div>
            )}

            {/* Prompt Editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit2 size={11} className="text-emerald-400" />
                  Visual Prompt
                </span>
                <button
                  type="button"
                  onClick={onEnhancePrompt}
                  disabled={isEnhancingPrompt}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isEnhancingPrompt ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Sparkles size={10} />
                  )}
                  {isEnhancingPrompt ? 'Enhancing…' : 'AI Enhance'}
                </button>
              </div>
              <textarea
                rows={4}
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                className="w-full text-xs bg-zinc-900 border border-zinc-700/80 rounded-xl p-2.5 text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors resize-none leading-relaxed"
                placeholder="Enter visual prompt instructions for this scene…"
              />
            </div>

            {/* Quick Modifiers */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Style Modifiers
              </span>
              <PromptModifierChips onAppend={onAppendModifier} size="sm" />
            </div>

            {/* Regenerate Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isSubmitDisabled}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <RefreshCw
                  size={12}
                  className={isGenerating || isSubmittingRegenerate ? 'animate-spin' : ''}
                />
                <span>{isGenerating ? 'Regenerating…' : 'Regenerate Scene Image'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
