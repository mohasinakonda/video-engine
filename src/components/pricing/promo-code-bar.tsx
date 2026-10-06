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
    <div className="max-w-xl mx-auto bg-white border border-[#E5E0D8] rounded-2xl p-4 shadow-sm">
      <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Tag size={13} className="text-[#E05A30]" />
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
          className="flex-1 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-sm font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#E05A30] focus:ring-1 focus:ring-[#E05A30] transition-colors"
        />
        <button
          type="button"
          onClick={onApplyPromo}
          className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs active:scale-95"
        >
          Apply
        </button>
      </div>

      {promoResult && (
        <div
          className={`mt-3 text-xs p-2.5 rounded-lg flex items-center gap-2 ${
            promoResult.valid
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}
        >
          {promoResult.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{promoResult.message}</span>
          {promoResult.valid && (
            <span className="ml-auto font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px]">
              Applied
            </span>
          )}
        </div>
      )}
    </div>
  );
}
