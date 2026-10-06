import React, { useState } from 'react';
import { LANDING_SECTION_IMAGES } from './types-and-data';
import { useRouter } from 'next/navigation';


export const ReadyToCreateSection = ({


}) => {
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
    <section className="py-20 sm:py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5] text-zinc-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-center">

          {/* Left Column: Heading & Copy */}
          <div className="lg:col-span-4 space-y-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              READY TO CREATE?
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-zinc-950 tracking-tight leading-[1.08]">
              Your next video<br />starts with a script.
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-sm">
              Paste your script below and see how FrameFlow turns your words into a complete video.
            </p>
          </div>

          {/* Middle Column: Script Input Box */}
          <div className="lg:col-span-5">
            <form onSubmit={handleStartWithScript}>
              <div className="relative rounded-2xl bg-white border border-[#E5E0D8] hover:border-zinc-300 focus-within:border-zinc-400 transition-all p-4 sm:p-5 flex flex-col justify-between min-h-[170px] shadow-xl shadow-zinc-950/[0.03]">
                <textarea
                  rows={3}
                  maxLength={2700}
                  value={userScriptInput}
                  onChange={(e) => setUserScriptInput(e.target.value)}
                  placeholder="Paste your script here..."
                  className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none font-sans"
                />

                <div className="flex flex-col items-end pt-2">
                  <span className="text-[11px] font-mono text-zinc-500 mb-2">
                    {userScriptInput.length}/2700
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#E05A30] hover:bg-[#C84C25] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#E05A30]/20 active:scale-95"
                  >
                    <span>Create video &rarr;</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Fan of 5 Perspective Cards */}
          <div className="lg:col-span-3 flex flex-col items-center justify-center pt-4 lg:pt-0">
            <div className="flex items-center justify-center">
              {/* Card 1 (Far Left) */}
              <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl overflow-hidden -rotate-6 opacity-70 shadow-md -mr-5 shrink-0 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100">
                <img
                  src={LANDING_SECTION_IMAGES.readyToCreate[0]}
                  alt="Scene preview 1"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 2 (Mid Left) */}
              <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden -rotate-3 opacity-90 shadow-lg -mr-4 shrink-0 z-10 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100">
                <img
                  src={LANDING_SECTION_IMAGES.readyToCreate[1]}
                  alt="Scene preview 2"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 3 (Center Hero) */}
              <div className="w-20 h-28 sm:w-24 sm:h-34 rounded-xl overflow-hidden shadow-xl shrink-0 z-20 border-2 border-white ring-2 ring-[#E5E0D8] bg-zinc-100">
                <img
                  src={LANDING_SECTION_IMAGES.readyToCreate[2]}
                  alt="Scene preview center"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 4 (Mid Right) */}
              <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden rotate-3 opacity-90 shadow-lg -ml-4 shrink-0 z-10 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100">
                <img
                  src={LANDING_SECTION_IMAGES.readyToCreate[3]}
                  alt="Scene preview 4"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Card 5 (Far Right) */}
              <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl overflow-hidden rotate-6 opacity-70 shadow-md -ml-5 shrink-0 border-2 border-white ring-1 ring-[#E5E0D8] bg-zinc-100">
                <img
                  src={LANDING_SECTION_IMAGES.readyToCreate[4]}
                  alt="Scene preview 5"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="text-xs font-mono text-zinc-500 tracking-wider mt-4">
              Ideas &rarr; Scenes &rarr; Videos
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
