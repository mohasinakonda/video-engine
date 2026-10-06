'use client';

import React from 'react';
import { Coins, Lock, Zap } from 'lucide-react';
import type { CreditTopupPack } from '@/types/subscription';

interface TopupPacksSectionProps {
  topupPacks: CreditTopupPack[];
  hasActiveSubscription: boolean;
  onSelectTopup: (pack: CreditTopupPack) => void;
}

export function TopupPacksSection({
  topupPacks,
  hasActiveSubscription,
  onSelectTopup,
}: TopupPacksSectionProps) {
  return (
    <div id="topup-section" className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins size={20} className="text-amber-400" />
            Instant Credit Top-Up Packs
          </h2>
          <p className="text-xs text-zinc-400">
            {hasActiveSubscription
              ? 'Add image credits immediately via bKash or Nagad. Credits never expire!'
              : 'Credit top-up packs are exclusively available for active plan subscribers. Subscribe to a plan below to unlock top-ups!'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {topupPacks.map((pack) => (
          <div
            key={pack.id}
            className={`rounded-3xl p-6 bg-zinc-900/80 border transition-all relative shadow-xl ${
              !hasActiveSubscription
                ? 'border-zinc-800/80 opacity-90'
                : pack.popular
                ? 'border-amber-400/60 shadow-lg shadow-amber-950/20'
                : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {!hasActiveSubscription ? (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800 text-amber-400/90 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                  <Lock size={10} /> Subscriber Exclusive
                </span>
              </div>
            ) : pack.popular ? (
              <span className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-bold text-[10px] uppercase tracking-wider shadow-sm">
                Most Popular
              </span>
            ) : null}
            <h4 className="text-base font-bold text-white">{pack.name}</h4>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">৳{pack.priceBDT}</span>
              <span className="text-xs text-zinc-400">BDT</span>
            </div>
            <p className="text-xs text-emerald-400 font-semibold mt-1">
              {pack.credits} Image Credits (~{Math.round(pack.credits / 15)} videos)
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              ৳{pack.perCreditBDT.toFixed(2)} per credit
            </p>

            {hasActiveSubscription ? (
              <button
                onClick={() => onSelectTopup(pack)}
                className="w-full mt-5 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Zap size={14} className="fill-zinc-950" />
                Top-up {pack.credits} Credits
              </button>
            ) : (
              <button
                onClick={() => onSelectTopup(pack)}
                className="w-full mt-5 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border border-zinc-700/80 group"
              >
                <Lock size={13} className="text-amber-400 group-hover:scale-110 transition-transform" />
                Subscribe to Unlock
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
