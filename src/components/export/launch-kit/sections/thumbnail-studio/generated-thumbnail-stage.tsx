'use client';

import React from 'react';
import { Trash2, Edit3, Eye, Download } from 'lucide-react';
import type { ThumbnailConcept } from '@/types';
import { useLaunchKit } from '../../launch-kit-context';
import { CopyButton } from '../../components/copy-button';
import { saveProject } from '@/lib/store';

interface GeneratedThumbnailStageProps {
  concept: ThumbnailConcept;
  activeIndex: number;
}

export function GeneratedThumbnailStage({ concept, activeIndex }: GeneratedThumbnailStageProps) {
  const {
    project,
    packaging,
    onUpdateProject,
    showToast,
    isVertical,
    stylePreset,
    setConceptEditMode,
    handleDeleteConcept,
  } = useLaunchKit();

  const isCurrentActiveMockup =
    packaging?.selectedThumbnailUrl === concept.imageUrl && Boolean(concept.imageUrl);

  const handleSetAsMockup = async () => {
    if (!concept.imageUrl || !packaging) return;
    const updatedPackaging = {
      ...packaging,
      selectedThumbnailUrl: concept.imageUrl,
    };
    const updated = {
      ...project,
      youtubePackaging: updatedPackaging,
    };
    await saveProject(updated);
    onUpdateProject(updated);
    showToast('Set as active mockup thumbnail!');
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">
            Idea #{activeIndex + 1}: {concept.conceptName}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
            Thumbnail Ready
          </span>
        </div>
        {packaging && packaging.thumbnailConcepts.length > 1 && (
          <button
            type="button"
            onClick={() => handleDeleteConcept(concept.id)}
            className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-900 transition-colors"
            title="Delete this thumbnail idea"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* 16:9 or 9:16 Replaced Image Canvas */}
      <div
        className={`relative rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center mx-auto shadow-2xl ${
          isVertical ? 'aspect-[9/16] max-h-[480px]' : 'aspect-video w-full'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrl}
          alt={concept.conceptName}
          className="w-full h-full object-cover"
        />

        {/* Top-right watermark badge */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-zinc-300 border border-white/10">
          {project.aspectRatio || '16:9'} · {stylePreset?.name || 'Cinematic'}
        </div>
      </div>

      {/* Control & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConceptEditMode((prev) => ({ ...prev, [concept.id]: true }))}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
            title="Flip back to the prompt box to edit or re-generate"
          >
            <Edit3 size={13} className="text-purple-400" />
            <span>Edit Prompt &amp; Re-generate</span>
          </button>

          <CopyButton
            text={concept.visualPrompt}
            copyKey={`prompt_${concept.id}`}
            label="Prompt"
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-800"
            buttonText="Copy Prompt"
            copiedText="Copied"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSetAsMockup}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              isCurrentActiveMockup
                ? 'bg-white text-zinc-950 font-bold border-white shadow-md'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
            }`}
          >
            <Eye size={13} />
            <span>{isCurrentActiveMockup ? '✓ Active Mockup' : 'Use in Feed Mockup'}</span>
          </button>

          <a
            href={concept.imageUrl}
            download={`thumbnail_${activeIndex + 1}.png`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Download Thumbnail HD"
          >
            <Download size={13} />
            <span>Download HD</span>
          </a>
        </div>
      </div>
    </div>
  );
}
