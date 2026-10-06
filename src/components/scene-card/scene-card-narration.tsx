'use client';

import React from 'react';
import { Sparkles, Video, Layers } from 'lucide-react';
import type { VisualSceneType, ShotType } from '@/types';
import { SHOT_TYPE_CONFIG } from './scene-card-constants';

interface SceneCardNarrationProps {
  narrationText: string;
  visible: boolean;
  visualType?: VisualSceneType;
  shotType?: ShotType;
  motionReady?: boolean;
}

export default function SceneCardNarration({
  narrationText,
  visible,
  visualType,
  shotType,
  motionReady,
}: SceneCardNarrationProps) {
  if (!narrationText && !shotType && !motionReady) return null;

  const shotTypeObj = shotType && SHOT_TYPE_CONFIG[shotType] ? SHOT_TYPE_CONFIG[shotType] : null;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 pointer-events-none transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-8 pb-2.5 px-3">
        {/* Optional Metadata Row (Visual Type label / Shot Type / Motion) */}
        {(visualType || shotTypeObj || motionReady) && (
          <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-medium tracking-tight select-none">
            {visualType && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${visualType === 'HERO_AI'
                  ? 'bg-purple-950/80 border-purple-500/40 text-purple-300'
                  : visualType === 'STOCK_BROLL'
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                  }`}
              >
                {visualType === 'HERO_AI' ? (
                  <Sparkles size={9} />
                ) : visualType === 'STOCK_BROLL' ? (
                  <Video size={9} />
                ) : (
                  <Layers size={9} />
                )}
                <span>
                  {visualType === 'HERO_AI'
                    ? 'Hero'
                    : visualType === 'STOCK_BROLL'
                      ? 'Stock B-Roll'
                      : 'Motion Graphic'}
                </span>
              </span>
            )}

            {shotTypeObj && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-zinc-300">
                {(() => {
                  const Icon = shotTypeObj.icon;
                  return <Icon size={9} className="text-zinc-400" />;
                })()}
                <span>{shotTypeObj.shortLabel}</span>
              </span>
            )}


          </div>
        )}

        {/* Cinematic Script Narration Text */}
        {narrationText && (
          <div className="pointer-events-auto flex items-start gap-1 text-zinc-200 select-text">
            <span className="text-amber-400/90 text-xs font-serif leading-none select-none mt-0.5">“</span>
            <p
              className="text-[11px] leading-snug font-normal text-zinc-100 line-clamp-2"
              title={narrationText}
            >
              {narrationText}
            </p>
            <span className="text-amber-400/90 text-xs font-serif leading-none select-none mt-0.5">”</span>
          </div>
        )}
      </div>
    </div>
  );
}

