'use client';

import React from 'react';
import { Sparkles, Check, ArrowRight } from 'lucide-react';
import { validateAndApplyPromoCode } from '@/lib/subscription-store';
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
      <div className="flex justify-center items-center gap-3">
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            billingCycle === 'monthly'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Monthly Billing
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle('yearly')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            billingCycle === 'yearly'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Yearly Billing</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase">
            Save 20%
          </span>
        </button>
      </div>

      {/* 3 Core Subscription Cards */}
      <div id="plans-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan) => {
          const rawPrice = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
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

          const estVideoCount =
            plan.id === 'STARTER' ? '15–20' : plan.id === 'CREATOR' ? '40–50' : '100+';
          const estCostPerVid = Math.round(
            (billingCycle === 'yearly' ? plan.priceYearly / 12 : plan.priceMonthly) /
              (plan.id === 'STARTER' ? 18 : plan.id === 'CREATOR' ? 45 : 100)
          );

          return (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`relative flex flex-col rounded-3xl p-6 sm:p-8 transition-all ${
                isRecommended
                  ? 'bg-zinc-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                  : plan.popular
                  ? 'bg-zinc-900 border-2 border-emerald-500/70 shadow-2xl'
                  : 'bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {isRecommended ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-zinc-950 font-bold text-xs uppercase tracking-wider shadow-md flex items-center gap-1">
                  <Sparkles size={12} />
                  Recommended for Your Output
                </div>
              ) : plan.badge ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider shadow-md">
                  {plan.badge}
                </div>
              ) : null}

              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    ~{estVideoCount} Full Videos
                  </span>
                </div>

                <p className="text-xs text-zinc-400 mt-1.5">
                  {plan.creditsPerMonth} image credits / month
                </p>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">৳{displayPrice}</span>
                  <span className="text-xs text-zinc-400">
                    / {billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                  {displayPrice < rawPrice && (
                    <span className="text-xs line-through text-zinc-500 font-mono">
                      ৳{rawPrice}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="text-emerald-400 font-semibold font-mono">
                    ~৳{estCostPerVid} per video
                  </span>
                  <span>·</span>
                  <span className="text-zinc-400">Watermark Free</span>
                </div>
              </div>

              <ul className="space-y-3 text-sm text-zinc-300 flex-1 mb-8">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onSelectPlan(plan)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  isRecommended || plan.popular
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-white hover:bg-zinc-200 text-zinc-950'
                }`}
              >
                <span>Choose {plan.name}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
