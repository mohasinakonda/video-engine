'use client';

import React from 'react';
import { Edit2, X, Loader2, Wand2, RefreshCw } from 'lucide-react';
import PromptModifierChips from './prompt-modifier-chips';

interface ScenePromptEditorOverlayProps {
  sceneId: number;
  promptDraft: string;
  setPromptDraft: (val: string) => void;
  isEnhancingPrompt: boolean;
  isGenerating: boolean;
  isSubmittingRegenerate: boolean;
  disabled?: boolean;
  onEnhancePrompt: () => void;
  onAppendModifier: (modifierText: string) => void;
  onRegenerate: () => void;
  onClose: () => void;
}

export default function ScenePromptEditorOverlay({
  sceneId,
  promptDraft,
  setPromptDraft,
  isEnhancingPrompt,
  isGenerating,
  isSubmittingRegenerate,
  disabled,
  onEnhancePrompt,
  onAppendModifier,
  onRegenerate,
  onClose,
}: ScenePromptEditorOverlayProps) {
  const isSubmitDisabled =
    !promptDraft.trim() || isGenerating || isSubmittingRegenerate || disabled;

  return (
    <div
      className="absolute inset-0 z-30 bg-zinc-950/92 backdrop-blur-md p-3.5 flex flex-col justify-between animate-fade-in rounded-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Edit2 size={12} className="text-white" />
            <span className="text-[11px] font-semibold text-white">Edit Scene #{sceneId} Prompt</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400">
            Visual Prompt
          </span>
          <button
            type="button"
            onClick={onEnhancePrompt}
            disabled={isEnhancingPrompt}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
            title="Expand into a studio-grade cinematic prompt using AI Director"
          >
            {isEnhancingPrompt ? (
              <Loader2 size={10} className="animate-spin text-cyan-400" />
            ) : (
              <Wand2 size={10} />
            )}
            <span>{isEnhancingPrompt ? 'Enhancing...' : 'Enhance with AI'}</span>
          </button>
        </div>

        <textarea
          className="w-full text-[11px] h-20 leading-relaxed font-mono bg-zinc-900/90 border border-zinc-700/80 rounded-xl p-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          placeholder="Describe scene visual details, camera optics, and lighting..."
          autoFocus
        />

        {/* Reusable Quick Modifier Chips */}
        <PromptModifierChips onAppend={onAppendModifier} size="xs" />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isSubmitDisabled}
          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
        >
          <RefreshCw size={11} className={isSubmittingRegenerate ? 'animate-spin' : ''} />
          <span>Regenerate</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
