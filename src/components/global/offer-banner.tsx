'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { usePricingPlans } from '@/hooks/use-pricing';

export const OfferBanner = () => {
  const { settings } = usePricingPlans();

  if (!settings?.globalBannerActive) return null;

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-purple-500/20 border border-amber-500/30 text-xs font-medium text-amber-200 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-amber-400 shrink-0" />
        <span>{settings.globalBannerText}</span>
      </div>
      {settings.globalDiscountActive && (
        <span className="bg-amber-400 text-zinc-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
          {settings.globalDiscountPercent}% OFF ACTIVE
        </span>
      )}
    </div>
  );
};