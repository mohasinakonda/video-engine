'use client';

import React from 'react';
import { Clock, MessageCircle } from 'lucide-react';
import { getWhatsAppVerificationUrl } from '@/lib/subscription-store';
import type { PaymentSubmission } from '@/types/subscription';

interface PaymentHistorySectionProps {
  submissions: PaymentSubmission[];
  whatsappNumber?: string;
}

export function PaymentHistorySection({ submissions, whatsappNumber }: PaymentHistorySectionProps) {
  if (submissions.length === 0) return null;

  return (
    <div className="space-y-4 pt-6 border-t border-zinc-800">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
        <Clock size={16} />
        Your Recent Payment Submissions
      </h3>
      <div className="space-y-2">
        {submissions.slice(0, 4).map((sub) => {
          const waUrl = getWhatsAppVerificationUrl(
            sub.senderNumber,
            sub.discountedPriceBDT,
            sub.planId ? `Plan ${sub.planId}` : `Topup (+${sub.creditsToGrant} Credits)`,
            sub.userEmail,
            whatsappNumber
          );

          return (
            <div
              key={sub.id}
              className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    {sub.planId ? `Plan: ${sub.planId}` : `Top-up: +${sub.creditsToGrant} Credits`}
                  </span>
                  <span className="text-zinc-500 ml-2">
                    via {sub.paymentMethod.toUpperCase()} ({sub.senderNumber})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-emerald-400">
                  ৳{sub.discountedPriceBDT} BDT
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    sub.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : sub.status === 'REJECTED'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {sub.status}
                </span>
                {sub.status === 'PENDING' && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[10px] flex items-center gap-1"
                  >
                    <MessageCircle size={12} /> Confirm on WhatsApp
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
