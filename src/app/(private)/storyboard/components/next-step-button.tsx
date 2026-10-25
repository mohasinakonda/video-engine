'use client';

import { Wand2, PlayCircle, StopCircle, Loader2, Clapperboard, Zap } from 'lucide-react';
import type { SceneItem } from '@/types';
import type { AIImageModel } from '@/types/subscription';

interface NextStepButtonProps {
  scenes: SceneItem[];
  hasScript: boolean;
  extracting: boolean;
  generatingImages: boolean;
  generatingMotion: boolean;
  pendingImages: number;
  readyForMotion: number;
  selectedAIModel: AIImageModel | null;
  onExtract: () => void;
  onGenerateImages: () => void;
  onGenerateMotion: () => void;
  onStop: () => void;
  onExport: () => void;
  /** `panel` = full-width button, `header` = compact inline button */
  variant?: 'panel' | 'header';
}

/**
 * The single primary action for the storyboard workflow. It always shows the
 * next sensible step: extract → generate images → animate → export (or stop while busy).
 */
export default function NextStepButton({
  scenes,
  hasScript,
  extracting,
  generatingImages,
  generatingMotion,
  pendingImages,
  readyForMotion,
  selectedAIModel,
  onExtract,
  onGenerateImages,
  onGenerateMotion,
  onStop,
  onExport,
  variant = 'panel',
}: NextStepButtonProps) {
  const isWorking = generatingImages || generatingMotion || extracting;
  const compact = variant === 'header';
  const size = compact ? 13 : 15;
  const base = compact
    ? 'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50'
    : 'w-full justify-center';

  const primary = compact
    ? `${base} bg-white text-zinc-950 hover:bg-zinc-200`
    : `btn-primary ${base}`;
  const danger = compact
    ? `theme-dark ${base} bg-red-600 text-white hover:bg-red-500`
    : `btn-danger ${base}`;
  const secondary = compact
    ? `${base} bg-bg-elevated border border-bg-border text-zinc-200 hover:border-bg-border-strong`
    : `btn-secondary ${base}`;

  if (isWorking) {
    if (extracting) {
      return (
        <button disabled className={primary}>
          <Loader2 size={size} className="animate-spin" />
          Extracting Scenes…
        </button>
      );
    }
    return (
      <button id="stop-btn" onClick={onStop} className={danger}>
        <StopCircle size={size} />
        Stop
      </button>
    );
  }

  if (scenes.length === 0) {
    return (
      <button id="extract-scenes-btn" onClick={onExtract} disabled={!hasScript} className={primary}>
        <Wand2 size={size} />
        Extract Scenes from Script
      </button>
    );
  }

  if (pendingImages > 0) {
    const cost = selectedAIModel?.creditCost ?? 2;
    return (
      <button id="generate-images-btn" onClick={onGenerateImages} className={primary}>
        <PlayCircle size={size} />
        {pendingImages < scenes.length
          ? `Resume Images (${pendingImages} left)`
          : `Generate ${scenes.length} Images (${scenes.length * cost} cr)`}
      </button>
    );
  }

  if (readyForMotion > 0) {
    return (
      <button id="generate-motion-btn" onClick={onGenerateMotion} className={secondary} style={{ background: 'white', color: 'black', fontWeight: '700' }}>
        <Clapperboard size={size} />
        {`Animate ${readyForMotion} Clips`}
      </button>
    );
  }

  return (
    <button id="proceed-export-btn" onClick={onExport} className={primary}>
      <Zap size={size} />
      Proceed to Export →
    </button>
  );
}
