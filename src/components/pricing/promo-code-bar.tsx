'use client';

import React from 'react';
import { Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import type { PromoValidationResult } from '@/lib/subscription-store';

interface PromoCodeBarProps {
  promoCodeInput: string;
  setPromoCodeInput: (code: string) => void;
  promoResult: PromoValidationResult | null;
  onApplyPromo: () => void;
}

export function PromoCodeBar({
  promoCodeInput,
  setPromoCodeInput,
  promoResult,
  onApplyPromo,
}: PromoCodeBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onApplyPromo();
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-md backdrop-blur-sm">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Tag size={13} className="text-amber-400" />
          Have a Promo Code or Referral Coupon?
        </span>
        <span className="text-[11px] text-zinc-500 font-normal">Try: EARLY50</span>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={promoCodeInput}
          onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="e.g. EARLY50, LAUNCH20"
          className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
        />
        <button
          type="button"
          onClick={onApplyPromo}
          className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          Apply
        </button>
      </div>

      {promoResult && (
        <div
          className={`mt-3 text-xs p-2.5 rounded-lg flex items-center gap-2 ${
            promoResult.valid
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          {promoResult.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{promoResult.message}</span>
          {promoResult.valid && (
            <span className="ml-auto font-bold uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
              Applied
            </span>
          )}
        </div>
      )}
    </div>
  );
}
