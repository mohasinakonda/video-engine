'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Smartphone,
  Film,
  Mic2,
} from 'lucide-react';

export default function QuickLaunchSection() {
  return (
    <div className="p-5 rounded-2xl bg-bg-surface border border-bg-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles size={14} className="text-zinc-400" />
          Quick-Launch Creation Presets
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Preset 1: 9:16 Shorts */}
        <Link
          href="/project/new"
          className="p-3.5 rounded-xl bg-bg-elevated border border-bg-border hover:border-bg-border-strong hover:bg-bg-hover transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white">YouTube Shorts / Reels</span>
            </div>
            <p className="text-xxs text-zinc-400 leading-snug">
              9:16 vertical video with dynamic rapid scene cuts & captions.
            </p>
          </div>
          <span className="text-2xs text-zinc-400 group-hover:text-white font-semibold pt-2 flex items-center gap-1 transition-colors">
            Start 9:16 Short &rarr;
          </span>
        </Link>

        {/* Preset 2: 16:9 Documentary */}
        <Link
          href="/project/new"
          className="p-3.5 rounded-xl bg-bg-elevated border border-bg-border hover:border-bg-border-strong hover:bg-bg-hover transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Film size={16} className="text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white">Cinematic Documentary</span>
            </div>
            <p className="text-xxs text-zinc-400 leading-snug">
              16:9 landscape storytelling with deep film grain & slow zooms.
            </p>
          </div>
          <span className="text-2xs text-zinc-400 group-hover:text-white font-semibold pt-2 flex items-center gap-1 transition-colors">
            Start 16:9 Video &rarr;
          </span>
        </Link>

        {/* Preset 3: Voice Studio */}
        <Link
          href="/voice-studio"
          className="p-3.5 rounded-xl bg-bg-elevated border border-bg-border hover:border-bg-border-strong hover:bg-bg-hover transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mic2 size={16} className="text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white">AI Voice Studio</span>
            </div>
            <p className="text-xxs text-zinc-400 leading-snug">
              Synthesize multi-character voiceovers with custom pacing & tone.
            </p>
          </div>
          <span className="text-2xs text-zinc-400 group-hover:text-white font-semibold pt-2 flex items-center gap-1 transition-colors">
            Open Voice Studio &rarr;
          </span>
        </Link>

        {/* Preset 4: AI Script Generator */}
        <Link
          href="/project/new"
          className="p-3.5 rounded-xl bg-bg-elevated border border-bg-border hover:border-bg-border-strong hover:bg-bg-hover transition-all group flex flex-col justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white">AI Script Generator</span>
            </div>
            <p className="text-xxs text-zinc-400 leading-snug">
              Turn ideas, bedtime stories, or facts into structured scenes.
            </p>
          </div>
          <span className="text-2xs text-zinc-400 group-hover:text-white font-semibold pt-2 flex items-center gap-1 transition-colors">
            Generate Script &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
