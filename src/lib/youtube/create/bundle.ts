/**
 * One price per video (docs/create-plan.md §20). The price is paid when the project starts and
 * includes a fair number of AI runs of each kind. Past an
 * allowance, or on a project made before this (not unlocked), each run costs its own price. Pure.
 */
import type { CreateSettings } from '../settings';
import type { VideoProject } from './types';

export const USAGE_KEYS = ['brief', 'script', 'section', 'packaging', 'topicSearch'] as const;
export type UsageKey = (typeof USAGE_KEYS)[number];
export type Usage = Partial<Record<UsageKey, number>>;

/** How many runs of each kind the video's price includes. */
export const allowanceOf = (s: CreateSettings, key: UsageKey): number =>
  ({ brief: s.bundleBriefDrafts, script: s.bundleScriptWrites, section: s.bundleSectionRewrites, packaging: s.bundlePackagingRuns, topicSearch: s.bundleTopicSearches })[key];

/** The price of one run outside the allowance (the per-action prices the admin already sets). */
export const singlePriceOf = (s: CreateSettings, key: UsageKey): number =>
  ({ brief: s.briefCreditCost, script: s.scriptCreditCost, section: Math.ceil(s.scriptCreditCost / 2), packaging: s.packagingCreditCost, topicSearch: s.topicSearchCreditCost })[key];

/** Included runs left; 0 for a project that isn't unlocked. */
export function remaining(project: Pick<VideoProject, 'unlockedAt' | 'usage'>, s: CreateSettings, key: UsageKey): number {
  if (!project.unlockedAt) return 0;
  return Math.max(0, allowanceOf(s, key) - (project.usage?.[key] ?? 0));
}

/** What this run costs: nothing while it's included, its own price after. */
export const runCost = (project: Pick<VideoProject, 'unlockedAt' | 'usage'>, s: CreateSettings, key: UsageKey): number =>
  remaining(project, s, key) > 0 ? 0 : singlePriceOf(s, key);

/** Usage after one more successful run. */
export const bump = (project: Pick<VideoProject, 'usage'>, key: UsageKey): Usage => ({ ...(project.usage ?? {}), [key]: (project.usage?.[key] ?? 0) + 1 });
