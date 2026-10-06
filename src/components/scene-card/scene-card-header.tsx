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

  const visualTypeConfig = visualType
    ? visualType === 'HERO_AI'
      ? { label: 'Hero: AI-generated visual anchor', icon: Sparkles, color: 'text-purple-400' }
      : visualType === 'STOCK_BROLL'
        ? { label: 'Stock B-Roll: Real footage asset', icon: Video, color: 'text-emerald-400' }
        : { label: 'Motion Graphic: Animated typography or vector', icon: Layers, color: 'text-amber-400' }
    : null;

  return (
    <div
      className="absolute top-2.5 left-2.5 z-20 flex items-center pointer-events-auto select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Unified Compact Glass Capsule */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 hover:border-white/20 text-white shadow-md transition-all duration-200">
        {/* Visual Type Icon Indicator */}
        {visualTypeConfig && (
          <span title={visualTypeConfig.label} className="flex items-center justify-center">
            <visualTypeConfig.icon size={11} className={visualTypeConfig.color} />
          </span>
        )}

        {/* Scene Index */}
        <span className="text-[10px] font-bold text-zinc-300 font-mono tracking-tight">#{sceneId}</span>

        <span className="text-[10px] text-white/30 select-none">·</span>

        {/* Duration with Stepper */}
        {onUpdateDuration ? (
          <div className="flex items-center gap-0.5 text-[10px] font-mono select-none">
            <button
              type="button"
              onClick={() => onUpdateDuration(sceneId, -0.5)}
              disabled={disabled || durationNum <= 1.0}
              title="Shorten scene (-0.5s)"
              className="w-4 h-4 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/80 hover:text-white disabled:opacity-20 transition-all font-semibold active:scale-90"
            >
              −
            </button>
            <span className="font-semibold min-w-[28px] text-center text-zinc-200">
              {duration}s
            </span>
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
          <span className="text-[10px] font-mono text-zinc-200">{duration}s</span>
        )}

        {/* Camera Motion Mini Indicator (if active) */}
        {cameraMotion && cameraMotion !== 'STATIC' && (
          <>
            <span className="text-[10px] text-white/30 select-none">·</span>
            <span
              title={`Camera Motion: ${cameraMotion.replace('_', ' ')}`}
              className="flex items-center text-zinc-400"
            >
              {cameraMotion === 'ZOOM_IN' && <ZoomIn size={10} className="text-blue-400" />}
              {cameraMotion === 'ZOOM_OUT' && <ZoomOut size={10} className="text-blue-400" />}
              {cameraMotion === 'PAN_LEFT' && <ArrowLeft size={10} className="text-indigo-400" />}
              {cameraMotion === 'PAN_RIGHT' && <ArrowRight size={10} className="text-indigo-400" />}
            </span>
          </>
        )}
      </div>
    </div>
  );
}


