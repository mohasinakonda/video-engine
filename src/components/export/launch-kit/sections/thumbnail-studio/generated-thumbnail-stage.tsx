'use client';

import React, { useRef, useState, useEffect } from 'react';
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
  MoreHorizontal,
  Copy,
} from 'lucide-react';
import type { ThumbnailConcept } from '@/types';
import { useLaunchKit } from '../../launch-kit-context';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const canDelete = !!packaging && packaging.thumbnailConcepts.length > 1;

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
          <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
            <Check size={11} /> High-Res Ready
          </span>
          {concept.canvaDesignId && (
            <span className="text-2xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
              <Layers size={10} /> Canva Linked
            </span>
          )}
        </div>
      </div>

      {/* 16:9 or 9:16 Replaced Image Canvas with Live Text Badge Overlay */}
      <div
        className={`relative rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center mx-auto shadow-2xl group ${isVertical ? 'aspect-[9/16] max-h-[480px]' : 'aspect-video w-full'
          }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concept.imageUrl}
          alt={concept.conceptName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
        />



        {/* Top-right watermark badge */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/80 backdrop-blur-md text-2xs font-mono text-zinc-300 border border-white/10 pointer-events-none">
          {project.aspectRatio || '16:9'}
        </div>
      </div>

      {/* Control & Actions Bar: one primary, a few secondary, the rest in a menu */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleDownloadThumbnail(concept)}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
            title="Download Thumbnail HD 1280x720"
          >
            <Download size={13} />
            <span>Download HD</span>
          </button>

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

          {concept.canvaDesignId && (
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
          )}

          <button
            type="button"
            onClick={() => setConceptEditMode((prev) => ({ ...prev, [concept.id]: true }))}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
            title="Edit the prompt and generate again"
          >
            <Edit3 size={13} className="text-zinc-300" />
            <span>Edit &amp; Regenerate</span>
          </button>

          <button
            type="button"
            onClick={handleSetAsMockup}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${isCurrentActiveMockup
              ? 'bg-white text-zinc-950 font-bold border-white shadow-md'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
              }`}
          >
            <Eye size={13} />
            <span>{isCurrentActiveMockup ? '✓ In Preview' : 'Show in Preview'}</span>
          </button>
        </div>

        {/* More actions */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirmingDelete(false);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
            title="More actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-2 z-30 w-56 p-1.5 rounded-xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Upload size={13} />
                <span>Replace with my file</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(concept.visualPrompt).catch(() => {});
                  showToast('Prompt copied');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Copy size={13} />
                <span>Copy prompt</span>
              </button>

              {canDelete && (
                <div className="pt-1 mt-1 border-t border-zinc-800">
                  {confirmingDelete ? (
                    <div className="px-2.5 py-2 space-y-2">
                      <p className="text-xs text-zinc-300">Delete this idea and its image?</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmingDelete(false);
                            handleDeleteConcept(concept.id);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(false)}
                          className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Delete idea</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
