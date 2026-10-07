'use client';

import React from 'react';
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';
import type { UserProfile } from '@/types/subscription';

interface AffiliateTabProps {
  profile: UserProfile;
  copiedCode: boolean;
  onCopyCode: () => void;
  onRequestPayoutClick: () => void;
}

export default function AffiliateTab({
  profile,
  copiedCode,
  onCopyCode,
  onRequestPayoutClick,
}: AffiliateTabProps) {
  const commPercent = profile.referralCommissionPercent ?? 15;
  const discPercent = profile.referralDiscountPercent ?? 20;

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Share2 size={13} />
              Creator Affiliate & Referral Program
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Earn {commPercent}% Lifetime Commission on Every Referral
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Share your personal promo code with other content creators or YouTube subscribers. 
              They get a <strong>{discPercent}% discount</strong> and you get a <strong>{commPercent}% cash commission</strong> straight to your bKash or Nagad wallet!
            </p>
          </div>

          {/* Referral Code Box */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-700/80 flex items-center gap-3">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Your Promo Code</p>
              <p className="font-mono font-extrabold text-base text-amber-400">{profile.referralCode}</p>
            </div>
            <button
              onClick={onCopyCode}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              title="Copy code"
            >
              {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* Referral Analytics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">Total Code Uses</span>
            <p className="text-2xl font-black text-white mt-1">
              {profile.referralCount}{' '}
              <span className="text-xs font-normal text-zinc-500">creators</span>
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Used your promo code</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">Total Money Earned</span>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
              ৳{profile.referralEarningsBDT} BDT
            </p>
            <p className="text-[10px] text-emerald-500/80 mt-0.5">Lifetime earnings</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">Pending Payout</span>
            <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
              ৳{profile.referralPendingBDT} BDT
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Available to withdraw</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">Paid Out</span>
            <p className="text-2xl font-black text-zinc-300 mt-1 font-mono">
              ৳{profile.referralPaidBDT} BDT
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Sent to bKash/Nagad</p>
          </div>
        </div>

        {/* Request Payout Action */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800/80">
          <p className="text-xs text-zinc-400">
            Withdraw your commission earnings directly to your personal bKash or Nagad wallet anytime (minimum ৳100).
          </p>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Use my promo code ${profile.referralCode} to get ${discPercent}% discount on AI Video Engine! Create viral faceless videos in minutes: https://video-engine.vercel.app/pricing`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition-colors flex items-center gap-1.5"
            >
              <MessageCircle size={14} className="text-emerald-400" />
              Share on WhatsApp
            </a>
            <button
              onClick={onRequestPayoutClick}
              disabled={profile.referralPendingBDT < 100}
              className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-purple-500/20 shrink-0"
            >
              Withdraw Earnings (৳{profile.referralPendingBDT})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
