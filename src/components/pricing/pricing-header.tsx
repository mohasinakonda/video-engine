'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Coins } from 'lucide-react';

export function PricingHeader() {
  return (
    <div className="text-center space-y-4 max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F4F0EA] border border-[#E5E0D8] text-zinc-700 text-xs font-semibold uppercase tracking-wider">
        <Sparkles size={14} className="text-[#E05A30]" />
        Predictable Bangladeshi Creator Pricing
      </div>
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-950">
        Simple, Transparent Subscriptions
      </h1>
      <p className="text-zinc-600 text-base sm:text-lg leading-relaxed">
        Pay easily via <strong className="text-zinc-900 font-semibold">bKash</strong>,{' '}
        <strong className="text-zinc-900 font-semibold">Nagad</strong>, or{' '}
        <strong className="text-zinc-900 font-semibold">Bank Transfer</strong>.
        Instant WhatsApp activation with zero hidden fees.
      </p>

      {/* Free Trial Banner */}
      <div className="pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E0D8] text-xs text-zinc-700 hover:text-zinc-950 hover:border-zinc-400 transition-colors shadow-sm"
        >
          <Coins size={14} className="text-amber-500" />
          <span>
            New creator? <strong>Sign in to get 30 Free Starter Credits</strong> &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
