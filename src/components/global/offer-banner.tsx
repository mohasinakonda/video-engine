'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { usePricingPlans } from '@/hooks/use-pricing';

export const OfferBanner = () => {
  const { settings, promoCodes } = usePricingPlans();

  if (!settings?.globalBannerActive) return null;

  return (
    <div className="py-2 rounded-b-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-purple-500/15 border border-amber-500/20 font-medium  flex items-center justify-between shadow-sm ">
      <div className="flex items-center gap-2 mx-auto max-w-[1180px] px-4 sm:px-10">

        <span className='text-lg text-black'>{settings.globalBannerText}</span>
        with
        <span className='bg-white px-0.5 font-bold'>{promoCodes[0]?.code}</span>
      </div>

    </div>
  );
};