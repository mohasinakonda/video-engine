'use client';

import React from 'react';
import {
  Eye,
  Trash2,
  Edit3,
  Undo2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { ThumbnailConcept } from '@/types';
import { useLaunchKit } from '../../launch-kit-context';
import { CopyButton } from '../../components/copy-button';

interface DraftPromptStageProps {
  concept: ThumbnailConcept;
  activeIndex: number;
}

export function DraftPromptStage({ concept, activeIndex }: DraftPromptStageProps) {
  const {
    project,
    packaging,
    stylePreset,
    generatingThumbId,
    setConceptEditMode,
    handleDeleteConcept,
    handleResetConceptPrompt,
    handleUpdateConceptPrompt,

    handleGenerateThumbnail,
  } = useLaunchKit();

  const hasImage = Boolean(concept.imageUrl);
  const isGeneratingThis = generatingThumbId === concept.id;

  return (
    <div className="p-5 sm:p-6 space-y-4">
      {/* Concept Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">
              Idea #{activeIndex + 1}: {concept.conceptName}
            </h4>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              Draft Prompt
            </span>
          </div>
          {concept.visualHook && (
            <p className="text-xs text-purple-300 font-medium">
              ⚡ {concept.visualHook}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasImage && (
            <button
              type="button"
              onClick={() => setConceptEditMode((prev) => ({ ...prev, [concept.id]: false }))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 flex items-center gap-1.5 transition-colors"
              title="Cancel editing and view currently generated thumbnail"
            >
              <Eye size={12} />
              <span>View Generated Image</span>
            </button>
          )}
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
      </div>

      {/* Visual Prompt Box */}
      <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Edit3 size={13} />
              <span>Detailed Visual Prompt (থাম্বনেইল প্রম্পট):</span>
            </label>
            <p className="text-[11px] text-zinc-400">
              Verify or edit the prompt below. When ready, click &quot;Generate Thumbnail&quot;.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {concept.originalPrompt && concept.originalPrompt !== concept.visualPrompt && (
              <button
                type="button"
                onClick={() => handleResetConceptPrompt(concept.id)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-colors"
                title="Reset prompt back to AI generated baseline"
              >
                <Undo2 size={12} />
                <span>Reset to AI</span>
              </button>
            )}

            <CopyButton
              text={concept.visualPrompt}
              copyKey={`prompt_${concept.id}`}
              label="Prompt"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 transition-colors"
              buttonText="Copy Prompt"
              copiedText="Copied"
              iconSize={12}
            />
          </div>
        </div>

        <textarea
          rows={5}
          value={concept.visualPrompt}
          onChange={(e) => handleUpdateConceptPrompt(concept.id, e.target.value)}
          placeholder="Describe the concrete visual subjects, composition, and rim lighting..."
          className="w-full text-xs font-mono leading-relaxed bg-zinc-950 border border-zinc-700/80 focus:border-purple-500 rounded-xl text-zinc-100 p-3.5 focus:outline-none resize-y min-h-[120px]"
        />



      </div>

      {/* Action Bar: Generate Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <p className="text-[11px] text-zinc-400">
          Renders in <strong className="text-white">{project.aspectRatio || '16:9'}</strong> matching{' '}
          <strong className="text-purple-300">{stylePreset?.name || 'Cinematic'}</strong> style.
        </p>

        <button
          type="button"
          onClick={() => handleGenerateThumbnail(concept)}
          disabled={isGeneratingThis || Boolean(generatingThumbId)}
          className="btn-primary text-xs px-6 py-3 flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 w-full sm:w-auto font-bold"
        >
          {isGeneratingThis ? (
            <>
              <Loader2 size={15} className="animate-spin text-white" />
              <span>Generating High-Res Image (FLUX/Pollinations)...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} className="text-amber-300" />
              <span>
                {hasImage ? 'Re-generate Thumbnail (In-Place)' : 'Generate Thumbnail (In-Place)'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
