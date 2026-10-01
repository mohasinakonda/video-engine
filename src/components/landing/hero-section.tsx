'use client'
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Play,
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
    <section className="relative pt-16 sm:pt-20 pb-20 sm:pb-24 px-6 border-b border-[#E5E0D8]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

          {/* Left Column (7 cols): Value Prop & Interactive Script Input */}
          <div className="lg:col-span-7 space-y-6 text-left">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 leading-[1.08]">
              From script <br />
              <span className="text-zinc-500 font-medium">to finished video.</span>
            </h1>

            {/* Interactive Script Input Box */}
            <form onSubmit={handleStartWithScript} className="pt-1">
              <div className="relative rounded-2xl bg-white border border-[#E5E0D8] hover:border-zinc-400/80 focus-within:border-zinc-600 transition-all p-4 sm:p-5 flex flex-col justify-between shadow-xl shadow-zinc-950/[0.03]">
                <textarea
                  rows={5}
                  maxLength={2700}
                  value={userScriptInput}
                  onChange={(e) => setUserScriptInput(e.target.value)}
                  placeholder="Paste your script or video idea here..."
                  className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none font-sans leading-relaxed"
                />

                {/* Footer bar with counter & CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-[#E5E0D8]">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {userScriptInput.length}/2700
                  </span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-md bg-[#E05A30] hover:bg-[#C84C25] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-[#E05A30]/20 active:scale-95"
                  >
                    <span>Create video</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </form>

            {/* Trust Badges */}
            <div className="pt-1 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-zinc-600 font-mono">
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600" /> 1080p MP4 Export
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600" /> Zero Watermarks
              </span>

              <span className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600" /> 30 Free Credits
              </span>
            </div>
          </div>

          {/* Right Column (5 cols): Dynamic Multi-Scene Visual Fan */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center pt-4 lg:pt-0">
            <div className="relative flex items-center justify-center py-6">
              {/* Card 1 (Far Left) */}
              <div className="w-16 h-28 sm:w-20 sm:h-36 md:w-24 md:h-40 rounded-2xl overflow-hidden -rotate-6 opacity-100 shadow-lg -mr-6 sm:-mr-8 shrink-0 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[3].url}
                  alt="Scene preview 1"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 2 (Mid Left) */}
              <div className="w-20 h-36 sm:w-24 sm:h-44 md:w-28 md:h-48 rounded-2xl overflow-hidden -rotate-3 opacity-100 shadow-xl -mr-5 sm:-mr-6 shrink-0 z-10 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[1].url}
                  alt="Scene preview 2"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 3 (Center Hero - Live Video Preview Demo) */}
              <div className="relative w-28 h-52 sm:w-36 sm:h-64 md:w-44 md:h-72 rounded-2xl overflow-hidden shadow-2xl shrink-0 z-20 border-2 border-white ring-2 ring-[#E5E0D8] bg-zinc-950 scale-105 transition-transform duration-300 hover:scale-110 group">
                <video
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
                  poster={FEATURED_STYLES[0].images[0].url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Live Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[9px] font-mono font-semibold text-white flex items-center gap-1.5 border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>1080p AI Video</span>
                </div>
                {/* Play/Control indicator */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 p-1.5 px-2 rounded-xl bg-black/65 backdrop-blur-md border border-white/10 flex items-center justify-between text-[9px] font-mono text-white">
                  <div className="flex items-center gap-1.5">
                    <Play size={10} className="fill-white" />
                    <span>0:08</span>
                  </div>
                  <span className="text-zinc-300 text-[8px] uppercase tracking-wider">AI Render</span>
                </div>
              </div>

              {/* Card 4 (Mid Right) */}
              <div className="w-20 h-36 sm:w-24 sm:h-44 md:w-28 md:h-48 rounded-2xl overflow-hidden rotate-3 opacity-100 shadow-xl -ml-5 sm:-ml-6 shrink-0 z-10 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[4].url}
                  alt="Scene preview 4"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 5 (Far Right) */}
              <div className="w-16 h-28 sm:w-20 sm:h-36 md:w-24 md:h-40 rounded-2xl overflow-hidden rotate-6 opacity-100 shadow-lg -ml-6 sm:-ml-8 shrink-0 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100 transition-transform duration-300 hover:opacity-100 hover:-translate-y-2">
                <img
                  src={FEATURED_STYLES[0].images[2].url}
                  alt="Scene preview 5"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Stage Indicator Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E5E0D8] bg-white text-xs font-mono text-zinc-700 tracking-wider shadow-sm">
              <span>Ideas</span>
              <span className="text-zinc-400">&rarr;</span>
              <span className="text-emerald-700 font-semibold">Scenes</span>
              <span className="text-zinc-400">&rarr;</span>
              <span className="text-[#E05A30] font-semibold">Videos</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
