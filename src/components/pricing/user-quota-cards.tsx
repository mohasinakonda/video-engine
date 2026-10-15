'use client';

import React from 'react';
import { ChevronRight, Zap, Smartphone, MessageCircle } from 'lucide-react';
import { formatWhatsAppLink } from '@/lib/subscription-store';
import type { UserSubscription, UserProfile } from '@/types/subscription';

interface UserQuotaCardsProps {
  userSub: UserSubscription | null;
  userProfile: UserProfile | null;
  creditsRemaining: number;
  creditsUsed: number;
  creditsPercent: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  whatsappNumber?: string;
}

const GRACE_MS = 24 * 3600 * 1000;

/** Plan lapsed: credits are kept for 24h, then expire and the account drops to Trial. */
function graceMessage(expiresAt: number, credits: number): string {
  const hoursLeft = Math.ceil((expiresAt + GRACE_MS - Date.now()) / (3600 * 1000));
  if (hoursLeft <= 0 || credits <= 0) return 'Plan expired. Renew to unlock paid features again.';
  return `Plan expired. Renew within ${hoursLeft}h to keep your ${credits.toLocaleString()} credits, otherwise they expire and you move to the free Trial.`;
}

export function UserQuotaCards({
  userSub,
  userProfile,
  creditsRemaining,
  creditsUsed,
  creditsPercent,
  isExpiringSoon,
  isExpired,
  whatsappNumber,
}: UserQuotaCardsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title text-3xl sm:text-4xl">
          Credits & Subscription Usage
        </h1>
        <p className="page-subtitle">
          Monitor your image rendering quotas, plan renewals, and top-up balances
        </p>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Subscription Status & Renewal */}
        <div className="p-6 rounded-xl bg-bg-surface border border-bg-border space-y-4 relative overflow-hidden shadow-xl card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Current Plan
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                isExpired
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : isExpiringSoon
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {userSub?.status || 'ACTIVE'}
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-black text-white">{userSub?.tier || 'TRIAL'}</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {userSub?.status === 'ACTIVE'
                ? `Active cycle · Renews in ${Math.round(
                    (userSub.expiresAt - Date.now()) / (24 * 3600 * 1000)
                  )} days`
                : isExpired && userSub
                ? graceMessage(userSub.expiresAt, creditsRemaining)
                : 'Free trial tier'}
            </p>
          </div>

          <div className="pt-1">
            <a
              href="#plans-section"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>{isExpired ? 'Renew Subscription' : 'Upgrade Plan'}</span>
              <ChevronRight size={14} />
            </a>
          </div>
        </div>

        {/* Card 2: Live Credit Balance Meter */}
        <div className="p-6 rounded-xl bg-bg-surface border border-bg-border space-y-4 shadow-xl card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Available AI Credits
            </span>
            <Zap size={18} className="text-amber-400 fill-amber-400" />
          </div>

          <div>
            <p className="text-2xl font-black text-emerald-400">{creditsRemaining.toLocaleString()} Credits</p>
            <p className="text-xxs text-zinc-400 mt-0.5">
              2 credits / image · 15 credits / YouTube Launch Kit
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full transition-all duration-500 ${
                  creditsRemaining > 30 ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(5, creditsPercent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xxs">
              <span
                className={`font-semibold ${
                  creditsRemaining > 30 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {creditsRemaining > 100
                  ? '🟢 Plenty of credits available'
                  : creditsRemaining > 30
                  ? '🟡 Moderate balance'
                  : '🔴 Recharging needed'}
              </span>
              <a href="#topup-section" className="text-amber-400 hover:underline font-semibold">
                + Top Up &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Card 3: Account & Support */}
        <div className="p-6 rounded-xl bg-bg-surface border border-bg-border space-y-4 shadow-xl card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Account & Support
            </span>
            <Smartphone size={18} className="text-zinc-400" />
          </div>

          <div>
            <p className="text-2xl font-black text-white">
              ৳{userProfile?.totalSpentBDT || 0} BDT
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Total investment across subscriptions & top-ups
            </p>
          </div>

          <div className="pt-1">
            <a
              href={formatWhatsAppLink(whatsappNumber, 'Hello Admin! I need VIP support regarding my account & credits.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle size={14} />
              <span>WhatsApp VIP Support</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
