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
    <div className="p-6 sm:p-8 rounded-xl bg-bg-surface border border-bg-border flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
      <div className="space-y-1 text-center sm:text-left">
        <h4 className="text-base font-bold text-zinc-100 flex items-center justify-center sm:justify-start gap-2">
          <MessageCircle size={18} className="text-emerald-400" />
          Have Custom Requirements or Questions?
        </h4>
        <p className="text-xs text-zinc-400 max-w-xl">
          Message our official WhatsApp team. We are happy to help you pick the most cost-effective plan for your workflow.
        </p>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-accent px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 active:scale-95"
      >
        <MessageCircle size={16} />
        <span>Chat on WhatsApp Directly</span>
      </a>
    </div>
  );
}
