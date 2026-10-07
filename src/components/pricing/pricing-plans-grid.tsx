'use client';

import React from 'react';
import { validateAndApplyPromoCode } from '@/lib/subscription-store';
import { PricingPlanCard } from '@/components/pricing/pricing-plan-card';
import type { SubscriptionPlan, BillingCycle, AdminSettings } from '@/types/subscription';

interface PricingPlansGridProps {
  plans: SubscriptionPlan[];
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  promoAppliedCode: string;
  settings: AdminSettings | null;
  calculatorVideos: number;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

export function PricingPlansGrid({
  plans,
  billingCycle,
  setBillingCycle,
  promoAppliedCode,
  settings,
  calculatorVideos,
  onSelectPlan,
}: PricingPlansGridProps) {
  return (
    <div className="space-y-8">
      {/* Billing Cycle Toggle */}
      <div className="flex justify-center items-center">
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

      {/* 3 Core Subscription Cards */}
      <div id="plans-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan) => {
          const rawPrice =
            billingCycle === 'quarterly'
              ? (plan.priceQuarterly ?? (plan.priceYearly ? Math.round(plan.priceYearly / 4) : Math.round(plan.priceMonthly * 3 * 0.9)))
              : billingCycle === 'yearly'
                ? (plan.priceYearly ?? (plan.priceQuarterly ? plan.priceQuarterly * 4 : plan.priceMonthly * 10))
                : plan.priceMonthly;
          let displayPrice = rawPrice;
          if (promoAppliedCode) {
            const res = validateAndApplyPromoCode(promoAppliedCode, rawPrice);
            if (res.valid && res.discountedPriceBDT !== undefined) {
              displayPrice = res.discountedPriceBDT;
            }
          } else if (settings?.globalDiscountActive && settings.globalDiscountPercent > 0) {
            displayPrice = Math.round(rawPrice * (1 - settings.globalDiscountPercent / 100));
          }

          const calcRecommendedTier =
            calculatorVideos <= 18 ? 'STARTER' : calculatorVideos <= 45 ? 'CREATOR' : 'STUDIO';
          const isRecommended = plan.id === calcRecommendedTier;

          const estCostPerVid = Math.round(
            (billingCycle === 'quarterly' ? rawPrice / 3 : billingCycle === 'yearly' ? rawPrice / 12 : rawPrice) /
            (plan.id === 'STARTER' ? 15 : plan.id === 'CREATOR' ? 40 : 80)
          );

          const isHighlighted = isRecommended || plan.popular;

          return (
            <PricingPlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              displayPrice={displayPrice}
              rawPrice={rawPrice}
              isHighlighted={isHighlighted}
              isRecommended={isRecommended}
              estCostPerVid={estCostPerVid}
              onSelectPlan={onSelectPlan}
            />
          );
        })}
      </div>
    </div>
  );
}
