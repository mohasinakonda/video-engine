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
    <section id="pricing" className="py-24 px-6 border-b border-[#2e2e2e] bg-[#09090b]">
      <div className="max-w-6xl mx-auto space-y-12">

        <div className="text-center max-w-xl mx-auto space-y-3">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
            Transparent Pricing
          </p>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Simple, Predictable Creator Pricing
          </h2>
          <p className="text-xs text-zinc-400">
            Pay easily via bKash, Nagad, or Bank Transfer. Instant WhatsApp activation.
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="pt-2 flex justify-center items-center gap-3">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-zinc-800 text-white border border-[#2e2e2e]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-zinc-800 text-white border border-[#2e2e2e]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Yearly</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        {loading && plans.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col rounded-3xl p-7 border border-[#2e2e2e] bg-zinc-900/40 animate-pulse min-h-[420px] justify-between"
              >
                <div className="space-y-4">
                  <div className="h-6 bg-zinc-800 rounded w-1/3" />
                  <div className="h-9 bg-zinc-800 rounded w-1/2" />
                  <div className="h-4 bg-zinc-800 rounded w-2/3" />
                  <div className="space-y-2 pt-4">
                    <div className="h-3 bg-zinc-800/60 rounded w-full" />
                    <div className="h-3 bg-zinc-800/60 rounded w-5/6" />
                    <div className="h-3 bg-zinc-800/60 rounded w-4/6" />
                  </div>
                </div>
                <div className="h-10 bg-zinc-800 rounded-xl w-full" />
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
                      ? 'bg-zinc-900 border-emerald-500/50 shadow-2xl relative'
                      : 'bg-zinc-900/40 border-[#2e2e2e] hover:border-[#3e3e3e]'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-white text-lg">{plan.name}</span>
                    {plan.badge && !plan.popular && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-850 text-zinc-300 border border-[#2e2e2e]">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div className="mb-6 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-white">৳{price}</span>
                    <span className="text-xs text-zinc-400">
                      / {billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-400 font-semibold mb-6 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    {plan.creditsPerMonth} Image Credits / month
                  </p>

                  <ul className="space-y-3 text-xs text-zinc-300 flex-1 mb-8">
                    {plan.features?.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/pricing"
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all ${
                      plan.popular
                        ? 'bg-white hover:bg-zinc-200 text-zinc-950 shadow-md'
                        : 'bg-zinc-850 hover:bg-zinc-800 text-white border border-[#2e2e2e]'
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
            className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 underline"
          >
            Have a Promo Code or Need Custom Top-ups? Visit Full Pricing Page &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
};
