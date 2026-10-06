'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, MessageSquare } from 'lucide-react';
import { formatWhatsAppLink } from '@/lib/subscription-store';
import { usePricingPlans } from '@/hooks/use-pricing';

export const LandingFooter: React.FC = () => {
  const { settings } = usePricingPlans();
  const whatsappUrl = formatWhatsAppLink(
    settings?.whatsappNumber,
    'Hello! I would like to know more about AI Video Studio.'
  );

  return (
    <footer className="py-12 px-6 bg-[#F4F0EA] border-t border-[#E5E0D8] text-xs text-zinc-600">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold shadow-xs">
            <Zap size={13} className="text-[#E05A30] fill-[#E05A30]" />
          </div>
          <span className="font-bold text-zinc-950 text-sm">Rendoza AI</span>
          <span className="text-zinc-500 ml-1">© {new Date().getFullYear()} Rendoza AI. All rights reserved.</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 text-zinc-600">


          <Link href="/privacy" className="hover:text-zinc-950 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-950 transition-colors">Terms</Link>
          <Link href="/refund" className="hover:text-zinc-950 transition-colors">Refund Policy</Link>

        </div>
      </div>
    </footer>
  );
};
