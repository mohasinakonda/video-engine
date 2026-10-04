'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

export function ScriptIntelligenceCard() {
  const { packaging } = useLaunchKit();

  if (!packaging?.scriptIntelligence) return null;
  const { scriptIntelligence } = packaging;

  return (
    <div className="card p-5 bg-zinc-900 border-zinc-800 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 ">
          <BookOpen size={16} className="text-blue-400 shrink-0" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Script Intelligence &amp; Subject Analysis
          </h3>
        </div>
        <span className="text-[10px] text-zinc-400 font-mono">
          Target: {scriptIntelligence.targetAudience}
        </span>
      </div>

      {/* Core Topic Box */}
      <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
          Core Subject (মূল বিষয়বস্তু)
        </span>
        <p className="text-xs font-semibold text-white leading-relaxed">
          {scriptIntelligence.coreTopic}
        </p>
        <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
          {scriptIntelligence.narrativeSummary}
        </p>
      </div>

      {/* Key Highlights / Talking Points */}
      {scriptIntelligence.keyTalkingPoints && scriptIntelligence.keyTalkingPoints.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
            Key Discussion Points (মূল আলোচ্য বিষয়)
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
    </div>
  );
}
