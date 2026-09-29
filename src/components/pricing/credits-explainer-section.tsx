'use client';

import React from 'react';
import { Film, Mic, Sliders, Award } from 'lucide-react';

export function CreditsExplainerSection() {
  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="text-center max-w-2xl mx-auto mb-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          100% Transparent Credit Accounting
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-white mt-2.5">
          How Are Credits Used? Zero Hidden Fees
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Know exactly how much each complete video costs before you start creating
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
              <Film size={18} />
            </div>
            <h4 className="text-sm font-bold text-white">1 Credit = 1 Scene Image</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Each newly generated AI image costs exactly 1 credit.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-850 text-[10px] text-amber-400/90 font-semibold">
            ~10–12 credits = 1-min Reel
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              <Mic size={18} />
            </div>
            <h4 className="text-sm font-bold text-white">Free AI Voiceovers</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Natural AI voice narration (Bangla, English & 30+ accents) is 100% free.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-850 text-[10px] text-emerald-400/90 font-semibold">
            0 extra credits for audio
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
              <Sliders size={18} />
            </div>
            <h4 className="text-sm font-bold text-white">AI Director & Scripts</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Automatic script-to-scenes breakdown and prompt expansion are free.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-850 text-[10px] text-blue-400/90 font-semibold">
            Unlimited Storyboard AI
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
              <Award size={18} />
            </div>
            <h4 className="text-sm font-bold text-white">Free 1080p/4K Exports</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Rendering and downloading final MP4 videos cost zero credits.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-850 text-[10px] text-purple-400/90 font-semibold">
            Zero Watermarks
          </div>
        </div>
      </div>
    </div>
  );
}
