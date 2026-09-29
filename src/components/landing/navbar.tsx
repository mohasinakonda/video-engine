import React from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export const LandingNavbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2e2e2e] bg-[#09090b]/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold shadow-md shadow-white/10 group-hover:scale-105 transition-transform">
            <Zap size={16} className="fill-zinc-950" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              AI Video Studio
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400 border border-[#2e2e2e]">
                v2.0
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#scene-builder" className="hover:text-white transition-colors">Scene Builder</a>
          <a href="#storyboard" className="hover:text-white transition-colors">Storyboard</a>
          <a href="#styles" className="hover:text-white transition-colors">Styles</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-xs font-bold px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 transition-all shadow-sm hover:shadow-white/10 active:scale-95"
          >
            Start Free (30 Credits)
          </Link>
        </div>
      </div>
    </header>
  );
};
