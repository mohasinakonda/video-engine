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
  hovering?: boolean;
  onUpdateDuration?: (sceneId: number, deltaSec: number) => void;
  disabled?: boolean;
}

export default function SceneCardHeader({
  sceneId,
  duration,
  visualType,
  cameraMotion,
  hovering,
  onUpdateDuration,
  disabled,
}: SceneCardHeaderProps) {
  const durationNum = parseFloat(duration);

  const visualTypeConfig = visualType
    ? visualType === 'HERO_AI'
      ? { label: 'Hero: AI-generated visual anchor', icon: Sparkles, color: 'text-zinc-200' }
      : visualType === 'STOCK_BROLL'
        ? { label: 'Stock B-Roll: Real footage asset', icon: Video, color: 'text-zinc-300' }
        : { label: 'Motion Graphic: Animated typography or vector', icon: Layers, color: 'text-zinc-300' }
    : null;

  return (
    <div
      className="absolute top-2 left-2 z-20 flex items-center pointer-events-auto select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Idle: just the scene number. Hover: expands into the full control capsule. */}
      <div
        className={`theme-dark flex items-center gap-1.5 rounded-full text-white transition-all duration-200 ${
          hovering
            ? 'px-2.5 py-1 bg-black/75 backdrop-blur-md border border-white/15 shadow-md'
            : 'px-2 py-0.5 bg-black/40 border border-transparent'
        }`}
      >
        <span className="text-2xs font-bold text-zinc-200 font-mono tracking-tight">#{sceneId}</span>

        {hovering && (
          <>
            {visualTypeConfig && (
              <span title={visualTypeConfig.label} className="flex items-center justify-center">
                <visualTypeConfig.icon size={11} className={visualTypeConfig.color} />
              </span>
            )}

            <span className="text-2xs text-white/30">·</span>

            {onUpdateDuration ? (
              <div className="flex items-center gap-0.5 text-2xs font-mono">
                <button
                  type="button"
                  onClick={() => onUpdateDuration(sceneId, -0.5)}
                  disabled={disabled || durationNum <= 1.0}
                  title="Shorten scene (-0.5s)"
                  className="w-4 h-4 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/80 hover:text-white disabled:opacity-20 transition-all font-semibold active:scale-90"
                >
                  −
                </button>
                <span className="font-semibold min-w-[28px] text-center text-zinc-200">{duration}s</span>
                <button
                  type="button"
                  onClick={() => onUpdateDuration(sceneId, 0.5)}
                  disabled={disabled || durationNum >= 30.0}
                  title="Lengthen scene (+0.5s)"
                  className="w-4 h-4 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/80 hover:text-white disabled:opacity-20 transition-all font-semibold active:scale-90"
                >
                  +
                </button>
              </div>
            ) : (
              <span className="text-2xs font-mono text-zinc-200">{duration}s</span>
            )}

            {cameraMotion && cameraMotion !== 'STATIC' && (
              <>
                <span className="text-2xs text-white/30">·</span>
                <span title={`Camera Motion: ${cameraMotion.replace('_', ' ')}`} className="flex items-center">
                  {cameraMotion === 'ZOOM_IN' && <ZoomIn size={10} className="text-zinc-300" />}
                  {cameraMotion === 'ZOOM_OUT' && <ZoomOut size={10} className="text-zinc-300" />}
                  {cameraMotion === 'PAN_LEFT' && <ArrowLeft size={10} className="text-zinc-300" />}
                  {cameraMotion === 'PAN_RIGHT' && <ArrowRight size={10} className="text-zinc-300" />}
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
