'use client';

import React from 'react';
import { TrendingUp, Check } from 'lucide-react';
import type { SubscriptionPlan, BillingCycle, UserSubscription } from '@/types/subscription';

interface UserPlanRenewSectionProps {
  plans: SubscriptionPlan[];
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  userSub: UserSubscription | null;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

export function UserPlanRenewSection({
  plans,
  billingCycle,
  setBillingCycle,
  userSub,
  onSelectPlan,
}: UserPlanRenewSectionProps) {
  return (
    <div id="plans-section" className="space-y-4 pt-6 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-400" />
            Renew or Change Subscription Plan
          </h2>
          <p className="text-xs text-zinc-400">
            Switch to a higher quota tier or extend your existing monthly subscription
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('quarterly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              billingCycle === 'quarterly'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>3 Months</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-zinc-950 text-[9px] font-bold">
              SAVE
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const rawPrice =
            billingCycle === 'quarterly'
              ? (plan.priceQuarterly ?? (plan.priceYearly ? Math.round(plan.priceYearly / 4) : Math.round(plan.priceMonthly * 3 * 0.9)))
              : billingCycle === 'yearly'
              ? (plan.priceYearly ?? (plan.priceQuarterly ? plan.priceQuarterly * 4 : plan.priceMonthly * 10))
              : plan.priceMonthly;
          const isCurrent = userSub?.tier === plan.id && userSub?.status === 'ACTIVE';

          return (
            <div
              key={plan.id}
              className={`p-6 rounded-3xl border transition-all flex flex-col shadow-xl ${
                isCurrent
                  ? 'bg-zinc-850/60 border-2 border-emerald-500 ring-1 ring-emerald-500/30'
                  : plan.popular
                  ? 'bg-zinc-900/90 border-2 border-emerald-500/60'
                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white text-base">{plan.name}</span>
                {isCurrent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active Plan
                  </span>
                )}
              </div>

              <div className="mb-4">
                <span className="text-3xl font-extrabold text-white">৳{rawPrice}</span>
                <span className="text-xs text-zinc-400"> / {billingCycle === 'quarterly' ? '3 months' : billingCycle}</span>
                <p className="text-xs text-emerald-400 font-semibold mt-1">
                  {plan.creditsPerMonth.toLocaleString()} Credits / month
                </p>
              </div>

              <ul className="space-y-2 text-xs text-zinc-300 flex-1 mb-6">
                {plan.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onSelectPlan(plan)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isCurrent
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 shadow-sm'
                    : 'bg-white hover:bg-zinc-200 text-zinc-950 shadow-md'
                }`}
              >
                {isCurrent ? 'Renew This Plan' : `Switch to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
