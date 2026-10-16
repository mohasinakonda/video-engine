'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  ArrowRight,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { UserProfile } from '@/types/subscription';
import PayoutModal from '@/components/dashboard/payout-modal';
import {
  fetchAffiliateDashboard,
  formatBdt,
  formatShortDate,
  type AffiliateDashboard,
  type AffiliatePayoutStatus,
  type AffiliateSaleStatus,
} from '@/lib/affiliate';

interface AffiliateTabProps {
  profile: UserProfile;
  copiedCode: boolean;
  onCopyCode: () => void;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rendoza.com';

const SALE_STATUS: Record<AffiliateSaleStatus, { label: string; className: string }> = {
  ON_HOLD: { label: 'On hold', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  AVAILABLE: { label: 'Available', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  REVERSED: { label: 'Refunded', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

const PAYOUT_STATUS: Record<AffiliatePayoutStatus, { label: string; className: string }> = {
  PENDING: { label: 'Processing', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PAID: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

export default function AffiliateTab({ profile, copiedCode, onCopyCode }: AffiliateTabProps) {
  const commPercent = profile.referralCommissionPercent ?? 15;
  const discPercent = profile.referralDiscountPercent ?? 20;

  const [data, setData] = useState<AffiliateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setData(await fetchAffiliateDashboard());
    } catch (err) {
      console.warn('[affiliate] dashboard load failed:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const holdDays = data?.holdDays ?? 14;
  const minPayout = data?.minPayoutBdt ?? 500;
  const available = data?.availableBdt ?? 0;
  const hasPendingPayout = (data?.requestedBdt ?? 0) > 0;
  const canWithdraw = available >= minPayout && !hasPendingPayout;

  if (data && !data.enabled) {
    return (
      <div className="p-6 sm:p-10 rounded-2xl bg-bg-surface border border-bg-border text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
          <Lock size={20} />
        </div>
        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Unlock the Rendoza AI Partner Program
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Buy any plan to activate your partner account. Once active, your audience gets{' '}
            <strong className="text-zinc-200">{discPercent}% off</strong> with your code, and you earn{' '}
            <strong className="text-zinc-200">{commPercent}% of every sale</strong>, paid to your bKash or Nagad.
          </p>
        </div>
        <ul className="text-xs text-zinc-400 space-y-1.5 max-w-sm mx-auto text-left">
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold">1.</span> Buy any monthly or 3-month plan</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold">2.</span> Your promo code activates as soon as the payment is approved</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 font-bold">3.</span> Share it and track every sale and payout right here</li>
        </ul>
        <Link href="/plan" className="btn-accent text-sm inline-flex items-center gap-2">
          Choose a plan
          <ArrowRight size={15} />
        </Link>
        <p className="text-2xs text-zinc-500">YouTuber or creator? Contact us on WhatsApp to get activated directly.</p>
      </div>
    );
  }

  const shareText = `Use my promo code ${profile.referralCode} to get ${discPercent}% off your first Rendoza AI plan. Turn any script into a finished video in minutes: ${SITE_URL}/pricing`;

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-2xl bg-bg-surface border border-bg-border space-y-6">
        {/* Header + code */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Share2 size={13} />
              Rendoza AI Partner Program
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Earn {commPercent}% on every sale from your code
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Your audience gets <strong>{discPercent}% off</strong> their first purchase, and you earn{' '}
              <strong>{commPercent}% of what they pay</strong>. Commission becomes withdrawable {holdDays} days after
              the payment (refund window), straight to your bKash or Nagad.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-bg-elevated border border-bg-border flex items-center gap-3 shrink-0">
            <div>
              <p className="text-2xs text-zinc-400 uppercase tracking-wider">Your Promo Code</p>
              <p className="font-mono font-extrabold text-base text-amber-400">{profile.referralCode}</p>
            </div>
            <button
              onClick={onCopyCode}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              title="Copy code"
            >
              {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-bg-elevated border border-bg-border">
            <span className="text-xxs text-zinc-400">Sales</span>
            <p className="text-2xl font-black text-white mt-1">{data?.salesCount ?? 0}</p>
            <p className="text-2xs text-zinc-500 mt-0.5">Paid purchases with your code</p>
          </div>

          <div className="p-4 rounded-xl bg-bg-elevated border border-bg-border">
            <span className="text-xxs text-zinc-400">Total Earned</span>
            <p className="text-2xl font-black text-white mt-1 font-mono">{formatBdt(data?.earnedBdt ?? 0)}</p>
            <p className="text-2xs text-zinc-500 mt-0.5">Paid out: {formatBdt(data?.paidBdt ?? 0)}</p>
          </div>

          <div className="p-4 rounded-xl bg-bg-elevated border border-bg-border">
            <span className="text-xxs text-zinc-400">On Hold</span>
            <p className="text-2xl font-black text-amber-400 mt-1 font-mono">{formatBdt(data?.onHoldBdt ?? 0)}</p>
            <p className="text-2xs text-zinc-500 mt-0.5">
              {data?.nextReleaseAt ? `Next release ${formatShortDate(data.nextReleaseAt)}` : `${holdDays}-day refund window`}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-elevated border border-emerald-500/30">
            <span className="text-xxs text-zinc-400">Available to Withdraw</span>
            <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">{formatBdt(available)}</p>
            <p className="text-2xs text-zinc-500 mt-0.5">
              {hasPendingPayout ? `${formatBdt(data?.requestedBdt ?? 0)} payout processing` : `Minimum ${formatBdt(minPayout)}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-bg-border">
          <p className="text-xs text-zinc-400">
            {hasPendingPayout
              ? 'Your payout request is being processed. You can request again once it is paid.'
              : `Withdraw to your bKash or Nagad once you have at least ${formatBdt(minPayout)} available.`}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <MessageCircle size={14} className="text-emerald-400" />
              Share on WhatsApp
            </a>
            <button
              onClick={() => setPayoutOpen(true)}
              disabled={!canWithdraw}
              className="btn-accent text-xs shrink-0"
            >
              Withdraw ({formatBdt(available)})
            </button>
          </div>
        </div>
      </div>

      {/* Sales history */}
      <div className="rounded-2xl bg-bg-surface border border-bg-border overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Sales from your code</h3>
            <p className="text-2xs text-zinc-500 mt-0.5">Every approved payment that used {profile.referralCode}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        </div>

        {loadError ? (
          <div className="p-8 text-center text-xs text-rose-400">Could not load your sales. Please refresh.</div>
        ) : loading && !data ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading…</div>
        ) : !data || data.sales.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No sales yet. Share your code with your audience to start earning.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-base text-zinc-400 uppercase text-[10px] font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Purchase</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Your commission</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {data.sales.map((sale) => (
                  <tr key={sale.id} className={sale.status === 'REVERSED' ? 'opacity-60' : ''}>
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">{formatShortDate(sale.createdAt)}</td>
                    <td className="py-3 px-4 font-mono text-zinc-300">{sale.customer}</td>
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">{sale.item || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-300">{formatBdt(sale.orderBdt)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatBdt(sale.commissionBdt)}
                      <span className="text-zinc-500 font-normal ml-1">({sale.percent}%)</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5 items-start">
                        <StatusPill {...SALE_STATUS[sale.status]} />
                        {sale.status === 'ON_HOLD' && (
                          <span className="text-[10px] text-zinc-500">until {formatShortDate(sale.availableAt)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout history */}
      {data && data.payouts.length > 0 && (
        <div className="rounded-2xl bg-bg-surface border border-bg-border overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-border">
            <h3 className="text-sm font-bold text-white">Payout history</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-base text-zinc-400 uppercase text-[10px] font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Requested</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4">Wallet</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Paid on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">{formatShortDate(p.requestedAt)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">{formatBdt(p.amountBdt)}</td>
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                      <span className="uppercase font-bold text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 mr-2">
                        {p.method}
                      </span>
                      <span className="font-mono">{p.account}</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill {...PAYOUT_STATUS[p.status]} />
                    </td>
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">{p.paidAt ? formatShortDate(p.paidAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payoutOpen && (
        <PayoutModal
          isOpen={payoutOpen}
          onClose={() => setPayoutOpen(false)}
          availableBdt={available}
          minPayoutBdt={minPayout}
          onSubmitted={load}
        />
      )}
    </div>
  );
}
