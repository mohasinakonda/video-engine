import React from 'react';
import { RefreshCw, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { formatWhatsAppLink } from '@/lib/subscription-store';
import { DEFAULT_ADMIN_SETTINGS } from '@/lib/subscription-store';

export const metadata = {
  title: 'Refund & Credit Policy | Rendoza AI',
  description: 'Refund, Credit Guarantee, and Payment Policy for Rendoza AI Video Studio.',
};

export default function RefundPage() {
  const whatsappUrl = formatWhatsAppLink(
    DEFAULT_ADMIN_SETTINGS.whatsappNumber,
    'Hello! I have a question regarding Rendoza AI refunds and credit recharge.'
  );

  return (
    <div className="py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3 border-b border-[#E5E0D8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold border border-emerald-200">
            <RefreshCw size={14} />
            <span>Fair Credit Guarantee</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
            Refund & Credit Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Clear, transparent policies for bKash, Nagad, and Bank payment submissions
          </p>
        </div>

        {/* Refund Content Card */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] p-6 sm:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#E05A30]" />
              1. 100% Technical Error Credit Reimbursement
            </h2>
            <p>
              If an AI image render, voice synthesis, or video export fails due to server timeout, API error, or system malfunction, your account is automatically refunded those credits instantly. If you experience an unrefunded failed generation, send your project ID to WhatsApp support for immediate credit reimbursement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Clock size={18} className="text-[#E05A30]" />
              2. 7-Day Money-Back Policy for Unused Plans
            </h2>
            <p>
              If you purchased a monthly or annual subscription via bKash, Nagad, or Bank Transfer and have consumed less than 10% of your allocated credits, you may request a full refund within 7 days of activation.
            </p>
            <p className="text-xs text-zinc-500">
              *Note: For accounts that have already rendered high-definition commercial videos consuming more than 10% of plan credits, proportional partial refunds or credit rollovers will be evaluated by our support team.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <RefreshCw size={18} className="text-[#E05A30]" />
              3. Processing Time & Channels
            </h2>
            <p>
              Approved refunds are disbursed directly to your original bKash, Nagad, or bank account within 24 to 48 business hours after manual verification.
            </p>
          </section>

          <section className="space-y-4 border-t border-[#E5E0D8] pt-6">
            <h2 className="text-base font-bold text-zinc-950">
              4. Need Help with a Payment or Refund?
            </h2>
            <p>
              Our local billing support team is available 7 days a week. Have your TrxID and account email ready for the fastest resolution:
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <MessageSquare size={14} />
              <span>Contact WhatsApp Billing Manager</span>
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
