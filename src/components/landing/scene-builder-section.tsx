import React from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Play,
} from 'lucide-react';
import { LANDING_SECTION_IMAGES } from './types-and-data';

export const SceneBuilderSection: React.FC = () => {
  return (
    <section id="scene-builder" className="py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* Left Text */}
        <div className="lg:col-span-5 space-y-6">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            AI SCENE BUILDER
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Your narration <br />
            drives the visuals.
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
            The AI analyzes your script, breaks it into structured scenes, and generates visuals that match the exact tone, context, and emotion of your story.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-900 border border-[#E5E0D8] shadow-sm transition-colors"
            >
              <span>See it in action</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Right UI Mockup */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5E0D8] p-5 space-y-5 shadow-xl shadow-zinc-950/[0.04]">
          {/* Top: Narration line */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-zinc-500 uppercase">Your narration</span>
            <div className="p-3 rounded-xl bg-[#F7F5F0] border border-[#E5E0D8] text-xs text-zinc-800 leading-relaxed font-mono">
              &ldquo;After decades of research, scientists finally discovered a clean way to harness infinite energy.&rdquo;
            </div>
          </div>

          {/* Middle: AI Scene Plan table */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase">AI Scene Plan</span>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
                <span className="text-zinc-500 text-[10px]">01 Opening</span>
                <span className="text-zinc-950 font-semibold">0:00 - 0:05</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
                <span className="text-zinc-500 text-[10px]">02 Discovery</span>
                <span className="text-zinc-950 font-semibold">0:05 - 0:12</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E5E0D8] flex flex-col justify-between">
                <span className="text-zinc-500 text-[10px]">03 The Breakthrough</span>
                <span className="text-zinc-950 font-semibold">0:12 - 0:19</span>
              </div>
            </div>
          </div>

          {/* Bottom: Generated Scene Strip */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Generated Scenes</span>
              <span className="text-emerald-700 font-semibold">4 frames rendered</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {LANDING_SECTION_IMAGES.sceneBuilder.map((scene, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden aspect-video border border-[#E5E0D8] group">
                  <img
                    src={scene.url}
                    alt={scene.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-black/70 text-white">
                    {scene.duration}
                  </span>
                </div>
              ))}
            </div>

            {/* Scrubber timeline */}
            <div className="flex items-center gap-3 pt-2 text-[10px] font-mono text-zinc-500">
              <Play size={12} className="fill-zinc-700 text-zinc-700 cursor-pointer hover:fill-zinc-950 hover:text-zinc-950" />
              <span>02:08 / 05:10</span>
              <div className="flex-1 h-1 bg-zinc-200 rounded-full relative">
                <div className="w-1/3 h-full bg-[#E05A30] rounded-full" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
