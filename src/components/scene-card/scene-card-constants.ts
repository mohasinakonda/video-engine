import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  Compass,
  Sparkles,
  Users,
  Landmark,
  CloudSun,
  Mountain,
  type LucideIcon,
} from 'lucide-react';
import type { SceneItem, MotionProfile, ShotType } from '@/types';

// ─── Motion Profile Labels ─────────────────────────────────────────────────────

export const MOTION_LABELS: Record<MotionProfile, { label: string; icon: React.ReactNode }> = {
  zoom_in: { label: 'Zoom In', icon: React.createElement(ZoomIn, { size: 10 }) },
  zoom_out: { label: 'Zoom Out', icon: React.createElement(ZoomOut, { size: 10 }) },
  pan_left: { label: 'Pan Left', icon: React.createElement(ArrowLeft, { size: 10 }) },
  pan_right: { label: 'Pan Right', icon: React.createElement(ArrowRight, { size: 10 }) },
};

// ─── Shot Type / B-Roll Metadata ───────────────────────────────────────────────

export const SHOT_TYPE_CONFIG: Record<
  ShotType,
  {
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    badgeColor: string;
  }
> = {
  AERIAL_GEOMETRY: {
    label: 'Drone / Aerial Geometry',
    shortLabel: 'Aerial',
    icon: Compass,
    badgeColor: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
  },
  MACRO_TEXTURE: {
    label: 'Macro & Texture Detail',
    shortLabel: 'Macro',
    icon: Sparkles,
    badgeColor: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
  },
  CULTURAL_HUMAN: {
    label: 'Culture & Daily Life',
    shortLabel: 'Culture',
    icon: Users,
    badgeColor: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
  },
  HISTORICAL_HERITAGE: {
    label: 'History & Heritage',
    shortLabel: 'Heritage',
    icon: Landmark,
    badgeColor: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
  },
  ATMOSPHERIC_MOOD: {
    label: 'Atmospheric Mood & Light',
    shortLabel: 'Mood',
    icon: CloudSun,
    badgeColor: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
  },
  WIDE_ESTABLISHING: {
    label: 'Wide Establishing Shot',
    shortLabel: 'Establishing',
    icon: Mountain,
    badgeColor: 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800',
  },
};

// ─── Status Colors & Labels ───────────────────────────────────────────────────

export function statusClass(status: SceneItem['status']): string {
  switch (status) {
    case 'PENDING':
      return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    case 'GENERATING_IMAGE':
      return 'bg-zinc-800 text-zinc-200 border-zinc-700';
    case 'IMAGE_READY':
      return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50';
    case 'GENERATING_MOTION':
      return 'bg-zinc-800 text-zinc-200 border-zinc-700';
    case 'MOTION_READY':
      return 'bg-zinc-800 text-zinc-100 border-zinc-600';
    case 'FAILED':
      return 'bg-red-950/40 text-red-400 border-red-900/50';
    default:
      return 'bg-zinc-900 text-zinc-400 border-zinc-800';
  }
}

export function statusLabel(status: SceneItem['status']): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'GENERATING_IMAGE':
      return 'Generating…';
    case 'IMAGE_READY':
      return 'Image Ready';
    case 'GENERATING_MOTION':
      return 'Animating…';
    case 'MOTION_READY':
      return 'Motion Ready';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}

// ─── Prompt Modifier Presets ───────────────────────────────────────────────────

export interface PromptModifier {
  label: string;
  text: string;
  colorClass: string;
}

export const PROMPT_MODIFIERS: PromptModifier[] = [
  {
    label: '+ Golden Hour',
    text: 'warm golden hour sunbeams, soft rim light',
    colorClass: 'text-amber-300/90',
  },
  {
    label: '+ 35mm Lens',
    text: 'shot on 35mm anamorphic cinema lens, shallow depth of field',
    colorClass: 'text-cyan-300/90',
  },
  {
    label: '+ Chiaroscuro',
    text: 'dramatic chiaroscuro lighting, deep shadows',
    colorClass: 'text-zinc-300',
  },
  {
    label: '+ Macro',
    text: 'extreme tactile macro close-up with razor-sharp surface texture',
    colorClass: 'text-emerald-300/90',
  },
  {
    label: '+ Drone Aerial',
    text: 'cinematic top-down aerial drone perspective with geometric framing',
    colorClass: 'text-purple-300/90',
  },
];

// ─── Aspect Ratio Dimension Helper ─────────────────────────────────────────────

export function getAspectRatioLabel(aspectRatio?: '16:9' | '9:16' | '1:1'): string {
  switch (aspectRatio) {
    case '9:16':
      return '1080 × 1920 · 9:16';
    case '1:1':
      return '1080 × 1080 · 1:1';
    case '16:9':
    default:
      return '1920 × 1080 · 16:9';
  }
}
