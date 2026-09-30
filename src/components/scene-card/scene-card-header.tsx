'use client';

import React from 'react';

interface SceneCardHeaderProps {
  sceneId: number;
  duration: string;
  onUpdateDuration?: (sceneId: number, deltaSec: number) => void;
  disabled?: boolean;
}

export default function SceneCardHeader({
  sceneId,
  duration,
  onUpdateDuration,
  disabled,
}: SceneCardHeaderProps) {
  const durationNum = parseFloat(duration);

  return (
    <div
      className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white shadow-lg pointer-events-auto transition-all duration-200 hover:border-white/30"
      onClick={(e) => e.stopPropagation()}
    >
      {/* <span className="text-[11px] font-bold tracking-tight text-white/95 font-mono">
        {formattedId}
      </span> */}
      {/* <span className="text-[10px] text-white/30 select-none">|</span> */}
      {onUpdateDuration ? (
        <div className="flex items-center gap-1 text-[10px] font-mono select-none">
          <button
            type="button"
            onClick={() => onUpdateDuration(sceneId, -0.5)}
            disabled={disabled || durationNum <= 1.0}
            title="Shorten scene (-0.5s)"
            className="w-4 h-4 flex items-center justify-center rounded-sm bg-white/5 hover:bg-white/20 text-white/80 hover:text-white disabled:opacity-25 transition-all font-semibold active:scale-90"
          >
            −
          </button>
          <span className="font-semibold min-w-[28px] text-center text-zinc-100">
            {duration}s
          </span>
          <button
            type="button"
            onClick={() => onUpdateDuration(sceneId, 0.5)}
            disabled={disabled || durationNum >= 30.0}
            title="Lengthen scene (+0.5s)"
            className="w-4 h-4 flex items-center justify-center rounded-sm bg-white/5 hover:bg-white/20 text-white/80 hover:text-white disabled:opacity-25 transition-all font-semibold active:scale-90"
          >
            +
          </button>
        </div>
      ) : (
        <span className="text-[10px] font-mono text-zinc-200">{duration}s</span>
      )}
    </div>
  );
}
