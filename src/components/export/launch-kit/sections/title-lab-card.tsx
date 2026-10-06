'use client';

import React from 'react';
import { TrendingUp, Smartphone, Info, CheckCircle2 } from 'lucide-react';
import type { TitleOption } from '@/types';
import { useLaunchKit } from '../launch-kit-context';
import { CopyButton } from '../components/copy-button';

export function TitleLabCard() {
  const { packaging, handleSelectTitle } = useLaunchKit();

  if (!packaging?.titles || packaging.titles.length === 0) return null;

  const getCharBadge = (len: number) => {
    if (len <= 55) {
      return {
        text: `${len} chars (Mobile Optimized)`,
        cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      };
    }
    if (len <= 65) {
      return {
        text: `${len} chars (Borderline)`,
        cls: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      };
    }
    return {
      text: `${len} chars (May Truncate)`,
      cls: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    };
  };

  const getHookBadge = (style: string) => {
    switch (style) {
      case 'Curiosity Gap':
        return 'bg-purple-950/60 border-purple-800/50 text-purple-300';
      case 'Extreme Transformation':
        return 'bg-amber-950/60 border-amber-800/50 text-amber-300';
      case 'Counter-Intuitive Truth':
        return 'bg-rose-950/60 border-rose-800/50 text-rose-300';
      case 'High-Stakes Story':
        return 'bg-blue-950/60 border-blue-800/50 text-blue-300';
      case 'Search / SEO Authority':
      case 'Search / SEO':
        return 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-300';
    }
  };

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>High-CTR Title Laboratory</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                5 Archetypes
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Battle-tested psychological hooks designed to avoid mobile feed truncation (&lt;60 chars)
            </p>
          </div>
        </div>

        <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
          <Smartphone size={12} className="text-zinc-500" />
          Click to sync with feed mockup
        </span>
      </div>

      {/* Titles List */}
      <div className="space-y-3">
        {packaging.titles.map((t: TitleOption, idx: number) => {
          const isSelected = (packaging.selectedTitleIndex ?? 0) === idx;
          const charLen = t.title.length;
          const charBadge = getCharBadge(charLen);

          return (
            <div
              key={idx}
              onClick={() => handleSelectTitle(idx)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                isSelected
                  ? 'bg-zinc-850/95 border-emerald-500/60 text-white shadow-lg ring-1 ring-emerald-500/20'
                  : 'bg-zinc-950/70 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Index / Active Radio */}
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 transition-colors ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                      : 'border-zinc-700 text-zinc-400 group-hover:border-zinc-600'
                  }`}
                >
                  {isSelected ? <CheckCircle2 size={14} className="text-zinc-950 stroke-[3]" /> : idx + 1}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs sm:text-[13px] font-bold text-white leading-snug tracking-tight">
                    {t.title}
                  </p>

                  {/* Why it works / Psychology */}
                  {t.whyItWorks && (
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-normal leading-relaxed">
                      <Info size={11} className="text-zinc-500 flex-shrink-0" />
                      <span>{t.whyItWorks}</span>
                    </p>
                  )}

                  {/* Metadata Chips: Hook Style + Mobile Length + Predicted CTR */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span
                      className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${getHookBadge(
                        t.hookStyle
                      )}`}
                    >
                      {t.hookStyle}
                    </span>

                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold ${charBadge.cls}`}
                    >
                      {charBadge.text}
                    </span>

                    <span className="text-[10px] text-zinc-300 font-mono flex items-center gap-1">
                      <span className="text-amber-400 font-bold">⚡ {t.ctrScore || 95}%</span>
                      <span className="text-zinc-500 text-[9px]">Predicted CTR</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                <CopyButton
                  text={t.title}
                  copyKey={`title_${idx}`}
                  label="Title"
                  onClickExtra={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
