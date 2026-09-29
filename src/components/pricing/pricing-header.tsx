'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Coins } from 'lucide-react';

export function PricingHeader() {
  return (
    <div className="text-center space-y-4 max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
        <Sparkles size={14} />
        Predictable Bangladeshi Creator Pricing
      </div>
      <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
        Simple, Transparent Subscriptions
      </h1>
      <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
        Pay easily via <strong className="text-zinc-200">bKash</strong>,{' '}
        <strong className="text-zinc-200">Nagad</strong>, or{' '}
        <strong className="text-zinc-200">Bank Transfer</strong>.
        Instant WhatsApp activation with zero hidden fees.
      </p>

      {/* Free Trial Banner */}
      <div className="pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors shadow-sm"
        >
          <Coins size={14} className="text-amber-400" />
          <span>
            New creator? <strong>Sign in to get 30 Free Starter Credits</strong> &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
