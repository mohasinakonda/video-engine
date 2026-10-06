'use client';

import React from 'react';
import { ShieldCheck, Award, Smartphone, MessageCircle } from 'lucide-react';

export function CreatorTrustPillars() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
      <div className="p-5 rounded-2xl bg-white border border-[#E5E0D8] space-y-2 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
          <ShieldCheck size={20} />
        </div>
        <h4 className="text-sm font-bold text-zinc-950">100% Watermark Free</h4>
        <p className="text-xs text-zinc-600 leading-relaxed">
          All exported videos from paid plans are completely clean with zero logos or watermarks.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#E5E0D8] space-y-2 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
          <Award size={20} />
        </div>
        <h4 className="text-sm font-bold text-zinc-950">Full Commercial Rights</h4>
        <p className="text-xs text-zinc-600 leading-relaxed">
          100% copyright-safe to publish and monetize on YouTube, Facebook Reels, and TikTok.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#E5E0D8] space-y-2 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-[#E05A30] flex items-center justify-center">
          <Smartphone size={20} />
        </div>
        <h4 className="text-sm font-bold text-zinc-950">Instant bKash & Nagad</h4>
        <p className="text-xs text-zinc-600 leading-relaxed">
          No international cards needed. Fast manual payment with WhatsApp verification in 5–15 mins.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#E5E0D8] space-y-2 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
          <MessageCircle size={20} />
        </div>
        <h4 className="text-sm font-bold text-zinc-950">VIP WhatsApp Support</h4>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Direct support for video creation assistance, prompt optimization, or questions.
        </p>
      </div>
    </div>
  );
}
