'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Check, ArrowRight } from 'lucide-react';
import type { SubscriptionPlan, BillingCycle } from '@/types/subscription';

export interface PricingPlanCardProps {
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  displayPrice: number;
  rawPrice: number;
  isHighlighted?: boolean;
  isRecommended?: boolean;
  estCostPerVid?: number;
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  actionHref?: string;
  actionLabel?: string;
}

/**
 * Clean feature line to remove any explicit AI model names (e.g. FLUX-1-schnell)
 * and dynamically inject current billing cycle credits.
 */
function formatPlanFeature(
  feat: string,
  totalCredits: number,
  billingCycle: BillingCycle
): string {
  // If this line describes the credit quota, make it dynamic and clean
  if (/\bcredits?\b/i.test(feat) && (/\b(?:month|quarter|year|cycle)\b/i.test(feat) || /\d+[\s,]*credits?/i.test(feat))) {
    const cycleSuffix =
      billingCycle === 'quarterly'
        ? '/ 3 months'
        : billingCycle === 'yearly'
          ? '/ year'
          : '/ month';
    return `${totalCredits.toLocaleString()} Credits ${cycleSuffix}`;
  }

  // Strip any raw model names (FLUX-1-schnell, FLUX, schnell, etc.)
  let clean = feat
    .replace(/\s*\([^)]*(?:flux|schnell|model)[^)]*\)/gi, '')
    .replace(/black-forest-labs\//gi, '')
    .replace(/FLUX(?:-1|-schnell)?(?:-schnell)?/gi, 'HD AI')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return clean;
}

export function PricingPlanCard({
  plan,
  billingCycle,
  displayPrice,
  rawPrice,
  isHighlighted,
  isRecommended,
  estCostPerVid,
  onSelectPlan,
  actionHref,
  actionLabel,
}: PricingPlanCardProps) {
  // Dynamic credits multiplier (3x for quarterly, 12x for yearly, 1x for monthly)
  const multiplier = billingCycle === 'quarterly' ? 3 : billingCycle === 'yearly' ? 12 : 1;
  const totalCredits = (plan.creditsPerMonth || 0) * multiplier;

  const cycleDurationLabel =
    billingCycle === 'quarterly'
      ? '3 months'
      : billingCycle === 'yearly'
        ? 'year'
        : 'month';

  const creditHeaderLabel = `${totalCredits.toLocaleString()} Credits / ${cycleDurationLabel}`;

  const estVideoCount =
    billingCycle === 'quarterly'
      ? plan.id === 'STARTER'
        ? '45–60'
        : plan.id === 'CREATOR'
          ? '120–150'
          : '300+'
      : plan.id === 'STARTER'
        ? '15–20'
        : plan.id === 'CREATOR'
          ? '40–50'
          : '100+';

  const normalizedMonthlyCost =
    estCostPerVid ??
    Math.round(
      (billingCycle === 'quarterly'
        ? rawPrice / 3
        : billingCycle === 'yearly'
          ? rawPrice / 12
          : rawPrice) / (plan.id === 'STARTER' ? 15 : plan.id === 'CREATOR' ? 40 : 80)
    );

  const buttonText = actionLabel || `Choose ${plan.name}`;

  return (

    <>

      <div
        id={`plan-${plan.id}`}
        className={`relative flex flex-col rounded-3xl p-7 transition-all ${isHighlighted
          ? 'bg-white border-2 border-[#E05A30] shadow-xl shadow-[#E05A30]/10'
          : 'bg-white border border-[#E5E0D8] hover:border-zinc-300 shadow-sm'
          }`}
      >
        {/* Top badges */}
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

          {/* Dynamic Credit Header */}
          <p className="text-xs text-[#E05A30] font-semibold mt-1.5 flex items-center gap-1">
            <Sparkles size={13} />
            <span>{creditHeaderLabel}</span>
          </p>
          <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
            2 credits / image · 15 credits / YouTube kit
          </p>

          {/* Pricing Display */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-zinc-950">৳{new Intl.NumberFormat('en-BD').format(displayPrice)}</span>
            <span className="text-xs text-zinc-500">/ {cycleDurationLabel}</span>
            {displayPrice < rawPrice && (
              <span className="text-xs line-through text-zinc-400 font-mono">
                ৳{rawPrice}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="text-emerald-700 font-semibold font-mono">
              ~৳{normalizedMonthlyCost} per video
            </span>
            <span>·</span>
            <span>Watermark Free</span>
          </div>
        </div>

        {/* Feature bullets with dynamic credits and stripped model names */}
        <ul className="space-y-3 text-xs text-zinc-700 flex-1 mb-8">
          {(plan.features || []).map((feat, i) => {
            const formatted = formatPlanFeature(feat, totalCredits, billingCycle);
            return (
              <li key={i} className="flex items-start gap-2.5">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formatted}</span>
              </li>
            );
          })}
        </ul>

        {/* Action CTA: Either interactive onSelectPlan button or navigation Link */}
        {actionHref ? (
          <Link
            href={actionHref}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${isHighlighted
              ? 'bg-[#E05A30] hover:bg-[#C84C25] text-white shadow-md shadow-[#E05A30]/20'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
              }`}
          >
            <span>{buttonText}</span>
            <ArrowRight size={14} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onSelectPlan && onSelectPlan(plan)}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${isHighlighted
              ? 'bg-[#E05A30] hover:bg-[#C84C25] text-white shadow-md shadow-[#E05A30]/20'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
              }`}
          >
            <span>{buttonText}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </>
  );
}
