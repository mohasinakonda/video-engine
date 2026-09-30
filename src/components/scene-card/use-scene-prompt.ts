import { useState, useEffect, useCallback } from 'react';
import type { ShotType } from '@/types';
import { enhanceScenePrompt } from '@/lib/pollinations';

interface UseScenePromptProps {
  initialPrompt: string;
  fallbackText?: string;
  shotType?: ShotType;
  stylePrompt?: string;
}

export function useScenePrompt({
  initialPrompt,
  fallbackText,
  shotType,
  stylePrompt,
}: UseScenePromptProps) {
  const [promptDraft, setPromptDraft] = useState(initialPrompt);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  useEffect(() => {
    setPromptDraft(initialPrompt);
  }, [initialPrompt]);

  const handleEnhancePrompt = useCallback(async () => {
    const textToEnhance = promptDraft.trim() || fallbackText || initialPrompt;
    if (!textToEnhance || isEnhancingPrompt) return;

    setIsEnhancingPrompt(true);
    try {
      const res = await enhanceScenePrompt(textToEnhance, {
        shotType,
        stylePrompt,
      });
      setPromptDraft(res.visual_prompt);
    } catch (err) {
      console.error('Failed to enhance prompt:', err);
    } finally {
      setIsEnhancingPrompt(false);
    }
  }, [promptDraft, fallbackText, initialPrompt, isEnhancingPrompt, shotType, stylePrompt]);

  const handleAppendModifier = useCallback((modifierText: string) => {
    setPromptDraft((prev) => {
      const trimmed = prev.trim();
      if (trimmed.toLowerCase().includes(modifierText.toLowerCase().slice(0, 15))) {
        return prev;
      }
      const sep = trimmed.endsWith('.') ? ' ' : ', ';
      return `${trimmed}${sep}${modifierText}`;
    });
  }, []);

  return {
    promptDraft,
    setPromptDraft,
    isEnhancingPrompt,
    handleEnhancePrompt,
    handleAppendModifier,
  };
}
