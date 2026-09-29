'use client'
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,

} from 'lucide-react';
import { FEATURED_STYLES } from './types-and-data';



export const HeroSection = () => {
  const router = useRouter();
  const [userScriptInput, setUserScriptInput] = useState('');

  const handleStartWithScript = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = userScriptInput.trim();
    if (typeof window !== 'undefined' && trimmed) {
      localStorage.setItem('pending_script', trimmed);
    }
    const targetUrl = trimmed
      ? `/project/new?script=${encodeURIComponent(trimmed)}`
      : '/project/new';
    router.push(targetUrl);
  };

  return (
    <section className="relative pt-16 sm:pt-20 pb-20 sm:pb-24 px-6 border-b border-[#2e2e2e]">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-white/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

          {/* Left Column (7 cols): Value Prop & Interactive Script Input */}
          <div className="lg:col-span-7 space-y-6 text-left">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              From script <br />
              <span className="text-zinc-400 font-medium">to finished video.</span>
            </h1>

            {/* Interactive Script Input Box */}
            <form onSubmit={handleStartWithScript} className="pt-1">
              <div className="relative rounded-2xl bg-zinc-900/80 border border-[#2e2e2e] hover:border-zinc-700/80 focus-within:border-zinc-500 transition-all p-4 sm:p-5 flex flex-col justify-between shadow-2xl shadow-black/70 backdrop-blur-sm">
                <textarea
                  rows={3}
                  maxLength={2700}
                  value={userScriptInput}
                  onChange={(e) => setUserScriptInput(e.target.value)}
                  placeholder="Paste your script or video idea here..."
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-sans leading-relaxed"
                />



                {/* Footer bar with counter & CTA */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#2e2e2e]/50">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {userScriptInput.length}/2700
                  </span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#ff7a45] hover:bg-[#ff8c5a] text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-[#ff7a45]/20 active:scale-95"
                  >
                    <span>Create video</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </form>

            {/* Trust Badges */}
            <div className="pt-1 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-400" /> 1080p MP4 Export
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-400" /> Zero Watermarks
              </span>

              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-400" /> 30 Free Credits
              </span>
            </div>
          </div>

          {/* Right Column (5 cols): Dynamic Multi-Scene Visual Fan (Design A) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center pt-4 lg:pt-0">
            <div className="relative flex items-center justify-center py-6">
              {/* Card 1 (Far Left) */}
              <div className="w-16 h-28 sm:w-20 sm:h-36 md:w-24 md:h-40 rounded-2xl overflow-hidden -rotate-6 opacity-100 shadow-xl -mr-6 sm:-mr-8 shrink-0 border border-zinc-800 bg-zinc-900 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[3].url}
                  alt="Scene preview 1"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 2 (Mid Left) */}
              <div className="w-20 h-36 sm:w-24 sm:h-44 md:w-28 md:h-48 rounded-2xl overflow-hidden -rotate-3 opacity-100 shadow-2xl -mr-5 sm:-mr-6 shrink-0 z-10 border border-zinc-700/80 bg-zinc-900 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[1].url}
                  alt="Scene preview 2"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 3 (Center Hero) */}
              <div className="w-24 h-44 sm:w-32 sm:h-56 md:w-36 md:h-60 rounded-2xl overflow-hidden shadow-2xl shrink-0 z-20 border border-zinc-500/80 bg-zinc-900 ring-2 ring-white/10 scale-105 transition-transform duration-300 hover:scale-110">
                <img
                  src={FEATURED_STYLES[0].images[0].url}
                  alt="Scene preview center"
                  className="w-full h-full object-cover"
                />

              </div>

              {/* Card 4 (Mid Right) */}
              <div className="w-20 h-36 sm:w-24 sm:h-44 md:w-28 md:h-48 rounded-2xl overflow-hidden rotate-3 opacity-100 shadow-2xl -ml-5 sm:-ml-6 shrink-0 z-10 border border-zinc-700/80 bg-zinc-900 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[4].url}
                  alt="Scene preview 4"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 5 (Far Right) */}
              <div className="w-16 h-28 sm:w-20 sm:h-36 md:w-24 md:h-40 rounded-2xl overflow-hidden rotate-6 opacity-100 shadow-xl -ml-6 sm:-ml-8 shrink-0 border border-zinc-800 bg-zinc-900 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[2].url}
                  alt="Scene preview 5"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Stage Indicator Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#2e2e2e] bg-zinc-900/90 text-xs font-mono text-zinc-300 tracking-wider shadow-lg">
              <span>Ideas</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="text-emerald-400">Scenes</span>
              <span className="text-zinc-600">&rarr;</span>
              <span className="text-orange-400">Videos</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
