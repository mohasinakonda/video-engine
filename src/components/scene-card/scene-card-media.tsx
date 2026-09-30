'use client';

import React from 'react';
import { Loader2, AlertCircle, RefreshCw, ImageIcon } from 'lucide-react';
import type { SceneItem } from '@/types';
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
      className={`absolute inset-0 w-full h-full bg-zinc-950 overflow-hidden rounded-2xl ${
        canPreview ? 'cursor-pointer' : ''
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
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
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
            <div className="flex flex-col items-center gap-1.5 text-zinc-600">
              <ImageIcon size={24} />
              <p className="text-xs text-zinc-400">No Image</p>
            </div>
          )}
        </div>
      )}

      {/* Ambient Subtle Vignette for crisp header contrast while keeping artwork vibrant */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none opacity-40 group-hover:opacity-65 transition-opacity duration-300" />
    </div>
  );
}
