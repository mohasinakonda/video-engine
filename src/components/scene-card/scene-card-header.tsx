'use client';

import React from 'react';
import {
  Sparkles,
  Video,
  Layers,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import type { VisualSceneType, CameraMotionEffect } from '@/types';

interface SceneCardHeaderProps {
  sceneId: number;
  duration: string;
  visualType?: VisualSceneType;
  cameraMotion?: CameraMotionEffect;
  onUpdateDuration?: (sceneId: number, deltaSec: number) => void;
  disabled?: boolean;
}

export default function SceneCardHeader({
  sceneId,
  duration,
  visualType,
  cameraMotion,
  onUpdateDuration,
  disabled,
}: SceneCardHeaderProps) {
  const durationNum = parseFloat(duration);

  return (
    <div
      className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-auto max-w-[calc(100%-80px)] flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Duration & Scene Stepper Pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg transition-all duration-200 hover:border-white/30">
        <span className="text-[10px] font-bold text-zinc-300 font-mono">#{sceneId}</span>
        <span className="text-[10px] text-white/30 select-none">·</span>
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

      {/* Visual Type Badge */}
      {visualType && (
        <div
          title={
            visualType === 'HERO_AI'
              ? 'Hero Visual: AI-generated visual anchor'
              : visualType === 'STOCK_BROLL'
              ? 'Real-world footage / stock B-roll'
              : 'Kinetic typography, timeline, or motion graphic'
          }
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md shadow-md border transition-all select-none ${
            visualType === 'HERO_AI'
              ? 'bg-purple-950/85 text-purple-300 border-purple-500/40'
              : visualType === 'STOCK_BROLL'
              ? 'bg-emerald-950/85 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-950/85 text-amber-300 border-amber-500/40'
          }`}
        >
          {visualType === 'HERO_AI' ? (
            <>
              <Sparkles size={10} className="text-purple-400" />
              <span>Hero AI</span>
            </>
          ) : visualType === 'STOCK_BROLL' ? (
            <>
              <Video size={10} className="text-emerald-400" />
              <span>Stock B-Roll</span>
            </>
          ) : (
            <>
              <Layers size={10} className="text-amber-400" />
              <span>Motion Graphic</span>
            </>
          )}
        </div>
      )}

      {/* Camera Motion Badge */}
      {cameraMotion && cameraMotion !== 'STATIC' && (
        <div
          title={`Camera Motion: ${cameraMotion.replace('_', ' ')}`}
          className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono text-zinc-300 bg-black/75 border border-white/20 backdrop-blur-md shadow-md select-none"
        >
          {cameraMotion === 'ZOOM_IN' && <ZoomIn size={9} className="text-blue-400" />}
          {cameraMotion === 'ZOOM_OUT' && <ZoomOut size={9} className="text-blue-400" />}
          {cameraMotion === 'PAN_LEFT' && <ArrowLeft size={9} className="text-indigo-400" />}
          {cameraMotion === 'PAN_RIGHT' && <ArrowRight size={9} className="text-indigo-400" />}
          <span className="capitalize">{cameraMotion.toLowerCase().replace('_', ' ')}</span>
        </div>
      )}
    </div>
  );
}

