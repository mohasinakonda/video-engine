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
      case 'Extreme Transformation':
      case 'Counter-Intuitive Truth':
      case 'High-Stakes Story':
      case 'Search / SEO Authority':
      case 'Search / SEO':
      default:
        return 'bg-zinc-850 border-zinc-750 text-zinc-300';
    }
  };

  return (
    <div className="card p-5 bg-bg-surface border-bg-border space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
            <TrendingUp size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>High-CTR Title Laboratory</span>
              <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                5 Archetypes
              </span>
            </h3>
            <p className="text-xxs text-zinc-400">
              Battle-tested psychological hooks designed to avoid mobile feed truncation (&lt;60 chars)
            </p>
          </div>
        </div>


      </div>

      {/* Titles List */}
      <div className="space-y-3">
        {packaging.titles.map((t: TitleOption, idx: number) => {
          const isSelected = (packaging.selectedTitleIndex ?? 0) === idx;
          const charLen = t.title.length;
          const charBadge = getCharBadge(charLen);
          const pairedIdx = packaging.thumbnailConcepts
            ? packaging.thumbnailConcepts.findIndex((c) => c.id === t.pairedConceptId) + 1
            : 0;

          return (
            <div
              key={idx}
              onClick={() => handleSelectTitle(idx)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${isSelected
                  ? 'bg-zinc-850/95 border-white/40 text-white shadow-lg ring-1 ring-white/10'
                  : 'bg-zinc-950/70 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/60'
                }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Index / Active Radio */}
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 transition-colors ${isSelected
                      ? 'border-white bg-white text-zinc-950'
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
                    <p className="text-xxs text-zinc-400 flex items-center gap-1.5 font-normal leading-relaxed">
                      <Info size={11} className="text-zinc-500 flex-shrink-0" />
                      <span>{t.whyItWorks}</span>
                    </p>
                  )}

                  {/* Metadata Chips: Hook Style + Mobile Length */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span
                      className={`text-3xs uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${getHookBadge(
                        t.hookStyle
                      )}`}
                    >
                      {t.hookStyle}
                    </span>

                    <span
                      className={`text-3xs font-mono px-2 py-0.5 rounded border font-semibold ${charBadge.cls}`}
                    >
                      {charBadge.text}
                    </span>

                    {pairedIdx > 0 && (
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        Pairs with thumbnail idea #{pairedIdx}
                      </span>
                    )}

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
