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
    <section id="storyboard" className="py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto rounded-3xl bg-white border border-[#E5E0D8] p-6 sm:p-10 shadow-xl shadow-zinc-950/[0.03]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

          {/* Left Control Checklist */}
          <div className="lg:col-span-5 space-y-6">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              STORYBOARD EDITOR
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
              Make every scene yours.
            </h2>
            <p className="text-zinc-600 text-sm leading-relaxed">
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
                <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-zinc-700">
                  <div className="w-4 h-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check size={11} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Storyboard Mockup */}
          <div className="lg:col-span-7 bg-[#FAF8F5] rounded-2xl border border-[#E5E0D8] overflow-hidden shadow-md">

            {/* Storyboard Header */}
            <div className="px-4 py-3 border-b border-[#E5E0D8] flex items-center justify-between bg-[#F4F0EA]">
              <span className="text-xs font-mono font-bold text-zinc-900 flex items-center gap-2">
                <Film size={14} className="text-emerald-700" />
                Storyboard Editor
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Scene 02 of 06</span>
            </div>

            {/* Storyboard Workspace */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-4">

              {/* Visual Viewport */}
              <div className="sm:col-span-7 relative rounded-xl overflow-hidden aspect-video border border-[#E5E0D8] bg-zinc-100 shadow-sm">
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
                  <span className="text-[11px] font-mono font-bold uppercase text-zinc-700 block border-b border-[#E5E0D8] pb-1">
                    Scene Settings
                  </span>

                  {/* Duration Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-zinc-700">
                      <span>Duration</span>
                      <span className="text-emerald-700 font-bold">6.0s</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-200 rounded-full relative">
                      <div className="w-3/5 h-full bg-[#E05A30] rounded-full" />
                    </div>
                  </div>

                  {/* Camera Animation Selector */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-zinc-700">Camera Motion</span>
                    <div className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E0D8] text-xs font-mono text-zinc-800 flex items-center justify-between shadow-xs">
                      <span>Slow Zoom In</span>
                      <ChevronRight size={12} className="text-zinc-400" />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-[#E5E0D8]">
                  <button className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors">
                    <RefreshCw size={12} className="text-[#E05A30]" />
                    <span>Regenerate Image</span>
                  </button>
                  <button className="w-full py-1.5 rounded-xl text-zinc-500 hover:text-zinc-800 text-xs transition-colors">
                    More options...
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Scrubber Strip */}
            <div className="p-3 border-t border-[#E5E0D8] bg-[#F7F5F0] grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  onClick={() => setActiveSceneTab(i)}
                  className={`cursor-pointer rounded-lg overflow-hidden aspect-video border transition-all ${activeSceneTab === i
                    ? 'border-[#E05A30] ring-2 ring-[#E05A30]/30 shadow-xs'
                    : 'border-[#E5E0D8] opacity-70 hover:opacity-100'
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
