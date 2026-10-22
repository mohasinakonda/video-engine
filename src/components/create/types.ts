/** Browser-side shapes for Create (no tokens or server internals). */
import type { UsageKey } from '@/lib/youtube/create/bundle';
export type { ProjectStatus, Thesis, VideoProject } from '@/lib/youtube/create/types';
export type { VideoBrief } from '@/lib/youtube/create/brief';
export type { VideoScript, ScriptSection, Claim, ClaimKind } from '@/lib/youtube/create/script';
export type { UsageKey } from '@/lib/youtube/create/bundle';
export type { StructureBeat } from '@/lib/youtube/create/structures';

export interface CreateConfig {
  enabled: boolean;
  hasAccess: boolean;
  adminPreview: boolean;
  tier: string;
  allowedPlans: string[];
  topicSearchesPerDay: number;
  bundle: { cost: number; includes: Record<UsageKey, number> };
  costs: { brief: number; script: number; scriptSection: number; packaging: number; topicSearch: number };
}

export const STATUS_LABELS = {
  DRAFT: 'Draft',
  BRIEF_READY: 'Brief ready',
  SCRIPT_READY: 'Script ready',
  PACKAGED: 'Packaged',
  ARCHIVED: 'Archived',
} as const;
