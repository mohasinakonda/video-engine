import React from 'react';
import { CORE_FEATURES } from './types-and-data';

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-20 sm:py-24 px-6 border-b border-[#2e2e2e] bg-[#fbfbfb] text-zinc-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Left Column: Heading & Title */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              FEATURES
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-zinc-950 tracking-tight leading-[1.18]">
              Everything you need to create professional videos — faster.
            </h2>
          </div>

          {/* Right Column: 8 Features in 4 Columns x 2 Rows */}
          <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12">
            {CORE_FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="w-6 h-6 flex items-center justify-start text-zinc-900">
                    <Icon size={19} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-950 tracking-tight pt-1">
                    {feat.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-500 leading-relaxed font-normal">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
};
