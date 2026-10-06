import React from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export const LandingNavbar: React.FC = () => {
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
          <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">How it works</a>
          <a href="#scene-builder" className="hover:text-zinc-950 transition-colors">Scene Builder</a>
          <a href="#storyboard" className="hover:text-zinc-950 transition-colors">Storyboard</a>
          <a href="#styles" className="hover:text-zinc-950 transition-colors">Styles</a>
          <a href="#features" className="hover:text-zinc-950 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-zinc-950 transition-colors">Pricing</a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
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
        </div>
      </div>
    </header>
  );
};
