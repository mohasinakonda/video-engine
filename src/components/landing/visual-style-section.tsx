
'use client'
import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { FEATURED_STYLES } from './types-and-data';



export const VisualStyleSection = () => {
  const [activeStyleIdx, setActiveStyleIdx] = useState(0);
  const activeStyle = FEATURED_STYLES[activeStyleIdx];

  return (
    <section id="styles" className="py-20 sm:py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5] text-zinc-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-center">

          {/* Left Column: Heading & Copy */}
          <div className="lg:col-span-4 space-y-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              VISUAL STYLE ENGINE
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-zinc-950 tracking-tight leading-[1.1]">
              Consistent look.<br />Across all scenes.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-sm">
              Choose a master style and keep your entire video visually consistent, from start to finish.
            </p>
          </div>

          {/* Middle Column: Master Style Picker Card */}
          <div className="lg:col-span-3 flex flex-col justify-center items-start">
            <div className="w-full max-w-[240px]">
              <div className="text-xs font-semibold text-zinc-700 mb-2">
                Master Style
              </div>
              <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-lg shadow-zinc-950/[0.03] p-2 sm:p-2.5 space-y-1">
                {FEATURED_STYLES.map((style, idx) => {
                  const isActive = activeStyleIdx === idx;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setActiveStyleIdx(idx)}
                      className={`w-full text-left rounded-xl transition-all flex items-center justify-between px-3 py-2 text-xs ${isActive
                        ? 'bg-[#F4F0EA] border border-[#E5E0D8] text-zinc-950 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 font-medium border border-transparent'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isActive ? (
                          <div className="w-4 h-4 rounded flex items-center justify-center text-zinc-900">
                            <Camera size={13} strokeWidth={2.2} />
                          </div>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          </div>
                        )}
                        <span>{style.title}</span>
                      </div>
                      {isActive && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E05A30] ring-4 ring-[#E05A30]/20" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: 6 Synchronized Images Grid (3 cols x 2 rows) */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {activeStyle.images.slice(0, 6).map((img, i) => (
                <div
                  key={`${activeStyle.id}-${i}`}
                  className="rounded-2xl overflow-hidden aspect-[4/3] bg-zinc-100 shadow-sm border border-[#E5E0D8] relative group"
                >
                  <img
                    src={img.url}
                    alt={img.caption || `Scene ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-1.5 px-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-medium text-white truncate block">
                      {img.caption}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
