import type { ContentFormat } from '../discover/formats';
import type { GapType, Level, Momentum, OpportunityScores, ResearchWindow } from '../discover/types';
import type { Confidence } from '../types';

export const PROJECT_STATUSES = [
  'DRAFT',
  'BRIEF_READY',
  'SCRIPT_READY',
  'PACKAGED',
  'ARCHIVED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * What Discover expected when the project started.
 * Scores, levels and labels only: no competitor titles, views or ratios (YouTube's 30-day
 * rule for other channels' data).
 */
export interface Thesis {
  version: 1;
  opportunityId: string;
  topic: string;
  recommendedAngle: string | null;
  recommendedFormat: ContentFormat | null;
  gapTypes: GapType[];
  momentum: Momentum;
  competition: Level;
  channelFit: Level;
  productionDifficulty: Level | null;
  confidence: Confidence;
  scores: OpportunityScores;
  signalsUsed: number;
  window: ResearchWindow;
  researchedAt: string;
}

export interface ProjectError {
  step: string;
  code: string;
  message: string;
  at: string;
}

/** A project as the browser sees it. */
export interface VideoProject {
  id: string;
  origin: 'opportunity' | 'manual';
  status: ProjectStatus;
  archivedFrom: ProjectStatus | null;
  lastError: ProjectError | null;
  title: string;
  thesis: Thesis | null;
  /** Filled by later milestones (brief C2, script C3, packaging C4). */
  brief: unknown;
  script: unknown;
  packaging: unknown;
  /** When the video's price was paid; null for projects made before, which pay per action. */
  unlockedAt: string | null;
  /** AI runs used of each kind, against the allowances the price includes. */
  usage: Partial<Record<'brief' | 'script' | 'section' | 'packaging' | 'topicSearch', number>>;
  createdAt: string;
  updatedAt: string;
}
