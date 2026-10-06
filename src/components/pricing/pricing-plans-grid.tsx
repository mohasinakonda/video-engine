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
      <div className="flex justify-center items-center">
        <div className="p-1 rounded-2xl bg-[#F0ECE4] border border-[#E5E0D8] inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <span>Yearly</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Save 20%
            </span>
          </button>
        </div>
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

          const isHighlighted = isRecommended || plan.popular;

          return (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`relative flex flex-col rounded-3xl p-7 transition-all ${
                isHighlighted
                  ? 'bg-white border-2 border-[#E05A30] shadow-xl shadow-[#E05A30]/10'
                  : 'bg-white border border-[#E5E0D8] hover:border-zinc-300 shadow-sm'
              }`}
            >
              {isRecommended ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#E05A30] text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles size={12} />
                  Recommended
                </div>
              ) : plan.popular ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#E05A30] text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                  Most Popular
                </div>
              ) : plan.badge ? (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#F4F0EA] border border-[#E5E0D8] text-zinc-700 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                  {plan.badge}
                </div>
              ) : null}

              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-950">{plan.name}</h3>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ~{estVideoCount} Videos
                  </span>
                </div>

                <p className="text-xs text-[#E05A30] font-semibold mt-1.5 flex items-center gap-1">
                  <Sparkles size={13} />
                  <span>{plan.creditsPerMonth} Image Credits / month</span>
                </p>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-zinc-950">৳{displayPrice}</span>
                  <span className="text-xs text-zinc-500">
                    / {billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                  {displayPrice < rawPrice && (
                    <span className="text-xs line-through text-zinc-400 font-mono">
                      ৳{rawPrice}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="text-emerald-700 font-semibold font-mono">
                    ~৳{estCostPerVid} per video
                  </span>
                  <span>·</span>
                  <span>Watermark Free</span>
                </div>
              </div>

              <ul className="space-y-3 text-xs text-zinc-700 flex-1 mb-8">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onSelectPlan(plan)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  isHighlighted
                    ? 'bg-[#E05A30] hover:bg-[#C84C25] text-white shadow-md shadow-[#E05A30]/20'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
                }`}
              >
                <span>Choose {plan.name}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
