import type { GapType, Level, Momentum } from './types';

export const GAP_LABELS: Record<GapType, { text: string; help: string }> = {
  coverage: { text: 'You haven’t covered this', help: 'Competitors have standouts here; you have little or nothing in the analyzed sample.' },
  emerging: { text: 'Emerging', help: 'Recent activity on a topic that isn’t crowded yet. Requires validation.' },
  format: { text: 'Format gap', help: 'You cover the topic, but not in the format that works for others.' },
  packaging: { text: 'Title gap', help: 'You cover the topic, but standouts package it differently.' },
  audience_problem: { text: 'Viewer need', help: 'Several competitors answer a viewer problem you haven’t (read by AI).' },
};

export const MOMENTUM_LABELS: Record<Momentum, string> = {
  recent: 'Rising lately',
  durable: 'Steady demand',
  one_off: 'One-off spike',
  none: 'No clear trend',
};

export const LEVEL_TEXT: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export const SCORE_PARTS: { key: 'channelFit' | 'competitorPerformance' | 'momentum' | 'contentGap' | 'competition' | 'productionFit' | 'phase1'; label: string }[] = [
  { key: 'channelFit', label: 'Fits your channel' },
  { key: 'competitorPerformance', label: 'How well it did for others' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'contentGap', label: 'Gap on your channel' },
  { key: 'competition', label: 'Room to compete' },
  { key: 'productionFit', label: 'Easy to produce' },
  { key: 'phase1', label: 'Matches your diagnosis' },
];

export const SOURCE_LABELS = {
  youtube_public: 'Public YouTube data',
  youtube_analytics: 'Your YouTube Analytics',
  calculated: 'Calculated by us',
} as const;
