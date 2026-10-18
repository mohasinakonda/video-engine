'use client';

import React from 'react';
import { CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import { getWhatsAppVerificationUrl } from '@/lib/subscription-store';
import type { PaymentSubmission } from '@/types/subscription';

interface PaymentSubmittedViewProps {
  submission: PaymentSubmission;
  /** e.g. "Plan Creator" or "Topup Booster", used in the WhatsApp message. */
  itemName: string;
  adminWhatsApp: string;
  copiedText: string | null;
  handleCopy: (text: string, label: string) => void;
}

/** Shown after a manual payment is recorded: points the user to the admin on WhatsApp. */
export function PaymentSubmittedView({
  submission,
  itemName,
  adminWhatsApp,
  copiedText,
  handleCopy,
}: PaymentSubmittedViewProps) {
  return (
    <div className="text-center py-6 space-y-4">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
        <CheckCircle2 size={36} />
      </div>
      <h3 className="text-xl font-bold text-white">Payment Request Submitted!</h3>
      <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
        Click the button below to message the admin directly on WhatsApp with your phone number.
        Your credits will be activated immediately!
      </p>

      {/* For devices without WhatsApp installed: copy the number instead. */}
      {adminWhatsApp && (
        <div className="max-w-sm mx-auto p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left space-y-2">
          <p className="text-[11px] text-zinc-400">
            WhatsApp not opening? Copy the number and message the admin from any device.
          </p>
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
            <span className="font-mono text-sm text-white">{adminWhatsApp}</span>
            <button
              type="button"
              onClick={() => handleCopy(adminWhatsApp, 'whatsapp')}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-white transition-colors"
            >
              {copiedText === 'whatsapp' ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedText === 'whatsapp' ? 'Copied!' : 'Copy number'}
            </button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <a
          href={getWhatsAppVerificationUrl(
            submission.senderNumber,
            submission.discountedPriceBDT,
            itemName,
            submission.userEmail,
            adminWhatsApp
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-transform hover:scale-105"
        >
          <MessageCircle size={18} />
          <span>Message Admin on WhatsApp Now</span>
        </a>
      </div>
    </div>
  );
}
