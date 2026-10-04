'use client';

import React from 'react';
import { Loader2, AlertCircle, RefreshCw, ImageIcon, Video, Layers, Sparkles } from 'lucide-react';
import type { SceneItem, CameraMotionEffect } from '@/types';
import { getMediaBlobUrl } from '@/lib/media-storage';

interface SceneCardMediaProps {
  scene: SceneItem;
  projectId?: string;
  currentSrc?: string;
  imgError: boolean;
  isGenerating: boolean;
  editingPrompt: boolean;
  onOpenPreview: () => void;
  onRegenerate: () => void;
  onRecoverSrc: (url: string) => void;
  onSetImgError: (hasError: boolean) => void;
}

function getCameraMotionClass(motion?: CameraMotionEffect): string {
  switch (motion) {
    case 'ZOOM_IN':
      return 'group-hover:scale-115 origin-center';
    case 'ZOOM_OUT':
      return 'scale-110 group-hover:scale-100 origin-center';
    case 'PAN_LEFT':
      return 'group-hover:-translate-x-3 group-hover:scale-110 origin-left';
    case 'PAN_RIGHT':
      return 'group-hover:translate-x-3 group-hover:scale-110 origin-right';
    default:
      return 'group-hover:scale-105 origin-center';
  }
}

export default function SceneCardMedia({
  scene,
  projectId,
  currentSrc,
  imgError,
  isGenerating,
  editingPrompt,
  onOpenPreview,
  onRegenerate,
  onRecoverSrc,
  onSetImgError,
}: SceneCardMediaProps) {
  const canPreview = currentSrc && !imgError && !isGenerating;

  return (
    <div
      className={`absolute inset-0 w-full h-full bg-zinc-950 overflow-hidden rounded-2xl ${canPreview ? 'cursor-pointer' : ''
        }`}
      onClick={() => {
        if (canPreview && !editingPrompt) {
          onOpenPreview();
        }
      }}
      title={currentSrc && !imgError ? 'Click to preview and edit in Creative Studio' : undefined}
    >
      {currentSrc && !imgError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={currentSrc}
          alt={`Scene ${scene.sceneId}`}
          className={`w-full h-full object-cover transition-transform duration-1000 ease-out ${getCameraMotionClass(
            scene.cameraMotion
          )}`}
          onError={async () => {
            if (projectId) {
              try {
                const recovered = await getMediaBlobUrl(`scene_${projectId}_${scene.sceneId}`);
                if (recovered && recovered !== currentSrc) {
                  onRecoverSrc(recovered);
                  return;
                }
              } catch {
                // ignore
              }
            }
            onSetImgError(true);
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-zinc-900/60">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="text-white animate-spin" />
              <p className="text-xs text-zinc-300 font-medium">
                {scene.status === 'GENERATING_IMAGE' ? 'Generating image…' : 'Rendering motion…'}
              </p>
            </div>
          ) : imgError ? (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <AlertCircle size={22} className="text-amber-400" />
              <p className="text-xs text-zinc-300 font-medium">Image not found</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                className="mt-1 px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw size={12} />
                <span>Regenerate</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-3">
              {scene.visualType === 'STOCK_BROLL' ? (
                <>
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Video size={18} className="text-emerald-400" />
                  </div>
                  <p className="text-xs font-semibold text-emerald-300">Stock B-Roll Slot</p>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 max-w-[210px] text-center">
                    {scene.bRollFocus || 'Real footage overlay cue'}
                  </p>
                </>
              ) : scene.visualType === 'MOTION_GRAPHIC' ? (
                <>
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Layers size={18} className="text-amber-400" />
                  </div>
                  <p className="text-xs font-semibold text-amber-300">Motion Graphic Slot</p>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 max-w-[210px] text-center">
                    Kinetic typography, timeline or data callout
                  </p>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Sparkles size={18} className="text-purple-400" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-300">Hero Visual</p>
                  <p className="text-[10px] text-zinc-400">Ready for image generation</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ambient Subtle Vignette for crisp header contrast while keeping artwork vibrant */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none opacity-40 group-hover:opacity-65 transition-opacity duration-300" />
    </div>
  );
}
