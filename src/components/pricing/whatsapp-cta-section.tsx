'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface WhatsAppCtaSectionProps {
  whatsappNumber?: string;
}

export function WhatsAppCtaSection({ whatsappNumber }: WhatsAppCtaSectionProps) {
  const number = whatsappNumber || '8801712345678';
  const url = `https://wa.me/${number}?text=${encodeURIComponent(
    'Hello! I have a question regarding the AI Video Engine subscription plans.'
  )}`;

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
      <div className="space-y-1 text-center sm:text-left">
        <h4 className="text-lg font-bold text-white flex items-center justify-center sm:justify-start gap-2">
          <MessageCircle size={20} className="text-emerald-400" />
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
        className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-transform hover:scale-105 shadow-lg shadow-emerald-500/20 flex items-center gap-2 shrink-0"
      >
        <MessageCircle size={16} />
        <span>Chat on WhatsApp Directly</span>
      </a>
    </div>
  );
}
