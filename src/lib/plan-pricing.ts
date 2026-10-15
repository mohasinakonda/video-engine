/**
 * Single source of truth for subscription price / credit math per billing cycle.
 * Used by every pricing UI and by the server payment route, so what a user sees
 * is exactly what they are charged and credited.
 */

import type { BillingCycle, SubscriptionPlan } from '@/types/subscription';

export const BILLING_CYCLES: readonly BillingCycle[] = ['monthly', 'quarterly'];

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && (BILLING_CYCLES as readonly string[]).includes(value);
}

export function cycleMonths(cycle: BillingCycle): number {
  return cycle === 'quarterly' ? 3 : 1;
}

/** Fallback quarterly price when the admin hasn't set one: 3 months at 10% off. */
export function defaultQuarterlyPrice(priceMonthly: number): number {
  return Math.round(priceMonthly * 3 * 0.9);
}

export function getPlanPrice(
  plan: Pick<SubscriptionPlan, 'priceMonthly' | 'priceQuarterly'>,
  cycle: BillingCycle
): number {
  if (cycle === 'quarterly') return plan.priceQuarterly ?? defaultQuarterlyPrice(plan.priceMonthly);
  return plan.priceMonthly;
}

export function getPlanCredits(plan: Pick<SubscriptionPlan, 'creditsPerMonth'>, cycle: BillingCycle): number {
  return (plan.creditsPerMonth || 0) * cycleMonths(cycle);
}

export function cycleLabel(cycle: BillingCycle): string {
  return cycle === 'quarterly' ? '3 months' : 'month';
}

/**
 * Rough credit cost of one typical video, used only for marketing estimates
 * ("~N videos", "~৳X per video"). A ~3 minute video at balanced pacing is
 * ~28 scenes × 2 credits/image + premium voiceover (~3 credits/min), plus
 * 15 credits when the YouTube Launch Kit is generated.
 */
export const EST_CREDITS_PER_VIDEO = { min: 70, avg: 80, max: 90 } as const;

export function estimateVideoCount(credits: number): { min: number; max: number } {
  return {
    min: Math.floor(credits / EST_CREDITS_PER_VIDEO.max),
    max: Math.floor(credits / EST_CREDITS_PER_VIDEO.min),
  };
}

export function estimateCostPerVideo(price: number, credits: number): number {
  if (credits <= 0) return 0;
  return Math.round(price / (credits / EST_CREDITS_PER_VIDEO.avg));
}

/** Percent saved by paying quarterly instead of 3× monthly (0 when no saving). */
export function quarterlySavingsPercent(plan: Pick<SubscriptionPlan, 'priceMonthly' | 'priceQuarterly'>): number {
  const full = plan.priceMonthly * 3;
  if (full <= 0) return 0;
  return Math.max(0, Math.round((1 - getPlanPrice(plan, 'quarterly') / full) * 100));
}

/** Cheapest plan whose monthly credits cover `videosPerMonth`; the biggest plan if none does. */
export function recommendPlanForVideos<T extends Pick<SubscriptionPlan, 'creditsPerMonth' | 'priceMonthly'>>(
  plans: T[],
  videosPerMonth: number
): T | undefined {
  const sorted = [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly);
  const needed = videosPerMonth * EST_CREDITS_PER_VIDEO.avg;
  return sorted.find((p) => p.creditsPerMonth >= needed) ?? sorted[sorted.length - 1];
}

/** Spoken narration averages ~150 words/min ≈ 900 characters/min. */
export const VOICE_CHARS_PER_MINUTE = 900;

/** Fallback chars-per-credit for the default voice model when the live rate can't be loaded. */
export const DEFAULT_VOICE_CHARS_PER_CREDIT = 300;

/** Minutes of voiceover a credit balance buys if spent on voice alone. */
export function estimateVoiceMinutes(credits: number, charsPerCredit: number): number {
  return Math.floor((credits * charsPerCredit) / VOICE_CHARS_PER_MINUTE);
}

export function formatVoiceDuration(minutes: number): string {
  if (minutes < 120) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hours`;
}
