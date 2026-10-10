'use client';

import React, { useRef } from 'react';
import {
  Trash2,
  Edit3,
  Eye,
  Download,
  Check,
  ExternalLink,
  RefreshCw,
  Upload,
  Loader2,
  Layers,
} from 'lucide-react';
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
    handleDownloadThumbnail,
    isCanvaLoading,
    canvaSyncingId,
    handleEditInCanva,
    handleSyncFromCanva,
    handleReplaceConceptImage,
  } = useLaunchKit();

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    showToast('✓ Set as active YouTube mockup thumbnail!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        await handleReplaceConceptImage(concept.id, base64);
        showToast('✓ Thumbnail replaced with uploaded file!');
      }
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {/* Hidden file input for custom replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Concept Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">
            Idea #{activeIndex + 1}: {concept.conceptName}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
            <Check size={11} /> High-Res Ready
          </span>
          {concept.canvaDesignId && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
              <Layers size={10} /> Canva Linked
            </span>
          )}
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

      {/* 16:9 or 9:16 Replaced Image Canvas with Live Text Badge Overlay */}
      <div
        className={`relative rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center mx-auto shadow-2xl group ${
          isVertical ? 'aspect-[9/16] max-h-[480px]' : 'aspect-video w-full'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrl}
          alt={concept.conceptName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
        />

        {/* Live Text Overlay Badge Hint */}
        {concept.textOverlayHint && (
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 flex items-center gap-2 shadow-xl pointer-events-none">
            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-bold">
              Hook Text:
            </span>
            <span className="text-xs font-black text-white tracking-wide">
              {concept.textOverlayHint}
            </span>
          </div>
        )}

        {/* Top-right watermark badge */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-zinc-300 border border-white/10 pointer-events-none">
          {project.aspectRatio || '16:9'} · {stylePreset?.name || 'Cinematic'}
        </div>
      </div>

      {/* Control & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setConceptEditMode((prev) => ({ ...prev, [concept.id]: true }))}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
            title="Flip back to the prompt box to edit or re-generate"
          >
            <Edit3 size={13} className="text-purple-400" />
            <span>Edit Prompt</span>
          </button>

          <CopyButton
            text={concept.visualPrompt}
            copyKey={`prompt_${concept.id}`}
            label="Prompt"
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-800"
            buttonText="Copy Prompt"
            copiedText="Copied"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-800"
            title="Upload and replace with your edited thumbnail image"
          >
            <Upload size={12} className="text-zinc-400" />
            <span>Replace File</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Canva Edit / Sync Button */}
          {concept.canvaDesignId ? (
            <button
              type="button"
              onClick={() => handleSyncFromCanva(concept)}
              disabled={canvaSyncingId === concept.id}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              title="Sync latest high-resolution design from Canva"
            >
              {canvaSyncingId === concept.id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              <span>Sync from Canva</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => handleEditInCanva(concept)}
            disabled={isCanvaLoading}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all border border-cyan-400/30 disabled:opacity-50"
            title="Edit in Canva with movable layers (Text, Background & Graphics)"
          >
            {isCanvaLoading ? (
              <Loader2 size={13} className="animate-spin text-white" />
            ) : (
              <ExternalLink size={13} className="text-cyan-200" />
            )}
            <span>Edit in Canva</span>
          </button>

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

          <button
            type="button"
            onClick={() => handleDownloadThumbnail(concept)}
            className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all"
            title="Download Thumbnail HD 1280x720"
          >
            <Download size={13} />
            <span>Download HD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
