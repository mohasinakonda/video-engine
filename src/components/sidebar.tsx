'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Video,
  Mic2,
  Settings,
  PlusCircle,
  Zap,
  Film,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  LayoutDashboard,
  Users,
  TrendingUp,
} from 'lucide-react';
import { getUserSubscription } from '@/lib/subscription-store';
import type { UserSubscription } from '@/types/subscription';

const navItems = [
  { href: '/', label: 'Projects', icon: Video },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/voice-studio', label: 'Voice Studio', icon: Mic2 },
  { href: '/pricing', label: 'Plans & Credits', icon: CreditCard },
  { href: '/admin', label: 'Admin Hub', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [sub, setSub] = useState<UserSubscription | null>(null);

  useEffect(() => {
    setSub(getUserSubscription());

    const updateSub = () => {
      setSub(getUserSubscription());
    };

    window.addEventListener('storage', updateSub);
    const interval = setInterval(updateSub, 3000);
    return () => {
      window.removeEventListener('storage', updateSub);
      clearInterval(interval);
    };
  }, []);

  // Extract project ID from routes for context nav
  const storyboardMatch = pathname.startsWith('/storyboard');
  const projectPageMatch = pathname.startsWith('/project/new');
  const exportMatch = pathname.startsWith('/export');
  const adminMatch = pathname.startsWith('/admin');

  const creditsPercent = sub
    ? Math.min(100, Math.round((sub.creditsRemaining / Math.max(1, sub.totalCreditsPurchased || 30)) * 100))
    : 100;

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-bg-base border-r border-bg-border min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center font-bold shadow-sm">
            <Zap size={16} className="text-zinc-950 fill-zinc-950" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">AI Video</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Studio Web</p>
          </div>
        </div>
      </div>

      {/* New Project CTA */}
      <div className="px-3 pt-4">
        <Link
          href="/project/new"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg
                     bg-white text-zinc-950 text-sm font-medium
                     hover:bg-zinc-200 transition-colors shadow-sm group"
        >
          <PlusCircle size={15} className="text-zinc-950 group-hover:scale-105 transition-transform" />
          New Project
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                          transition-colors duration-150 group
                          ${isActive
                  ? 'bg-zinc-800/90 text-white border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40'
                }`}
            >
              <Icon
                size={15}
                className={isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}
              />
              {label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </Link>
          );
        })}

        {/* Contextual navigation when in Admin */}
        {adminMatch && (
          <div className="pt-4 mt-2 border-t border-bg-border/60 space-y-1">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 pb-2">
              Admin Controls
            </p>
            <Link
              href="/admin"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === '/admin'
                  ? 'bg-zinc-850 text-white border border-zinc-800'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <TrendingUp size={13} className="text-emerald-400" />
              Overview & Queue
            </Link>
            <Link
              href="/admin/plan"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === '/admin/plan'
                  ? 'bg-zinc-850 text-white border border-zinc-800'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Settings size={13} className="text-purple-400" />
              Plans & Pricing
            </Link>
            <Link
              href="/admin/users"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pathname === '/admin/users'
                  ? 'bg-zinc-850 text-white border border-zinc-800'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users size={13} className="text-blue-400" />
              User Directory
            </Link>
          </div>
        )}

        {/* Contextual navigation when in a project */}
        {(storyboardMatch || projectPageMatch || exportMatch) && (
          <div className="pt-4 mt-2 border-t border-bg-border/60">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 pb-2">
              Current Project
            </p>
            {projectPageMatch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-850 border border-zinc-800">
                <Mic2 size={13} className="text-zinc-400" />
                Phase 1 · Audio
              </div>
            )}
            {storyboardMatch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-850 border border-zinc-800">
                <Film size={13} className="text-zinc-400" />
                Phase 2 · Storyboard
              </div>
            )}
            {exportMatch && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-850 border border-zinc-800">
                <Video size={13} className="text-zinc-400" />
                Phase 3 · Final Export
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Credit Balance Meter Card */}
      <div className="p-3 border-t border-bg-border/80">
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-bold text-white">
                {sub ? `${sub.creditsRemaining} Credits` : 'Loading...'}
              </span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              {sub?.tier || 'TRIAL'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800/80">
            <div
              className={`h-full transition-all duration-500 ${
                creditsPercent > 25 ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(5, creditsPercent)}%` }}
            />
          </div>

          <Link
            href="/pricing"
            className="flex items-center justify-between w-full pt-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Top-up / Upgrade</span>
            <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </aside>
  );
}

