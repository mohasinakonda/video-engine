'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { formatWhatsAppLink } from '@/lib/subscription-store';

interface WhatsAppCtaSectionProps {
  whatsappNumber?: string;
}

export function WhatsAppCtaSection({ whatsappNumber }: WhatsAppCtaSectionProps) {
  const url = formatWhatsAppLink(
    whatsappNumber,
    'Hello! I have a question regarding Rendoza AI subscription plans.'
  );

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
      <div className="space-y-1 text-center sm:text-left">
        <h4 className="text-lg font-bold text-emerald-950 flex items-center justify-center sm:justify-start gap-2">
          <MessageCircle size={20} className="text-emerald-700" />
          Have Custom Requirements or Questions?
        </h4>
        <p className="text-xs text-emerald-800 max-w-xl">
          Message our official WhatsApp team. We are happy to help you pick the most cost-effective plan for your workflow.
        </p>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 active:scale-95"
      >
        <MessageCircle size={16} />
        <span>Chat on WhatsApp Directly</span>
      </a>
    </div>
  );
}
