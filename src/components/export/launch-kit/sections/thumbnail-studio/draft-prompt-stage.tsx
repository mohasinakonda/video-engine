'use client';

import React, { useState } from 'react';
import {
  Eye,
  Trash2,
  Edit3,
  Undo2,
  Sparkles,
  Loader2,
  Type,
  Zap,
  ChevronDown,
} from 'lucide-react';
import type { ThumbnailConcept } from '@/types';
import { useLaunchKit } from '../../launch-kit-context';
import { CopyButton } from '../../components/copy-button';
import ModelSelectorDropdown from '@/components/storyboard/model-selector-dropdown';

interface DraftPromptStageProps {
  concept: ThumbnailConcept;
  activeIndex: number;
}




// ─── Quick controls: friendly chips that edit the prompt for you ───────────────

type Option = { id: string; label: string; clause: string };

const EMOTIONS: Option[] = [
  { id: 'shocked', label: 'Shocked', clause: 'shocked wide eyes, mouth slightly open' },
  { id: 'awe', label: 'Awe', clause: 'awe-struck wonder, eyes looking up' },
  { id: 'curious', label: 'Curious', clause: 'curious intense gaze, one eyebrow raised' },
  { id: 'fear', label: 'Fear', clause: 'fearful tense expression' },
  { id: 'confident', label: 'Confident', clause: 'confident determined look' },
];

const COLORS: Option[] = [
  { id: 'orange-blue', label: 'Orange / Blue', clause: 'vivid orange versus electric blue color contrast' },
  { id: 'red-teal', label: 'Red / Teal', clause: 'bold red versus teal color contrast' },
  { id: 'gold-purple', label: 'Gold / Purple', clause: 'rich gold versus deep purple color contrast' },
];

const BRIGHT_CLAUSE = 'bright exposure, the subject is the brightest element, no pitch-black areas';

function withoutClause(prompt: string, clause: string): string {
  return prompt
    .replace(new RegExp(`,?\\s*${clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function setExclusive(prompt: string, group: Option[], picked: Option): string {
  let next = prompt;
  for (const o of group) next = withoutClause(next, o.clause);
  const alreadyOn = prompt.toLowerCase().includes(picked.clause.toLowerCase());
  if (alreadyOn) return next; // clicking the active chip turns it off
  const trimmed = next.replace(/[\s,.]+$/, '');
  return `${trimmed}, ${picked.clause}`;
}

function PromptQuickControls({
  prompt,
  onChange,
}: {
  prompt: string;
  onChange: (next: string) => void;
}) {
  const has = (clause: string) => prompt.toLowerCase().includes(clause.toLowerCase());

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border transition-colors ${
      active
        ? 'bg-white text-zinc-950 border-white font-semibold'
        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
    }`;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-zinc-400">Emotion</p>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(setExclusive(prompt, EMOTIONS, o))}
              className={chip(has(o.clause))}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-zinc-400">Colors</p>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(setExclusive(prompt, COLORS, o))}
              className={chip(has(o.clause))}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-zinc-400">Brightness</p>
        <button
          type="button"
          onClick={() =>
            onChange(
              has(BRIGHT_CLAUSE)
                ? withoutClause(prompt, BRIGHT_CLAUSE)
                : `${prompt.replace(/[\s,.]+$/, '')}, ${BRIGHT_CLAUSE}`
            )
          }
          className={chip(has(BRIGHT_CLAUSE))}
        >
          Make it brighter
        </button>
      </div>
    </div>
  );
}

export function DraftPromptStage({ concept, activeIndex }: DraftPromptStageProps) {
  const {
    project,
    packaging,
    selectedAIModel,
    generatingThumbId,
    enhancingThumbId,
    setConceptEditMode,
    handleDeleteConcept,
    handleResetConceptPrompt,
    handleUpdateConceptPrompt,
    handleEnhanceConceptPrompt,
    handleGenerateThumbnail,
  } = useLaunchKit();

  const hasImage = Boolean(concept.imageUrl);
  const isGeneratingThis = generatingThumbId === concept.id;
  const isEnhancingThis = enhancingThumbId === concept.id;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);


  return (
    <div className="p-5 sm:p-6 space-y-4">
      {/* Concept Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">
              Idea #{activeIndex + 1}: {concept.conceptName}
            </h4>
            {/* <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              Draft Prompt Stage
            </span> */}
          </div>

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
            confirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    handleDeleteConcept(concept.id);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
                >
                  Delete idea
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-900 transition-colors"
                title="Delete this thumbnail idea"
              >
                <Trash2 size={13} />
              </button>
            )
          )}
        </div>
      </div>

      {/* Quick controls (beginner-friendly) */}
      <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <PromptQuickControls
          prompt={concept.visualPrompt}
          onChange={(next) => handleUpdateConceptPrompt(concept.id, next)}
        />

        {/* Advanced: the raw prompt */}
        <div className="pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="w-full flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Edit3 size={13} />
              Advanced: edit prompt text
            </span>
            <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleEnhanceConceptPrompt(concept)}
                  disabled={isEnhancingThis || Boolean(generatingThumbId)}
                  className="text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 transition-all font-medium disabled:opacity-50"
                  title="Rewrite this prompt to be brighter and bolder so it reads on small screens"
                >
                  {isEnhancingThis ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-zinc-300" />
                      <span>Enhancing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} className="text-zinc-300" />
                      <span>Enhance Prompt</span>
                    </>
                  )}
                </button>

                {concept.originalPrompt && concept.originalPrompt !== concept.visualPrompt && (
                  <button
                    type="button"
                    onClick={() => handleResetConceptPrompt(concept.id)}
                    className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 transition-colors"
                    title="Reset prompt back to AI generated baseline"
                  >
                    <Undo2 size={12} />
                    <span>Reset</span>
                  </button>
                )}

                <CopyButton
                  text={concept.visualPrompt}
                  copyKey={`prompt_${concept.id}`}
                  label="Prompt"
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 transition-colors"
                  buttonText="Copy"
                  copiedText="Copied"
                  iconSize={12}
                />
              </div>

              <textarea
                rows={5}
                value={concept.visualPrompt}
                onChange={(e) => handleUpdateConceptPrompt(concept.id, e.target.value)}
                placeholder="Describe one big subject, the key emotion, and two contrasting colors..."
                className="w-full text-xs font-mono leading-relaxed bg-zinc-950 border border-zinc-700/80 focus:border-zinc-500 rounded-xl text-zinc-100 p-3.5 focus:outline-none resize-y min-h-[110px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Bar: Generate Button */}
      <div className=" pt-2">
        <div className="text-xxs text-zinc-400 flex items-center gap-2">
          <span>
            Renders in <strong className="text-white">{project.aspectRatio || '16:9'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap pt-4">
          <ModelSelectorDropdown size="sm" direction="up" />
          <button
            type="button"
            onClick={() => handleGenerateThumbnail(concept)}
            disabled={isGeneratingThis || Boolean(generatingThumbId)}
            className="btn-primary text-xs px-6 py-2.5 flex items-center justify-center gap-2 w-full sm:w-auto font-bold"
          >
            {isGeneratingThis ? (
              <>
                <Loader2 size={15} className="animate-spin text-white" />
                <span>Rendering High-Res Thumbnail...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-zinc-950" />
                <span>
                  {hasImage
                    ? `Re-render (${selectedAIModel?.creditCost ?? 2} cr)`
                    : `Generate Thumbnail (${selectedAIModel?.creditCost ?? 2} cr)`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
