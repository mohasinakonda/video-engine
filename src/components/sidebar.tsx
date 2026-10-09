'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Video,
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
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { signOutUser } from '@/lib/supabase-service';

const navItems = [
  { href: '/projects', label: 'Projects', icon: Video },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // { href: '/voice-studio', label: 'Voice Studio', icon: Mic2 },
  { href: '/plan', label: 'Plans & Credits', icon: CreditCard },
  { href: '/admin', label: 'Admin Hub', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, subscription: sub, isAdmin, isLoading } = useAuth();
  const isLoggedIn = !!user;
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      router.push('/');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }


  const adminMatch = pathname.startsWith('/admin');

  const creditsPercent = sub
    ? Math.min(100, Math.round((sub.creditsRemaining / Math.max(1, sub.totalCreditsPurchased || 30)) * 100))
    : 0;

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-bg-base border-r border-bg-border h-full sticky top-0 self-start overflow-y-auto z-30">
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
        {navItems
          .filter(({ href }) => href !== '/admin' || isAdmin)
          .map(({ href, label, icon: Icon }) => {
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
        {isAdmin && adminMatch && (
          <div className="pt-4 mt-2 border-t border-bg-border/60 space-y-1">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 pb-2">
              Admin Controls
            </p>
            <Link
              href="/admin"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === '/admin'
                ? 'bg-zinc-850 text-white border border-zinc-800'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <TrendingUp size={13} className="text-emerald-400" />
              Overview & Queue
            </Link>
            <Link
              href="/admin/plan"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === '/admin/plan'
                ? 'bg-zinc-850 text-white border border-zinc-800'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Settings size={13} className="text-purple-400" />
              Plans & Pricing
            </Link>
            <Link
              href="/admin/users"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === '/admin/users'
                ? 'bg-zinc-850 text-white border border-zinc-800'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Users size={13} className="text-blue-400" />
              User Directory
            </Link>
            <Link
              href="/admin/styles"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === '/admin/styles'
                ? 'bg-zinc-850 text-white border border-zinc-800'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Sparkles size={13} className="text-blue-400" />
              Presets Styles
            </Link>
            <Link
              href="/admin/models"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === '/admin/models'
                ? 'bg-zinc-850 text-white border border-zinc-800'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Zap size={13} className="text-blue-400" />
              Models
            </Link>
          </div>
        )}


      </nav>

      {/* Credit Balance Meter Card */}
      <div className="p-3 border-t border-bg-border/80">
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
          {isLoading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <span className="text-[11px] text-zinc-400">Loading balance...</span>
            </div>
          ) : isLoggedIn && sub ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-[11px] font-bold text-white">
                    {sub.creditsRemaining} Credits
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                  {sub.tier}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800/80">
                <div
                  className={`h-full transition-all duration-500 ${creditsPercent > 25 ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  style={{ width: `${Math.max(5, creditsPercent)}%` }}
                />
              </div>

              <Link
                href="/plan"
                className="flex items-center justify-between w-full pt-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Top-up / Upgrade</span>
                <ChevronRight size={12} />
              </Link>
            </>
          ) : (
            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400">Guest</span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  0 Credits
                </span>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center justify-between w-full text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Sign in</span>
                <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* User Profile & Sign Out Footer */}
      {isLoggedIn && user && (
        <div className="p-3 pt-0">
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 min-w-0 flex-1 group"
              title="Dashboard"
            >
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.full_name || 'User'}
                  className="w-7 h-7 rounded-full object-cover border border-zinc-700/80 group-hover:border-zinc-500 transition-colors shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                  {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white transition-colors leading-tight">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                  {user.email}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="p-1.5 rounded-lg text-rose-400 bg-rose-500/10 transition-colors ml-1 disabled:opacity-50 shrink-0"
              title="Sign Out"
            >
              {signingOut ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
              ) : (
                <LogOut size={14} />
              )}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

