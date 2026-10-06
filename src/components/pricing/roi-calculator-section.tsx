'use client';

import React from 'react';
import { BadgePercent, ArrowRight } from 'lucide-react';
import type { SubscriptionPlan, BillingCycle } from '@/types/subscription';

interface RoiCalculatorSectionProps {
  plans: SubscriptionPlan[];
  billingCycle: BillingCycle;
  calculatorVideos: number;
  setCalculatorVideos: (n: number) => void;
  onSelectPlan: (planId: string) => void;
}

export function RoiCalculatorSection({
  plans,
  billingCycle,
  calculatorVideos,
  setCalculatorVideos,
  onSelectPlan,
}: RoiCalculatorSectionProps) {
  const calcRecommendedTier =
    calculatorVideos <= 18 ? 'STARTER' : calculatorVideos <= 45 ? 'CREATOR' : 'STUDIO';
  const calcRecommendedPlan =
    plans.find((p) => p.id === calcRecommendedTier) || plans[0];
  const calcPlanPrice = calcRecommendedPlan
    ? billingCycle === 'yearly'
      ? Math.round(calcRecommendedPlan.priceYearly / 12)
      : calcRecommendedPlan.priceMonthly
    : 1200;
  const costPerVideo = Math.max(1, Math.round(calcPlanPrice / Math.max(1, calculatorVideos)));
  const freelanceEditorCost = calculatorVideos * 1200; // Average traditional video editor charge
  const savingsBDT = Math.max(0, freelanceEditorCost - calcPlanPrice);

  const presets = [10, 20, 35, 60, 90];

  return (
    <div className="bg-white border border-[#E5E0D8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4F0EA] border border-[#E5E0D8] text-zinc-700 text-xs font-bold uppercase tracking-wider mb-2">
            <BadgePercent size={14} className="text-[#E05A30]" />
            Creator ROI & Plan Finder
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-950">
            How many videos do you want to create per month?
          </h3>
          <p className="text-xs text-zinc-600 mt-1">
            Select your monthly target to find the best plan, cost per video, and savings
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCalculatorVideos(preset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                calculatorVideos === preset
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-[#FAF8F5] border border-[#E5E0D8] text-zinc-700 hover:border-zinc-400'
              }`}
            >
              {preset} Videos
            </button>
          ))}
        </div>
      </div>

      {/* Range Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={calculatorVideos}
          onChange={(e) => setCalculatorVideos(Number(e.target.value))}
          className="w-full h-2.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-lg appearance-none cursor-pointer accent-[#E05A30]"
        />
        <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
          <span>5 videos/mo</span>
          <span className="text-[#E05A30] font-bold">{calculatorVideos} videos per month</span>
          <span>100+ videos/mo</span>
        </div>
      </div>

      {/* Live Calculation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] space-y-1">
          <p className="text-[11px] font-semibold uppercase text-zinc-500">Recommended Plan</p>
          <p className="text-xl font-extrabold text-zinc-950 flex items-center gap-2">
            <span>{calcRecommendedPlan?.name || 'Creator'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-[#E05A30] font-bold">
              Best Fit
            </span>
          </p>
          <p className="text-[11px] text-zinc-600">
            {calcRecommendedPlan?.creditsPerMonth} Monthly Image Credits
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] space-y-1">
          <p className="text-[11px] font-semibold uppercase text-zinc-500">Effective Cost Per Video</p>
          <p className="text-xl font-extrabold text-emerald-700">
            Only ~৳{costPerVideo} BDT
          </p>
          <p className="text-[11px] text-zinc-600">
            (96% cheaper than hiring an editor)
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] space-y-1">
          <p className="text-[11px] font-semibold uppercase text-zinc-500">Monthly Savings (vs Freelancer)</p>
          <p className="text-xl font-extrabold text-[#E05A30]">
            ৳{savingsBDT.toLocaleString()} BDT
          </p>
          <p className="text-[11px] text-zinc-600">
            Traditional editor would cost ~৳{freelanceEditorCost.toLocaleString()} BDT
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onSelectPlan(calcRecommendedPlan?.id || 'CREATOR')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E05A30] hover:text-[#C84C25] transition-colors"
        >
          <span>Select {calcRecommendedPlan?.name} Plan</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
