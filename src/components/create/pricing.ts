import type { CreateConfig, UsageKey, VideoProject } from './types';

const SINGLE: Record<UsageKey, (c: CreateConfig) => number> = {
  brief: (c) => c.costs.brief,
  script: (c) => c.costs.script,
  section: (c) => c.costs.scriptSection,
  packaging: (c) => c.costs.packaging,
  topicSearch: (c) => c.costs.topicSearch,
};

/**
 * The small line under an AI button (never on the button). Inside the video's allowance it says
 * how many runs are left (the price was paid once, at the start); past it, or on a project made
 * before, it shows the run's own price.
 */
export interface PriceTag {
  included: boolean;
  left: number;
  note: string | null;
}

export function priceTag(project: Pick<VideoProject, 'unlockedAt' | 'usage'>, config: CreateConfig, key: UsageKey): PriceTag {
  const allowance = config.bundle.includes[key];
  const left = project.unlockedAt ? Math.max(0, allowance - (project.usage?.[key] ?? 0)) : 0;
  if (left > 0) return { included: true, left, note: `Included · ${left} of ${allowance} left` };
  const price = SINGLE[key](config);
  if (price <= 0) return { included: false, left: 0, note: null };
  return { included: false, left: 0, note: project.unlockedAt ? `Uses ${price} credits · the included runs are used up` : `Uses ${price} credits` };
}
