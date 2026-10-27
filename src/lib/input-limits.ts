/**
 * Single source of truth for user text-input limits.
 * Imported by both client components (counters / disabled CTAs) and API
 * routes (hard 400 rejections), so the two can never drift apart.
 */

import type { PlanTier } from '@/types/subscription';

/** Max characters for a full script (project, YouTube kit, Voice Studio) per plan. */
export const SCRIPT_CHAR_LIMITS: Record<PlanTier, number> = {
  TRIAL: 5_000,
  STARTER: 5_000,
  CREATOR: 15_000,
  STUDIO: 30_000,
};

/** Voice Studio "clip" mode is a single short pass regardless of plan. */
export const VOICE_CLIP_MAX_CHARS = 5_000;

/** Fixed limits for short fields — same for every plan. */
export const TEXT_LIMITS = {
  voiceDescription: 500,
  voiceName: 40,
  voicePreviewText: 240,
  voiceTopic: 300,
  customFocus: 300,
  thumbnailPrompt: 1_000,
  scenePrompt: 1_000,
  youtubeTitle: 100,
  youtubeDescription: 5_000,
} as const;

const TIER_LABELS: Record<PlanTier, string> = {
  TRIAL: 'Trial',
  STARTER: 'Starter',
  CREATOR: 'Creator',
  STUDIO: 'Studio',
};

function normalizeTier(tier?: string | null): PlanTier {
  return tier && tier in SCRIPT_CHAR_LIMITS ? (tier as PlanTier) : 'TRIAL';
}

/** Admins always get the highest limit. */
export function getScriptCharLimit(tier?: string | null, isAdmin = false): number {
  if (isAdmin) return SCRIPT_CHAR_LIMITS.STUDIO;
  return SCRIPT_CHAR_LIMITS[normalizeTier(tier)];
}

/** Cheapest plan that unlocks more script characters than `tier`, if any. */
export function getNextScriptTier(tier?: string | null): { tier: PlanTier; label: string; limit: number } | null {
  const current = SCRIPT_CHAR_LIMITS[normalizeTier(tier)];
  const order: PlanTier[] = ['TRIAL', 'STARTER', 'CREATOR', 'STUDIO'];
  const next = order.find((t) => SCRIPT_CHAR_LIMITS[t] > current);
  return next ? { tier: next, label: TIER_LABELS[next], limit: SCRIPT_CHAR_LIMITS[next] } : null;
}

/**
 * Plan tier the user is actually entitled to right now: an expired paid
 * subscription falls back to TRIAL (mirrors deriveSubscription in auth-context).
 */
export function effectiveTier(profile: {
  tier?: string | null;
  subscription_expires_at?: string | null;
} | null | undefined): PlanTier {
  const tier = normalizeTier(profile?.tier);
  if (tier === 'TRIAL' || !profile?.subscription_expires_at) return tier;
  const expiresAt = new Date(profile.subscription_expires_at).getTime();
  return Number.isFinite(expiresAt) && Date.now() > expiresAt ? 'TRIAL' : tier;
}

/** effectiveTier for an app-side UserProfile, whose expiry is in milliseconds. */
export function profileEffectiveTier(profile: {
  tier?: string | null;
  subscriptionExpiresAt?: number | null;
} | null | undefined): PlanTier {
  return effectiveTier({
    tier: profile?.tier,
    subscription_expires_at: profile?.subscriptionExpiresAt ? new Date(profile.subscriptionExpiresAt).toISOString() : null,
  });
}

/**
 * Trim AI-generated text to `max` characters, cutting at the last sentence
 * end (or word) so the result never stops mid-word.
 */
export function clampText(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1).trim();
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.5 ? cut.slice(0, space) : cut).trim();
}

export function scriptTooLongMessage(length: number, limit: number): string {
  return `Script is too long (${length.toLocaleString()} / ${limit.toLocaleString()} characters on your plan).`;
}
