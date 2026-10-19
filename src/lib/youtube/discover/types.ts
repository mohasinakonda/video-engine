import type { Confidence } from '../types';

/** The user's own grouping of a saved competitor (docs/discover-plan.md §3.1). */
export type CompetitorGroup = 'direct' | 'adjacent' | 'format';

export type Relevance = 'high' | 'medium' | 'low';

/** Stages streamed by the discovery run. */
export type DiscoveryStage = 'connect' | 'your_channel' | 'search' | 'candidates' | 'classify' | 'done';

/** Public channel info, fetched fresh from YouTube on every view (never stored). */
export interface PublicChannel {
  id: string;
  title: string;
  thumbnail: string | null;
  url: string;
  subscriberCount: number | null;
  videoCount: number | null;
}

/** A saved watchlist row joined with its fresh public info (null when YouTube no longer returns it). */
export interface WatchlistEntry {
  channelId: string;
  label: string | null;
  group: CompetitorGroup;
  active: boolean;
  addedAt: string;
  channel: PublicChannel | null;
}

/** Measured signals behind a suggestion. All counts come from the analyzed sample. */
export interface CandidateSignals {
  /** Recent titles of theirs that are close to one of your titles. */
  matchingTitles: number;
  titlesChecked: number;
  /** Search phrases (of those run) whose results included this channel. */
  queriesMatched: number;
  queriesRun: number;
  uploadsLast90Days: number;
  /** Share of their checked videos that are 3 minutes or shorter (likely Shorts). */
  shortsShare: number;
  yourShortsShare: number;
}

export interface CompetitorCandidate {
  channel: PublicChannel;
  relevance: Relevance;
  /** 0–1, calculated by us; shown only as the relevance label. */
  relevanceScore: number;
  suggestedGroup: CompetitorGroup;
  confidence: Confidence;
  reasons: string[];
  /** A few of their titles that matched your topics, so the user can judge for themselves. */
  exampleTitles: string[];
  signals: CandidateSignals;
}

export interface DiscoveryResult {
  queries: string[];
  candidates: CompetitorCandidate[];
  /** Channels found by search before filtering. */
  channelsFound: number;
  limitations: string[];
  embeddingModel: string | null;
}
