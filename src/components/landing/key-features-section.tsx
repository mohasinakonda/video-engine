import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { KEY_FEATURES } from './types-and-data';

export const KeyFeaturesSection: React.FC = () => {
  return (
    <section id="key-features" className="py-20 sm:py-24 px-6 border-b border-[#E5E0D8] bg-[#F4F0EA] text-zinc-900">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Heading */}
        <div className="max-w-2xl space-y-4">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            THEN MAKE THE VIDEO
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            One studio for the whole video, <br className="hidden sm:block" />
            <span className="text-zinc-500 font-medium">from script to upload.</span>
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
            Write or paste a script, and Rendoza handles the scenes, the voice, the edit and the YouTube launch. No editing skills, no stock footage hunting, no watermark.
          </p>
        </div>

        {/* Feature Cards: first card spans 2 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {KEY_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            const isPrimary = idx === 0;
            return (
              <div
                key={feat.title}
                className={
                  isPrimary
                    ? 'md:col-span-2 rounded-2xl bg-zinc-950 text-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xl shadow-zinc-950/10'
                    : 'rounded-2xl bg-white border border-[#E5E0D8] p-6 flex flex-col gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all'
                }
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      className={
                        isPrimary
                          ? 'w-10 h-10 rounded-xl bg-[#E05A30] flex items-center justify-center'
                          : 'w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center text-zinc-900'
                      }
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    {feat.badge && (
                      <span
                        className={
                          isPrimary
                            ? 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-zinc-200 border border-white/15'
                            : 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#FDEEE8] text-[#C84C25] border border-[#F6D3C5]'
                        }
                      >
                        {feat.badge}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className={isPrimary ? 'text-xl sm:text-2xl font-extrabold tracking-tight' : 'text-base font-bold text-zinc-950 tracking-tight'}>
                      {feat.title}
                    </h3>
                    <p className={isPrimary ? 'text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl' : 'text-sm text-zinc-600 leading-relaxed'}>
                      {feat.desc}
                    </p>
                  </div>
                </div>

                <ul className={isPrimary ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-1.5'}>
                  {feat.points.map((point) => (
                    <li
                      key={point}
                      className={`flex items-start gap-2 text-xs sm:text-[13px] ${isPrimary ? 'text-zinc-200' : 'text-zinc-700'}`}
                    >
                      <Check size={14} className={`mt-0.5 shrink-0 ${isPrimary ? 'text-[#F08A63]' : 'text-emerald-600'}`} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                {isPrimary && (
                  <Link
                    href="/project/new"
                    className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#E05A30] hover:bg-[#C84C25] text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#E05A30]/20 active:scale-95"
                  >
                    <span>Create your first video</span>
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
