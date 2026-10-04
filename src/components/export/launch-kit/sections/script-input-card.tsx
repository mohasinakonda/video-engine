'use client';

import React from 'react';
import {
  Flame,
  Loader2,
  Sparkles,
  BookOpen,
  Check,
  Save,
  Target,
  Palette,
  Cpu,
  Zap,
} from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

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
    customFocus,
    setCustomFocus,
    stylePreset,
    isGenerating,
    handleGeneratePackaging,
  } = useLaunchKit();

  return (
    <div className="card p-5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-850 border-zinc-800 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Flame size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>YouTube Packaging &amp; Launch Studio</span>

            </h2>
            <p className="text-xs text-zinc-400">
              Analyzes your full voice script to extract hook diagnostics, viral titles, and FLUX thumbnails
            </p>
          </div>
        </div>

        {/* Master Actions: Credits Counter + Master Generate Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">


          <button
            type="button"
            onClick={handleGeneratePackaging}
            disabled={isGenerating}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all font-bold flex-shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>AI Analyzing Script (8-12s)...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-amber-200" />
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
            <BookOpen size={14} className="text-blue-400" />
            <span>Voiceover Narration Script</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-400">
              {scriptWordCount} words · {scriptCharCount} chars
            </span>
            <button
              type="button"
              onClick={handleSaveScriptOnly}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
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
          className="input text-xs font-mono leading-relaxed bg-zinc-950/80 border-zinc-800 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/40 text-zinc-200 resize-y min-h-[110px]"
        />
      </div>

      {/* Custom Direction & Style Meta Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
            <Target size={12} className="text-amber-400" />
            <span>Custom Angle / Director Note (Optional)</span>
          </label>
          <input
            type="text"
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            placeholder="e.g. Focus on ancient ocean giants, emphasize the 1997 anomaly..."
            className="input text-xs bg-zinc-950/80 border-zinc-800 text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
            <Palette size={12} className="text-purple-400" />
            <span>Project Visual Style &amp; Frame</span>
          </label>
          <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-center justify-between">
            <span className="truncate">{stylePreset?.name || 'Cinematic Documentary'}</span>
            <span className="font-mono text-white text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
              {project.aspectRatio || '16:9'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
