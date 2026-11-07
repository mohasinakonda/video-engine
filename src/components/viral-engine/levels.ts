import type { CSSProperties } from 'react';
import type { Level } from '@/lib/viral-engine/types';

/** Red / yellow / green, with a stripe on yellow so the levels don't rely on hue alone. */
export const LEVEL_STYLE: Record<Level, { label: string; text: string; badge: string; block: CSSProperties; dot: string }> = {
  bad: {
    label: 'Problem',
    text: 'text-rose-300',
    badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    block: { background: '#f87171' },
    dot: '#f87171',
  },
  warn: {
    label: 'Check',
    text: 'text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    block: { background: 'repeating-linear-gradient(135deg, #fbbf24 0 6px, #a16207 6px 12px)' },
    dot: '#fbbf24',
  },
  good: {
    label: 'Working',
    text: 'text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    block: { background: '#34d399' },
    dot: '#34d399',
  },
};

export const EVIDENCE_LABEL: Record<string, string> = {
  file: 'File',
  motion: 'Movement',
  sound: 'Sound level',
  speech: 'Speech',
  vision: 'Frames (AI)',
  retention: 'Your retention',
  baseline: 'Your channel',
  topic: 'Topic match (AI)',
};
