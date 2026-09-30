import React from 'react';
import { PROMPT_MODIFIERS, type PromptModifier } from './scene-card-constants';

interface PromptModifierChipsProps {
  onAppend: (modifierText: string) => void;
  modifiers?: PromptModifier[];
  size?: 'xs' | 'sm';
}

export default function PromptModifierChips({
  onAppend,
  modifiers = PROMPT_MODIFIERS,
  size = 'xs',
}: PromptModifierChipsProps) {
  const isXs = size === 'xs';

  return (
    <div className={`flex flex-wrap ${isXs ? 'items-center gap-1 pt-0.5' : 'gap-1.5'}`}>
      {modifiers.map((mod) => (
        <button
          key={mod.label}
          type="button"
          onClick={() => onAppend(mod.text)}
          className={`rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors ${mod.colorClass} ${
            isXs ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
          }`}
        >
          {mod.label}
        </button>
      ))}
    </div>
  );
}
