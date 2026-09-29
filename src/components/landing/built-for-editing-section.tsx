import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowUpDown,
  Upload,
  Download,
} from 'lucide-react';

export const BuiltForEditingSection: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 px-6 border-b border-[#2e2e2e] bg-[#fbfbfb] text-zinc-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-center">

          {/* Left Column: Heading & Copy */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              BUILT FOR EDITING
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-zinc-950 tracking-tight leading-[1.1]">
              Generate. Edit. Refine. Export.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-sm">
              Continue in your favorite editing tools or download your video directly. Perfect for creators, marketers and teams who want more control.
            </p>
          </div>

          {/* Middle Column: 3-step Pipeline Stepper */}
          <div className="lg:col-span-5 xl:col-span-5 flex items-start justify-between sm:justify-start sm:gap-6 md:gap-8">
            {/* Step 1: Generate */}
            <div className="flex flex-col items-start max-w-[110px]">
              <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200/90 shadow-sm flex items-center justify-center text-zinc-800">
                <Sparkles size={20} strokeWidth={1.8} className="text-zinc-800" />
              </div>
              <div className="text-xs font-bold text-zinc-950 mt-3">
                Generate
              </div>
              <div className="text-[11px] text-zinc-500 leading-snug mt-1">
                AI creates your scenes, visuals and narration.
              </div>
            </div>

            {/* Connecting arrow 1 */}
            <div className="pt-3 text-zinc-300">
              <ArrowRight size={16} />
            </div>

            {/* Step 2: Edit */}
            <div className="flex flex-col items-start max-w-[110px]">
              <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200/90 shadow-sm flex items-center justify-center text-zinc-800">
                <ArrowUpDown size={18} strokeWidth={2} className="text-zinc-800" />
              </div>
              <div className="text-xs font-bold text-zinc-950 mt-3">
                Edit
              </div>
              <div className="text-[11px] text-zinc-500 leading-snug mt-1">
                Fine-tune in your preferred editor.
              </div>
            </div>

            {/* Connecting arrow 2 */}
            <div className="pt-3 text-zinc-300">
              <ArrowRight size={16} />
            </div>

            {/* Step 3: Export */}
            <div className="flex flex-col items-start max-w-[110px]">
              <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200/90 shadow-sm flex items-center justify-center text-zinc-800">
                <Upload size={18} strokeWidth={2} className="text-zinc-800" />
              </div>
              <div className="text-xs font-bold text-zinc-950 mt-3">
                Export
              </div>
              <div className="text-[11px] text-zinc-500 leading-snug mt-1">
                Get your final video or export to NLE.
              </div>
            </div>
          </div>

          {/* Right Column: Floating "Export to" Card */}
          <div className="lg:col-span-3 xl:col-span-3 flex flex-col justify-center items-start lg:items-end">
            <div className="w-full max-w-[210px]">
              <div className="text-xs font-semibold text-zinc-700 mb-2">
                Export to
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xl shadow-zinc-200/60 p-3 space-y-2.5">
                {/* Premiere Pro */}
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#00005b] text-[#9999ff] font-extrabold text-[11px] flex items-center justify-center font-sans tracking-tight shrink-0 shadow-xs">
                    Pr
                  </div>
                  <span className="text-xs font-semibold text-zinc-900">Premiere Pro</span>
                </div>

                {/* DaVinci Resolve */}
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-zinc-950 flex items-center justify-center p-1.5 shrink-0 shadow-xs">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <circle cx="12" cy="6" r="3.5" fill="#EF4444" />
                      <circle cx="6.5" cy="16" r="3.5" fill="#10B981" />
                      <circle cx="17.5" cy="16" r="3.5" fill="#3B82F6" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-zinc-900">DaVinci Resolve</span>
                </div>

                {/* Full Video */}
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#0d1527] text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
                    <Download size={13} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-900">Full Video</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
