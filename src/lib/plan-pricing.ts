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
