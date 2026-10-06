'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, LayoutDashboard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const LandingNavbar: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setIsLoggedIn(true);
        }
      });
    } catch {
      // Ignore auth check error in mock/offline environments
    }
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E0D8] bg-[#FAF8F5]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform">
            <Zap size={16} className="text-[#E05A30] fill-[#E05A30]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-zinc-950 flex items-center gap-1.5">
              Rendoza AI
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#F4F0EA] text-zinc-600 border border-[#E5E0D8]">
                v2.0
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-600">
          <Link href="/#how-it-works" className="hover:text-zinc-950 transition-colors">How it works</Link>
          <Link href="/#scene-builder" className="hover:text-zinc-950 transition-colors">Scene Builder</Link>
          <Link href="/#storyboard" className="hover:text-zinc-950 transition-colors">Storyboard</Link>
          <Link href="/#styles" className="hover:text-zinc-950 transition-colors">Styles</Link>
          <Link href="/#features" className="hover:text-zinc-950 transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-zinc-950 transition-colors">Pricing</Link>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-xs font-bold px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
            >
              <LayoutDashboard size={13} />
              <span>Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-medium text-zinc-600 hover:text-zinc-950 px-2.5 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="text-xs font-bold px-4 py-2 rounded-md bg-[#E05A30] hover:bg-[#C84C25] text-white transition-all shadow-md shadow-[#E05A30]/20 active:scale-95"
              >
                Start Free (30 Credits)
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

