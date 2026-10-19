/** Browser-side shapes returned by /api/youtube/discover/* (no tokens, ever). */
export type {
  CompetitorCandidate,
  CompetitorGroup,
  DiscoveryResult,
  DiscoveryStage,
  PublicChannel,
  Relevance,
  WatchlistEntry,
} from '@/lib/youtube/discover/types';

export interface DiscoverConfig {
  enabled: boolean;
  hasAccess: boolean;
  adminPreview: boolean;
  tier: string;
  allowedPlans: string[];
  costs: { discovery: number; research: number; opportunity: number };
  maxCompetitors: number;
  search: { available: boolean; phrasesPerRun: number; userRunsLeft: number; resetsAt: string };
}

export const GROUP_INFO = {
  direct: { label: 'Direct', help: 'Same audience and same topics as you' },
  adjacent: { label: 'Adjacent', help: 'Overlapping audience, different topics or formats' },
  format: { label: 'Format', help: 'Different topics, but a format or style worth learning from' },
} as const;
