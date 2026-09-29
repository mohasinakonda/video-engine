'use client';

import React from 'react';
import Link from 'next/link';
import { Palette, ArrowRight } from 'lucide-react';
import type { BaseStylePreset } from '@/types';

interface TemplatesTabProps {
  stylePresets: BaseStylePreset[];
}

export default function TemplatesTab({ stylePresets }: TemplatesTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Palette size={20} className="text-amber-400" />
          Visual Styles & Prompt Templates
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Choose a pre-tested visual style to maintain cinematic consistency across all scenes in your video.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stylePresets.map((preset) => (
          <div
            key={preset.id}
            className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 hover:border-zinc-700 transition-colors flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                  {preset.aspectRatio || '16:9'}
                </span>
                {preset.isDefault && (
                  <span className="text-[10px] text-zinc-400 font-semibold bg-zinc-800 px-2 py-0.5 rounded">
                    Default Preset
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base text-white">{preset.name}</h3>
              <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                {preset.stylePrompt}
              </p>
            </div>

            <Link
              href="/project/new"
              className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-white hover:text-zinc-950 text-zinc-200 font-bold text-xs text-center transition-all flex items-center justify-center gap-1.5"
            >
              <span>Create Video with This Style</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
