'use client';

import React from 'react';
import { Image as ImageIcon, Palette, Zap } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';
import { ConceptGalleryStrip } from './thumbnail-studio/concept-gallery-strip';
import { GeneratedThumbnailStage } from './thumbnail-studio/generated-thumbnail-stage';
import { DraftPromptStage } from './thumbnail-studio/draft-prompt-stage';

export function ThumbnailStudioCard() {
  const {
    project,
    packaging,
    stylePreset,
    activeConcept,
    conceptEditMode,
    userCredits,
  } = useLaunchKit();

  if (!packaging?.thumbnailConcepts || packaging.thumbnailConcepts.length === 0) {
    return null;
  }

  const activeIndex = activeConcept
    ? packaging.thumbnailConcepts.findIndex((c) => c.id === activeConcept.id)
    : 0;

  const conceptToRender = activeConcept || packaging.thumbnailConcepts[0];
  const hasImage = Boolean(conceptToRender?.imageUrl);
  const isEditing = Boolean(conceptToRender && conceptEditMode[conceptToRender.id]);
  const showImage = hasImage && !isEditing;

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 space-y-4 shadow-xl">
      {/* Header: Title + Aspect Ratio + Credits Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ImageIcon size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Style-Consistent Thumbnail Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                {project.aspectRatio || '16:9'}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Verify prompt, customize text overlays, and render high-impact thumbnails in place
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">


          <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-mono bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            <Palette size={12} className="text-purple-400" />
            <span>{stylePreset?.name || 'Cinematic'}</span>
          </span>
        </div>
      </div>

      {/* Concept Gallery Switcher Strip */}
      <ConceptGalleryStrip />

      {/* Active Concept Morphing Stage */}
      {conceptToRender && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl transition-all">
          {showImage ? (
            <GeneratedThumbnailStage concept={conceptToRender} activeIndex={activeIndex} />
          ) : (
            <DraftPromptStage concept={conceptToRender} activeIndex={activeIndex} />
          )}
        </div>
      )}
    </div>
  );
}
