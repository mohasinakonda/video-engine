'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  ChevronRight,
  HardDrive,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';
import { getWhatsAppVerificationUrl } from '@/lib/subscription-store';
import type {
  UserProfile,
  UserSubscription,
  PaymentSubmission,
  AdminSettings,
} from '@/types/subscription';

interface BillingTabProps {
  profile: UserProfile;
  sub: UserSubscription;
  submissions: PaymentSubmission[];
  settings: AdminSettings | null;
  storageInfo: { usedMB: number; quotaMB: number };
}

export default function BillingTab({
  profile,
  sub,
  submissions,
  settings,
  storageInfo,
}: BillingTabProps) {
  const [copied, setCopied] = useState(false);
  const adminWhatsApp = (settings?.whatsappNumber || '').trim();

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(adminWhatsApp).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Subscription & Credit Pack Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl bg-bg-surface border border-bg-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Current Plan
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {sub.status}
            </span>
          </div>
          <div>
            <p className="text-2xl font-black text-white tracking-tight">{profile.tier}</p>
            <p className="text-xs text-zinc-400 mt-1">
              {sub.status === 'ACTIVE'
                ? `Active billing · Renews in ${Math.round((sub.expiresAt - Date.now()) / (24 * 3600 * 1000))} days`
                : 'Free Trial Plan'}
            </p>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
          >
            <span>Upgrade or Change Plan</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="p-6 rounded-xl bg-bg-surface border border-bg-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Local Device Storage & Security
            </span>
            <HardDrive size={18} className="text-zinc-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-zinc-200 tracking-tight">
              {storageInfo.usedMB > 0 ? `${storageInfo.usedMB} MB Used` : 'Cached Locally'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              IndexedDB storage allocated by browser ({storageInfo.quotaMB > 0 ? `${storageInfo.quotaMB} MB available` : 'Safe & Private'}).
            </p>
          </div>
          <p className="text-xxs text-zinc-500">
            Audio & generated scenes remain on your device disk and are never lost on crash or credit exhaustion.
          </p>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-zinc-400" />
            Manual bKash & Nagad Payment Verification
          </h3>
          <p className="text-xs text-zinc-400">
            Track your manual payment submissions and contact admin on WhatsApp for instant approval
          </p>
          {adminWhatsApp && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-400">
              <span>Admin WhatsApp:</span>
              <span className="font-mono text-white">{adminWhatsApp}</span>
              <button
                type="button"
                onClick={copyWhatsApp}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-elevated border border-bg-border hover:border-bg-border-strong text-[11px] text-zinc-300 hover:text-white transition-colors"
                title="Copy number if WhatsApp doesn't open on this device"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden shadow-sm">
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No recent payment submissions. You are currently on the {profile.tier} tier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-elevated border-b border-bg-border text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Sender Phone</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Credits</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Support Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {submissions.map((item) => {
                    const waUrl = getWhatsAppVerificationUrl(
                      item.senderNumber,
                      item.discountedPriceBDT,
                      item.planId ? `Plan ${item.planId}` : `Top-up ${item.creditsToGrant} Credits`,
                      item.userEmail,
                      settings?.whatsappNumber
                    );

                    return (
                      <tr key={item.id} className="hover:bg-bg-hover transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {item.planId ? `Plan: ${item.planId}` : `Credit Pack (+${item.creditsToGrant})`}
                          <span className="text-2xs text-zinc-500 block font-normal">
                            via {item.paymentMethod.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-300">{item.senderNumber}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          ৳{item.discountedPriceBDT} BDT
                        </td>
                        <td className="py-3.5 px-4 text-zinc-200">+{item.creditsToGrant}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                              item.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : item.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-amber-500/20 text-amber-400 animate-pulse'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {item.status === 'PENDING' ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-accent btn-xs"
                            >
                              <MessageCircle size={13} />
                              Confirm on WhatsApp
                            </a>
                          ) : (
                            <span className="text-zinc-500 text-xxs italic">Verified</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
