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
    <footer className="py-12 px-6 bg-[#09090b] text-xs text-zinc-400">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold">
            <Zap size={13} className="fill-zinc-950" />
          </div>
          <span className="font-bold text-white text-sm">AI Video Studio</span>
          <span className="text-zinc-600 ml-2">© {new Date().getFullYear()} All rights reserved.</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/login" className="hover:text-white transition-colors">Login</Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline flex items-center gap-1.5"
          >
            <MessageSquare size={13} />
            <span>WhatsApp Support</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
