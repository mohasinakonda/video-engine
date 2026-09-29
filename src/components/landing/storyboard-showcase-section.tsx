'use client'
import React, { useState } from 'react';
import {
  Check,
  Film,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { FEATURED_STYLES } from './types-and-data';


export const StoryboardShowcaseSection = () => {
  const [activeSceneTab, setActiveSceneTab] = useState(1);
  return (
    <section id="storyboard" className="py-24 px-6 border-b border-[#2e2e2e] bg-[#09090b]">
      <div className="max-w-7xl mx-auto rounded-3xl bg-zinc-900/50 border border-[#2e2e2e] p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

          {/* Left Control Checklist */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Full Control
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Make every scene yours.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Regenerate images, adjust duration, change the narration, add animations, and more. You&apos;re always in control.
            </p>

            <div className="space-y-3 pt-2">
              {[
                'Regenerate any image with one click',
                'Adjust scene duration with precision slider',
                'Add Ken Burns camera animations (Pan, Zoom, Tilt)',
                'Change narration & voice preset on the fly',
                'Reorder scenes with drag-and-drop ease',
                'Apply visual style consistency lock',
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-zinc-200">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={11} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Storyboard Mockup */}
          <div className="lg:col-span-7 bg-zinc-950 rounded-2xl border border-[#2e2e2e] overflow-hidden shadow-2xl">

            {/* Storyboard Header */}
            <div className="px-4 py-3 border-b border-[#2e2e2e] flex items-center justify-between bg-zinc-900/60">
              <span className="text-xs font-mono font-bold text-zinc-200 flex items-center gap-2">
                <Film size={14} className="text-emerald-400" />
                Storyboard Editor
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Scene 02 of 06</span>
            </div>

            {/* Storyboard Workspace */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-4">

              {/* Visual Viewport */}
              <div className="sm:col-span-7 relative rounded-xl overflow-hidden aspect-video border border-[#2e2e2e] bg-zinc-900">
                <img
                  src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80"
                  alt="Active Scene Viewport"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-white">
                  Preview: Ken Burns Slow Zoom
                </div>
              </div>

              {/* Scene Settings Sidebar */}
              <div className="sm:col-span-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[11px] font-mono font-bold uppercase text-zinc-400 block border-b border-[#2e2e2e] pb-1">
                    Scene Settings
                  </span>

                  {/* Duration Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-zinc-300">
                      <span>Duration</span>
                      <span className="text-emerald-400 font-bold">6.0s</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full relative">
                      <div className="w-3/5 h-full bg-emerald-400 rounded-full" />
                    </div>
                  </div>

                  {/* Camera Animation Selector */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-zinc-300">Camera Motion</span>
                    <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-[#2e2e2e] text-xs font-mono text-zinc-200 flex items-center justify-between">
                      <span>Slow Zoom In</span>
                      <ChevronRight size={12} className="text-zinc-500" />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-[#2e2e2e]">
                  <button className="w-full py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-white font-medium text-xs flex items-center justify-center gap-2 border border-[#2e2e2e] transition-colors">
                    <RefreshCw size={12} className="text-emerald-400" />
                    <span>Regenerate Image</span>
                  </button>
                  <button className="w-full py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs transition-colors">
                    More options...
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Scrubber Strip */}
            <div className="p-3 border-t border-[#2e2e2e] bg-zinc-900/40 grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  onClick={() => setActiveSceneTab(i)}
                  className={`cursor-pointer rounded-lg overflow-hidden aspect-video border transition-all ${activeSceneTab === i
                    ? 'border-emerald-400 ring-2 ring-emerald-500/20'
                    : 'border-[#2e2e2e] opacity-60 hover:opacity-100'
                    }`}
                >
                  <img
                    src={FEATURED_STYLES[0].images[(i - 1) % FEATURED_STYLES[0].images.length].url}
                    alt={`Scene frame ${i}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
