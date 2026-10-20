/** Browser-side shapes for Create (no tokens or server internals). */
export type { ProjectStatus, Thesis, VideoProject } from '@/lib/youtube/create/types';
export type { VideoBrief } from '@/lib/youtube/create/brief';
export type { VideoScript, ScriptSection, Claim, ClaimKind } from '@/lib/youtube/create/script';
export type { StructureBeat } from '@/lib/youtube/create/structures';

export interface CreateConfig {
  enabled: boolean;
  hasAccess: boolean;
  adminPreview: boolean;
  tier: string;
  allowedPlans: string[];
  costs: { brief: number; script: number; scriptSection: number; packaging: number; performance: number };
}

export const STATUS_LABELS = {
  DRAFT: 'Draft',
  BRIEF_READY: 'Brief ready',
  SCRIPT_READY: 'Script ready',
  PACKAGED: 'Packaged',
  IN_PRODUCTION: 'In production',
  PUBLISHED: 'Published',
  ANALYZING: 'Measuring',
  LEARNED: 'Learned',
  ARCHIVED: 'Archived',
} as const;
