'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { TitleOption } from '@/types';
import { useLaunchKit } from '../launch-kit-context';
import { CopyButton } from '../components/copy-button';

export function TitleLabCard() {
  const { packaging, handleSelectTitle } = useLaunchKit();

  if (!packaging?.titles || packaging.titles.length === 0) return null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Viral Title Candidates (Generated from Script)
          </h3>
        </div>
        <span className="text-[11px] text-zinc-400">
          Click a title to sync with feed mockup
        </span>
      </div>

      <div className="space-y-2.5">
        {packaging.titles.map((t: TitleOption, idx: number) => {
          const isSelected = (packaging.selectedTitleIndex ?? 0) === idx;

          return (
            <div
              key={idx}
              onClick={() => handleSelectTitle(idx)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected
                  ? 'bg-zinc-800/90 border-white/50 text-white shadow-md'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 text-[10px] ${
                    isSelected
                      ? 'border-white bg-white text-zinc-950 font-bold'
                      : 'border-zinc-700 text-zinc-400'
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-relaxed truncate sm:whitespace-normal">
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-medium border ${
                        t.hookStyle === 'Curiosity Gap'
                          ? 'bg-purple-950/60 border-purple-800/50 text-purple-300'
                          : t.hookStyle === 'Search / SEO'
                          ? 'bg-blue-950/60 border-blue-800/50 text-blue-300'
                          : t.hookStyle === 'High Emotion'
                          ? 'bg-rose-950/60 border-rose-800/50 text-rose-300'
                          : t.hookStyle === 'Story / Drama'
                          ? 'bg-amber-950/60 border-amber-800/50 text-amber-300'
                          : 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300'
                      }`}
                    >
                      {t.hookStyle}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      ⚡ {t.ctrScore || 95}% Predicted CTR
                    </span>
                  </div>
                </div>
              </div>

              <CopyButton
                text={t.title}
                copyKey={`title_${idx}`}
                label="Title"
                onClickExtra={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
