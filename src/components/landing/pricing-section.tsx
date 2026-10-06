'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Check } from 'lucide-react';
import { usePricingPlans } from '@/hooks/use-pricing';
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

          {/* Monthly / Yearly Toggle */}
          <div className="pt-2 flex justify-center items-center">
            <div className="p-1 rounded-2xl bg-[#F0ECE4] border border-[#E5E0D8] inline-flex items-center gap-1">
              <button
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
              const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-3xl p-7 border transition-all ${
                    plan.popular
                      ? 'bg-white border-2 border-[#E05A30] shadow-xl shadow-[#E05A30]/10 relative'
                      : 'bg-white border-[#E5E0D8] hover:border-zinc-300 shadow-sm'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-[#E05A30] text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-zinc-950 text-lg">{plan.name}</span>
                    {plan.badge && !plan.popular && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div className="mb-6 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-zinc-950">৳{price}</span>
                    <span className="text-xs text-zinc-500">
                      / {billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>

                  <p className="text-xs text-[#E05A30] font-semibold mb-6 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    {plan.creditsPerMonth} Image Credits / month
                  </p>

                  <ul className="space-y-3 text-xs text-zinc-700 flex-1 mb-8">
                    {plan.features?.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/pricing"
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all ${
                      plan.popular
                        ? 'bg-[#E05A30] hover:bg-[#C84C25] text-white shadow-md shadow-[#E05A30]/20'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
                    }`}
                  >
                    Select {plan.name} Plan
                  </Link>
                </div>
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
