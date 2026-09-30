'use client';

import React from 'react';
import { Sparkles, Search, Palette, TrendingUp } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

export function EmptyState() {
  const { packaging, isGenerating, errorMessage, stylePreset } = useLaunchKit();

  if (packaging || isGenerating || errorMessage) return null;

  return (
    <div className="card p-10 text-center border-dashed border-zinc-800 bg-zinc-900/40 space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-300">
        <Sparkles size={24} className="text-amber-400" />
      </div>
      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="text-sm font-bold text-white">Ready to Package Your Video</h3>
        <p className="text-xs text-zinc-400">
          Review your voice script above and click &quot;Analyze Script &amp; Generate Kit&quot;. The AI will extract the subject, search YouTube competitor packaging, craft 5 viral titles, and design style-consistent thumbnails.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-850 border border-zinc-750 text-zinc-300 flex items-center gap-1.5">
          <Search size={12} className="text-red-400" /> YouTube Market Search
        </span>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-850 border border-zinc-750 text-zinc-300 flex items-center gap-1.5">
          <Palette size={12} className="text-purple-400" /> Matches {stylePreset?.name || 'Cinematic'}
        </span>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-850 border border-zinc-750 text-zinc-300 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-emerald-400" /> High-CTR Viral Titles
        </span>
      </div>
    </div>
  );
}
