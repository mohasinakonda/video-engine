'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePricingPlans } from '@/hooks/use-pricing';
import { PricingPlanCard } from '@/components/pricing/pricing-plan-card';
import type { BillingCycle, SubscriptionPlan } from '@/types/subscription';

export const PricingSection = () => {
  const { plans, isLoading: loading } = usePricingPlans();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  return (
    <section id="pricing" className="py-24 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5]">
      <div className="max-w-6xl mx-auto space-y-12">

        <div className="text-center max-w-xl mx-auto space-y-3">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            TRANSPARENT PRICING
          </p>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
            Simple, Predictable Creator Pricing
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">
            Pay easily via bKash, Nagad, or Bank Transfer. Instant WhatsApp activation.
          </p>

          {/* Monthly / Quarterly Toggle */}
          <div className="pt-2 flex justify-center items-center">
            <div className="p-1 rounded-2xl bg-[#F0ECE4] border border-[#E5E0D8] inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${billingCycle === 'monthly'
                    ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                  }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('quarterly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${billingCycle === 'quarterly'
                    ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                  }`}
              >
                <span>3 Months</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Save Discount
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        {loading && plans.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col rounded-3xl p-7 border border-[#E5E0D8] bg-white animate-pulse min-h-[420px] justify-between shadow-sm"
              >
                <div className="space-y-4">
                  <div className="h-6 bg-zinc-200 rounded w-1/3" />
                  <div className="h-9 bg-zinc-200 rounded w-1/2" />
                  <div className="h-4 bg-zinc-200 rounded w-2/3" />
                  <div className="space-y-2 pt-4">
                    <div className="h-3 bg-zinc-100 rounded w-full" />
                    <div className="h-3 bg-zinc-100 rounded w-5/6" />
                    <div className="h-3 bg-zinc-100 rounded w-4/6" />
                  </div>
                </div>
                <div className="h-10 bg-zinc-200 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan: SubscriptionPlan) => {
              const price =
                billingCycle === 'quarterly'
                  ? (plan.priceQuarterly ?? (plan.priceYearly ? Math.round(plan.priceYearly / 4) : Math.round(plan.priceMonthly * 3 * 0.9)))
                  : billingCycle === 'yearly'
                    ? (plan.priceYearly ?? (plan.priceQuarterly ? plan.priceQuarterly * 4 : plan.priceMonthly * 10))
                    : plan.priceMonthly;

              return (
                <PricingPlanCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  displayPrice={price}
                  rawPrice={price}
                  isHighlighted={plan.popular}
                  actionHref="/pricing"
                  actionLabel={`Select ${plan.name} Plan`}
                />
              );
            })}
          </div>
        )}

        <div className="text-center pt-2">
          <Link
            href="/pricing"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline"
          >
            Have a Promo Code or Need Custom Top-ups? Visit Full Pricing Page &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
};
