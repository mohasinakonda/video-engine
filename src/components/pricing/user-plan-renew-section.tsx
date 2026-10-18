'use client';

import React from 'react';
import { TrendingUp, Check } from 'lucide-react';
import type { SubscriptionPlan, BillingCycle, PlanTier } from '@/types/subscription';
import { getPlanPrice, quarterlySavingsPercent, getPlanChange } from '@/lib/plan-pricing';

interface UserPlanRenewSectionProps {
  plans: SubscriptionPlan[];
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  /** The user's effective tier (TRIAL once a plan has lapsed). */
  currentTier: PlanTier;
  /** When the current plan ends, in ms. */
  expiresAt?: number;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

export function UserPlanRenewSection({
  plans,
  billingCycle,
  setBillingCycle,
  currentTier,
  expiresAt,
  onSelectPlan,
}: UserPlanRenewSectionProps) {
  const currentPlanName = plans.find((p) => p.id === currentTier)?.name || currentTier;
  const endDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const maxQuarterlySaving = Math.max(0, ...plans.map(quarterlySavingsPercent));

  return (
    <div id="plans-section" className="space-y-4 pt-6 border-t border-bg-border">
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

        <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-surface border border-bg-border">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('quarterly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              billingCycle === 'quarterly'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>3 Months</span>
            {maxQuarterlySaving > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 text-3xs font-bold">
                SAVE UP TO {maxQuarterlySaving}%
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const rawPrice = getPlanPrice(plan, billingCycle);
          const change = getPlanChange(currentTier, plan.id);
          const isCurrent = change === 'renew';
          const isDowngrade = change === 'downgrade';
          const monthlyEquivalent = plan.priceMonthly * 3;
          const savingPercent = billingCycle === 'quarterly' ? quarterlySavingsPercent(plan) : 0;

          return (
            <div
              key={plan.id}
              className={`p-6 rounded-xl border transition-all flex flex-col shadow-xl card-interactive ${
                isCurrent
                  ? 'bg-bg-elevated border-2 border-emerald-500 ring-1 ring-emerald-500/30'
                  : plan.popular
                  ? 'bg-bg-surface border-2 border-emerald-500/60'
                  : 'bg-bg-surface border-bg-border hover:border-bg-border-strong'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white text-base">{plan.name}</span>
                {isCurrent && (
                  <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active Plan
                  </span>
                )}
              </div>

              <div className="mb-4">
                <span className="text-3xl font-extrabold text-white">৳{rawPrice}</span>
                <span className="text-xs text-zinc-400"> / {billingCycle === 'quarterly' ? '3 months' : billingCycle}</span>
                {savingPercent > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wide">
                      Save {savingPercent}%
                    </span>
                    <span className="text-xs line-through text-zinc-500 font-mono">৳{monthlyEquivalent}</span>
                    <span className="text-[11px] font-semibold text-emerald-400">
                      ৳{monthlyEquivalent - rawPrice} less
                    </span>
                  </div>
                )}
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

              {isDowngrade ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 rounded-lg font-bold text-xs bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed"
                  >
                    Downgrade unavailable
                  </button>
                  <p className="text-[11px] text-zinc-500 text-center">
                    Available after your {currentPlanName} plan ends{endDate ? ` on ${endDate}` : ''}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => onSelectPlan(plan)}
                  className={`w-full py-2.5 rounded-lg font-bold text-xs transition-all ${
                    isCurrent
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 shadow-sm'
                      : 'bg-white hover:bg-zinc-200 text-zinc-950 shadow-md'
                  }`}
                >
                  {isCurrent ? 'Renew This Plan' : change === 'upgrade' ? `Upgrade to ${plan.name}` : `Choose ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
