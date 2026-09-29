import React from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Play,
} from 'lucide-react';

export const SceneBuilderSection: React.FC = () => {
  return (
    <section id="scene-builder" className="py-24 px-6 border-b border-[#2e2e2e] bg-[#09090b]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* Left Text */}
        <div className="lg:col-span-5 space-y-6">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
            AI Scene Builder
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Your narration <br />
            drives the visuals.
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            The AI analyzes your script, breaks it into structured scenes, and generates visuals that match the exact tone, context, and emotion of your story.
          </p>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white border border-[#2e2e2e] transition-colors"
            >
              <span>See it in action</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Right UI Mockup */}
        <div className="lg:col-span-7 bg-zinc-950 rounded-2xl border border-[#2e2e2e] p-5 space-y-5 shadow-2xl">
          {/* Top: Narration line */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Your narration</span>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-[#2e2e2e] text-xs text-zinc-300 leading-relaxed font-mono">
              &ldquo;After decades of research, scientists finally discovered a clean way to harness infinite energy.&rdquo;
            </div>
          </div>

          {/* Middle: AI Scene Plan table */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">AI Scene Plan</span>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-[#2e2e2e] flex flex-col justify-between">
                <span className="text-zinc-400 text-[10px]">01 Opening</span>
                <span className="text-white font-medium">0:00 - 0:05</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-[#2e2e2e] flex flex-col justify-between">
                <span className="text-zinc-400 text-[10px]">02 Discovery</span>
                <span className="text-white font-medium">0:05 - 0:12</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-[#2e2e2e] flex flex-col justify-between">
                <span className="text-zinc-400 text-[10px]">03 The Breakthrough</span>
                <span className="text-white font-medium">0:12 - 0:19</span>
              </div>
            </div>
          </div>

          {/* Bottom: Generated Scene Strip */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Generated Scenes</span>
              <span className="text-emerald-400">4 frames rendered</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="relative rounded-lg overflow-hidden aspect-video border border-[#2e2e2e] group">
                <img
                  src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=75"
                  alt="Scene 1"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-black/80 text-zinc-200">7s</span>
              </div>
              <div className="relative rounded-lg overflow-hidden aspect-video border border-[#2e2e2e] group">
                <img
                  src="https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=75"
                  alt="Scene 2"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-black/80 text-zinc-200">7s</span>
              </div>
              <div className="relative rounded-lg overflow-hidden aspect-video border border-[#2e2e2e] group">
                <img
                  src="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&q=75"
                  alt="Scene 3"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-black/80 text-zinc-200">6s</span>
              </div>
              <div className="relative rounded-lg overflow-hidden aspect-video border border-[#2e2e2e] group">
                <img
                  src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=75"
                  alt="Scene 4"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 rounded bg-black/80 text-zinc-200">7s</span>
              </div>
            </div>

            {/* Scrubber timeline */}
            <div className="flex items-center gap-3 pt-2 text-[10px] font-mono text-zinc-400">
              <Play size={12} className="fill-zinc-400 cursor-pointer hover:fill-white" />
              <span>02:08 / 05:10</span>
              <div className="flex-1 h-1 bg-zinc-800 rounded-full relative">
                <div className="w-1/3 h-full bg-emerald-400 rounded-full" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
