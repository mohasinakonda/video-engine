'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

export function ErrorBanner() {
  const { errorMessage, isGenerating, handleGeneratePackaging } = useLaunchKit();

  if (!errorMessage) return null;

  return (
    <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 flex items-start justify-between gap-3 animate-slide-up">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-white">AI Generation Encountered an Issue</p>
          <p className="text-[11px] text-red-300 mt-0.5">{errorMessage}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleGeneratePackaging}
        disabled={isGenerating}
        className="btn-secondary text-[11px] py-1 px-3 flex items-center gap-1.5 flex-shrink-0"
      >
        <RotateCcw size={12} />
        <span>Retry</span>
      </button>
    </div>
  );
}
