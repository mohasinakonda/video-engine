'use client';

import React from 'react';
import { ShieldCheck, Award, Smartphone, MessageCircle } from 'lucide-react';

export function CreatorTrustPillars() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
          <ShieldCheck size={20} />
        </div>
        <h4 className="text-sm font-bold text-white">100% Watermark Free</h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          All exported videos from paid plans are completely clean with zero logos or watermarks.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <Award size={20} />
        </div>
        <h4 className="text-sm font-bold text-white">Full Commercial Rights</h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          100% copyright-safe to publish and monetize on YouTube, Facebook Reels, and TikTok.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
          <Smartphone size={20} />
        </div>
        <h4 className="text-sm font-bold text-white">Instant bKash & Nagad</h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          No international cards needed. Fast manual payment with WhatsApp verification in 5–15 mins.
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <MessageCircle size={20} />
        </div>
        <h4 className="text-sm font-bold text-white">VIP WhatsApp Support</h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Direct support for video creation assistance, prompt optimization, or questions.
        </p>
      </div>
    </div>
  );
}
