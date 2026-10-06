import React from 'react';
import { Play } from 'lucide-react';
import { SpactrumBlue } from '@/icons/spactrum-blue';
import { SpectrumGreen } from '@/icons/spactrum-green';
import { SpactrumOrange } from '@/icons/spactrum-orange';
import { LANDING_SECTION_IMAGES } from './types-and-data';

export const NarrationTimelineSection: React.FC = () => {
  return (
    <section className="py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5] text-zinc-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

        {/* Left Waveforms Mockup */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">

            {/* Scene 01 Waveform Card */}
            <div className="bg-white border border-[#E5E0D8] rounded-2xl p-3.5 shadow-sm space-y-2.5">
              <div className="text-[10px] sm:text-[11px] font-mono text-zinc-500 font-semibold tracking-wide">
                SCENE 01 | 0:00 - 0:07
              </div>

              {/* Simulated Audio Spectrum Waveform - Blue */}
              <div className="h-11 flex items-center w-full">
                <SpactrumBlue />
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-[16/9] border border-[#E5E0D8] bg-zinc-100 shadow-xs group">
                <img
                  src={LANDING_SECTION_IMAGES.narrationTimeline[0].url}
                  alt={LANDING_SECTION_IMAGES.narrationTimeline[0].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute bottom-2 left-2 w-5 h-5 rounded bg-black/70 backdrop-blur-sm flex items-center justify-center text-white shadow">
                  <Play size={9} className="fill-white translate-x-[0.5px]" />
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono font-medium text-white shadow">
                  7s
                </div>
              </div>
            </div>

            {/* Scene 02 Waveform Card */}
            <div className="bg-white border border-[#E5E0D8] rounded-2xl p-3.5 shadow-sm space-y-2.5">
              <div className="text-[10px] sm:text-[11px] font-mono text-zinc-500 font-semibold tracking-wide">
                SCENE 02 | 0:07 - 0:15
              </div>

              {/* Simulated Audio Spectrum Waveform - Green */}
              <div className="h-11 flex items-center w-full">
                <SpectrumGreen />
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-[16/9] border border-[#E5E0D8] bg-zinc-100 shadow-xs group">
                <img
                  src={LANDING_SECTION_IMAGES.narrationTimeline[1].url}
                  alt={LANDING_SECTION_IMAGES.narrationTimeline[1].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute bottom-2 left-2 w-5 h-5 rounded bg-black/70 backdrop-blur-sm flex items-center justify-center text-white shadow">
                  <Play size={9} className="fill-white translate-x-[0.5px]" />
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono font-medium text-white shadow">
                  8s
                </div>
              </div>
            </div>

            {/* Scene 03 Waveform Card */}
            <div className="bg-white border border-[#E5E0D8] rounded-2xl p-3.5 shadow-sm space-y-2.5">
              <div className="text-[10px] sm:text-[11px] font-mono text-zinc-500 font-semibold tracking-wide">
                SCENE 03 | 0:15 - 0:24
              </div>

              {/* Simulated Audio Spectrum Waveform - Orange */}
              <div className="h-11 flex items-center w-full">
                <SpactrumOrange />
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-[16/9] border border-[#E5E0D8] bg-zinc-100 shadow-xs group">
                <img
                  src={LANDING_SECTION_IMAGES.narrationTimeline[2].url}
                  alt={LANDING_SECTION_IMAGES.narrationTimeline[2].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute bottom-2 left-2 w-5 h-5 rounded bg-black/70 backdrop-blur-sm flex items-center justify-center text-white shadow">
                  <Play size={9} className="fill-white translate-x-[0.5px]" />
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono font-medium text-white shadow">
                  9s
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Text */}
        <div className="lg:col-span-5 space-y-4">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            NARRATION & TIMELINE
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.1]">
            Every scene <br />
            follows the story.
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base leading-relaxed pt-1 max-w-md">
            The narration, scene timing and visuals are perfectly aligned — so your video feels natural, engaging and professional.
          </p>
        </div>

      </div>
    </section>
  );
};
