'use client';

import React from 'react';
import {
  Flame,
  Sparkles,
  Zap,
  Target,
  Scissors,
  Check,
  Copy,
  Lightbulb,
} from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

export function ScriptIntelligenceCard() {
  const { packaging, copiedKey, handleCopy } = useLaunchKit();

  if (!packaging?.scriptIntelligence) return null;
  const { scriptIntelligence } = packaging;
  const hookScore = scriptIntelligence.hookRetentionScore || 88;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-zinc-800 space-y-4 shadow-xl">
      {/* Header: Title + Audience + Retention Gauge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Zap size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Script Intelligence &amp; Hook Retention</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                AI Diagnostic
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Evaluates viewer retention risk in the critical first 30 seconds
            </p>
          </div>
        </div>

        {/* Retention Score Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-xl border flex items-center gap-2 font-mono ${getScoreColor(
              hookScore
            )}`}
          >
            <Flame size={14} />
            <span className="text-xs font-bold">{hookScore}/100</span>
            <span className="text-[10px] uppercase font-semibold">Retention</span>
          </div>
        </div>
      </div>

      {/* Core Subject & Diagnostic Insight */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Core Topic Box (7 cols) */}
        <div className="md:col-span-7 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
              Core Central Thesis (মূল বিষয়বস্তু)
            </span>
            <p className="text-xs font-bold text-white leading-relaxed mt-1">
              {scriptIntelligence.coreTopic}
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed pt-1.5">
              {scriptIntelligence.narrativeSummary}
            </p>
          </div>

          {/* Emotional Triggers & Viral Angles */}
          <div className="pt-2 border-t border-zinc-850 flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <Target size={11} className="text-amber-400" />
              Target:
            </span>
            <span className="text-[10px] font-medium text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {scriptIntelligence.targetAudience}
            </span>
            {(scriptIntelligence.emotionalTriggers || []).map((t, idx) => (
              <span
                key={idx}
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* 30s Hook Retention Diagnostic (5 cols) */}
        <div className="md:col-span-5 p-3.5 rounded-xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
              <Sparkles size={11} />
              Opening 30s Diagnostic
            </span>
            <p className="text-[11px] text-zinc-300 leading-relaxed mt-1">
              {scriptIntelligence.hookAnalysis ||
                'The script creates immediate tension. Ensure voice delivery hits the emotional climax before the 15-second mark.'}
            </p>
          </div>

          {scriptIntelligence.competitorGap && (
            <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[10px] text-zinc-400">
              <strong className="text-zinc-200">Competitor White Space: </strong>
              {scriptIntelligence.competitorGap}
            </div>
          )}
        </div>
      </div>

      {/* Suggested Power Hook (if present) */}
      {scriptIntelligence.suggestedPowerHook && (
        <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-800/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider flex items-center gap-1.5">
              <Lightbulb size={12} className="text-amber-400" />
              High-Retention Suggested Opening (Power Hook)
            </span>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  scriptIntelligence.suggestedPowerHook || '',
                  'power_hook',
                  'Power Hook'
                )
              }
              className="text-[10px] text-blue-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 transition-colors"
            >
              {copiedKey === 'power_hook' ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy Hook</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs font-mono text-blue-100 leading-relaxed italic">
            &quot;{scriptIntelligence.suggestedPowerHook}&quot;
          </p>
        </div>
      )}

      {/* Key Discussion Points */}
      {scriptIntelligence.keyTalkingPoints && scriptIntelligence.keyTalkingPoints.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Core Narrative Architecture (মূল আলোচ্য বিষয়)
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {scriptIntelligence.keyTalkingPoints.map((pt, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-300 flex items-start gap-2"
              >
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-snug">{pt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shorts Repurposing Radar (if available) */}
      {scriptIntelligence.shortsIdeas && scriptIntelligence.shortsIdeas.length > 0 && (
        <div className="p-3 rounded-xl bg-purple-950/15 border border-purple-800/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider flex items-center gap-1.5">
              <Scissors size={12} className="text-purple-400" />
              Shorts / Reels Repurposing Radar
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              High-virality soundbite cutpoints
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {scriptIntelligence.shortsIdeas.map((sh, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-zinc-950 border border-purple-900/30 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                    ⏱️ {sh.timestamp}
                  </span>
                  <span className="text-[9px] text-zinc-400">Viral Soundbite</span>
                </div>
                <p className="text-white font-semibold line-clamp-2">&quot;{sh.hook}&quot;</p>
                <p className="text-[10px] text-zinc-400">{sh.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
