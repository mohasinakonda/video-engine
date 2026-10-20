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
  /** Analyzing any channel or video; missing on older servers. */
  audit?: { enabled: boolean; hasAccess: boolean; costs: { video: number; channel: number } };
}

export const GROUP_INFO = {
  direct: { label: 'Direct', help: 'Same audience and same topics as you' },
  adjacent: { label: 'Adjacent', help: 'Overlapping audience, different topics or formats' },
  format: { label: 'Format', help: 'Different topics, but a format or style worth learning from' },
} as const;

export type { ChannelProfile, Outlier, ResearchResult, ResearchStage, ResearchWindow } from '@/lib/youtube/discover/types';
export type { MarketPatterns, TopicSummary } from '@/lib/youtube/discover/types';
export { FORMAT_LABELS, MECHANISM_LABELS } from '@/lib/youtube/discover/formats';
export type { GapType, Level, Momentum, Opportunity } from '@/lib/youtube/discover/types';
export type { OutputLanguage } from '@/lib/youtube/discover/types';
