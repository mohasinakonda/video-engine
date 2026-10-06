'use client';

import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { CREATOR_FAQS } from './pricing-data';

interface FaqSectionProps {
  openFaq: number | null;
  setOpenFaq: React.Dispatch<React.SetStateAction<number | null>>;
}

export function FaqSection({ openFaq, setOpenFaq }: FaqSectionProps) {
  return (
    <div className="space-y-4 pt-6 border-t border-[#E5E0D8]">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4F0EA] border border-[#E5E0D8] text-zinc-700 text-xs font-bold uppercase tracking-wider">
          <HelpCircle size={14} className="text-[#E05A30]" />
          Frequently Asked Questions (FAQ)
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">
          Common Questions from Video Creators
        </h3>
        <p className="text-xs text-zinc-600">
          Everything you need to know about credits, payments, monetization, and voiceovers
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3 pt-4">
        {CREATOR_FAQS.map((faq, idx) => {
          const isOpen = openFaq === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-[#E5E0D8] bg-white overflow-hidden transition-all shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 hover:bg-[#FAF8F5]/60 transition-colors"
              >
                <span className="text-sm font-bold text-zinc-950 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-[#E05A30] text-xs font-bold flex items-center justify-center shrink-0">
                    Q
                  </span>
                  <span>{faq.q}</span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#E05A30]' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs text-zinc-600 leading-relaxed border-t border-[#E5E0D8] bg-[#FAF8F5]/30">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
