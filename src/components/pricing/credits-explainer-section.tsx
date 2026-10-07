'use client';

import React from 'react';
import { Film, Mic, Sliders, Award } from 'lucide-react';

export function CreditsExplainerSection() {
  return (
    <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="text-center max-w-2xl mx-auto mb-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 bg-[#F4F0EA] border border-[#E5E0D8] px-3 py-1 rounded-full">
          100% Transparent Credit Accounting
        </span>
        <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-950 mt-2.5">
          How Are Credits Used? Zero Hidden Fees
        </h3>
        <p className="text-xs text-zinc-600 mt-1">
          Know exactly how much each complete video costs before you start creating
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-orange-100/60 border border-orange-200/60 text-[#E05A30] flex items-center justify-center font-bold text-sm">
              <Film size={18} />
            </div>
            <h4 className="text-sm font-bold text-zinc-950">2 Credits = 1 AI Image</h4>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Each newly generated HD scene image costs exactly 2 credits (up to 1,000 images on Creator plan).
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#E5E0D8] text-[10px] text-[#E05A30] font-semibold">
            ~20–24 credits = 1-min Reel
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100/60 border border-amber-200/60 text-amber-700 flex items-center justify-center font-bold text-sm">
              <Award size={18} />
            </div>
            <h4 className="text-sm font-bold text-zinc-950">15 Credits = YouTube Kit</h4>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Viral CTR titles, 3 thumbnail prompts, description, tags, and market intelligence cost 15 credits.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#E5E0D8] text-[10px] text-amber-700 font-semibold">
            Complete YouTube SEO & Strategy
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100/60 border border-emerald-200/60 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <Mic size={18} />
            </div>
            <h4 className="text-sm font-bold text-zinc-950">Free AI Voiceovers</h4>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Natural AI voice narration (Bangla, English & 30+ accents) and script breakdown are 100% free.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#E5E0D8] text-[10px] text-emerald-700 font-semibold">
            0 extra credits for audio & scripts
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-100/60 border border-purple-200/60 text-purple-700 flex items-center justify-center font-bold text-sm">
              <Sliders size={18} />
            </div>
            <h4 className="text-sm font-bold text-zinc-950">Free 1080p/4K Exports</h4>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Rendering and downloading final MP4 videos cost zero credits with 100% watermark-free export.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#E5E0D8] text-[10px] text-purple-700 font-semibold">
            Zero Watermarks · 0 Export Fee
          </div>
        </div>
      </div>
    </div>
  );
}
