'use client';

import React from 'react';

interface SceneCardNarrationProps {
  narrationText: string;
  visible: boolean;
}

export default function SceneCardNarration({ narrationText, visible }: SceneCardNarrationProps) {
  if (!narrationText) return null;

  return (
    <div
      className={`absolute bottom-2.5 inset-x-2.5 z-20 flex justify-center pointer-events-none transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-auto max-w-full px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-2xl flex items-center gap-1.5 transition-all duration-200 hover:bg-black/90 hover:border-white/30"
        title={narrationText}
      >
        <span className="text-amber-400/80 text-xs font-serif leading-none select-none">“</span>
        <p className="text-[11px] text-zinc-100 font-normal leading-tight line-clamp-1 truncate select-text">
          {narrationText}
        </p>
        <span className="text-amber-400/80 text-xs font-serif leading-none select-none">”</span>
      </div>
    </div>
  );
}
