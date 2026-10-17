'use client';

import React, { useState } from 'react';
import {
  Flame,
  Loader2,
  Sparkles,
  BookOpen,
  Check,
  Save,
  Target,
  Monitor,
  Cpu,
  Zap,
} from 'lucide-react';
import { useLaunchKit, THUMBNAIL_FRAMES, type ThumbnailAspect } from '../launch-kit-context';
import CharCounter from '@/components/char-counter';
import { TEXT_LIMITS } from '@/lib/input-limits';

export function ScriptInputCard() {
  const {
    project,
    packaging,
    voiceScript,
    setVoiceScript,
    isScriptSaved,
    handleSaveScriptOnly,
    scriptWordCount,
    scriptCharCount,
    scriptCharLimit,
    nextScriptTier,
    scriptTooLong,
    customFocus,
    setCustomFocus,
    isGenerating,
    handleGeneratePackaging,
    thumbAspect,
    canChangeThumbAspect,
    handleChangeThumbAspect,
  } = useLaunchKit();

  const [expanded, setExpanded] = useState(false);

  // Once a kit exists, collapse the input into a one-line summary so results get the space.
  if (packaging && !expanded && !isGenerating) {
    return (
      <div className="card px-4 py-3 bg-bg-surface border-bg-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen size={15} className="text-zinc-400 flex-shrink-0" />
          <span className="text-sm text-zinc-200 font-medium">Script</span>
          <span className="text-xs text-zinc-500 font-mono">{scriptWordCount} words</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg bg-bg-elevated border border-bg-border hover:border-bg-border-strong transition-colors"
          >
            Edit script
          </button>
          <button
            type="button"
            onClick={handleGeneratePackaging}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 font-semibold"
          >
            <Sparkles size={13} className="text-zinc-950" />
            <span>Regenerate Launch Kit</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 bg-bg-surface border-bg-border space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Flame size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>YouTube Packaging &amp; Launch Studio</span>

            </h2>
            <p className="text-xs text-zinc-400">
              Turns your script into titles, thumbnails, a description and tags
            </p>
          </div>
        </div>

        {/* Master Actions: Credits Counter + Master Generate Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">


          <button
            type="button"
            onClick={handleGeneratePackaging}
            disabled={isGenerating || scriptTooLong}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-bold flex-shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>AI Analyzing Script (8-12s)...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-zinc-950" />
                <span>{packaging ? 'Regenerate Launch Kit' : 'Analyze Script & Launch Kit'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Voice Script Input Box */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-white flex items-center gap-1.5">
            <BookOpen size={14} className="text-zinc-300" />
            <span>Voiceover Narration Script</span>
          </label>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-mono ${scriptTooLong ? 'text-rose-400' : 'text-zinc-400'}`}>
              {scriptWordCount} words · {scriptCharCount.toLocaleString()} chars
            </span>
            {packaging && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Collapse
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveScriptOnly}
              className="text-xxs font-bold text-white flex items-center gap-1 transition-colors"
              title="Save script edits to project manifest"
            >
              {isScriptSaved ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Saved</span>
                </>
              ) : (
                <>
                  <Save size={12} />
                  <span>Save Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          rows={6}
          value={voiceScript}
          onChange={(e) => setVoiceScript(e.target.value)}
          placeholder="Paste or write your full voiceover script here. The AI will analyze this exact text to evaluate retention risk, generate high-CTR titles, and build style-matched thumbnails."
          className="input text-xs font-mono leading-relaxed bg-zinc-950/80 border-zinc-800 focus:border-zinc-500 text-zinc-200 resize-y min-h-[110px]"
        />
        <CharCounter length={scriptCharCount} limit={scriptCharLimit} upgrade={nextScriptTier} />
      </div>

      {/* Custom Direction & Style Meta Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-xxs font-semibold text-zinc-300 flex items-center gap-1">
            <Target size={12} className="text-zinc-300" />
            <span>Custom Angle / Director Note (Optional)</span>
          </label>
          <input
            type="text"
            value={customFocus}
            maxLength={TEXT_LIMITS.customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            placeholder="e.g. Focus on ancient ocean giants, emphasize the 1997 anomaly..."
            className="input text-xs bg-zinc-950/80 border-zinc-800 text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
            <Monitor size={12} className="text-zinc-300" />
            <span>Thumbnail Frame</span>
          </label>
          {canChangeThumbAspect ? (
            <select
              value={thumbAspect}
              onChange={(e) => handleChangeThumbAspect(e.target.value as ThumbnailAspect)}
              className="input text-xs bg-zinc-950/80 border-zinc-800 text-white cursor-pointer"
            >
              {(Object.keys(THUMBNAIL_FRAMES) as ThumbnailAspect[]).map((aspect) => {
                const frame = THUMBNAIL_FRAMES[aspect];
                return (
                  <option key={aspect} value={aspect}>
                    {aspect} · {frame.label}
                  </option>
                );
              })}
            </select>
          ) : (
            <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
              <span>{THUMBNAIL_FRAMES[thumbAspect].label}</span>
              <span className="font-mono text-white text-2xs bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                {thumbAspect}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
