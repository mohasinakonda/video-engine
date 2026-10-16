'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  AudioLines,
  Flame,
  ChevronsUpDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AppLogo } from '@/icons/logo-icon';
import { signOutUser } from '@/lib/supabase-service';
import Image from 'next/image';

const navItems = [
  { href: '/projects', label: 'Projects', icon: Video },
  { href: '/voice-studio', label: 'Voice Studio', icon: AudioLines },
  { href: '/youtube-kit-studio', label: 'YouTube Kit Studio', icon: Flame },
  // { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/admin', label: 'Admin Hub', icon: ShieldCheck },
];

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, subscription: sub, isAdmin, isLoading } = useAuth();
  const isLoggedIn = !!user;
  const [signingOut, setSigningOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

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

  // In collapsed mode the sidebar is a slim icon rail that expands (as an overlay,
  // without shifting page content) while hovered or while the profile menu is open.
  const expanded = !collapsed || hovered || profileMenuOpen;

  if (!expanded) {
    const visibleNav = navItems.filter(({ href }) => href !== '/admin' || isAdmin);
    return (
      <aside
        className="absolute left-0 top-0 h-full w-14 flex flex-col items-center bg-bg-base border-r border-bg-border z-40 py-4 gap-3"
        onMouseEnter={() => setHovered(true)}
      >
        <AppLogo className="w-8 h-8 rounded-lg shadow-sm" />

        <Link
          href="/project/new"
          title="New Project"
          className="w-8 h-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 transition-colors"
        >
          <PlusCircle size={15} />
        </Link>

        <nav className="flex-1 flex flex-col items-center gap-1 pt-2">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                  }`}
              >
                <Icon size={15} />
              </Link>
            );
          })}
        </nav>

        {isLoggedIn && sub && (
          <Link
            href="/plan"
            title={`${sub.creditsRemaining} credits`}
            className="flex flex-col items-center gap-0.5 text-amber-400"
          >
            <Zap size={13} className="fill-amber-400" />
            <span className="text-3xs font-bold text-zinc-300">{sub.creditsRemaining}</span>
          </Link>
        )}

        {isLoggedIn && user && (
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center text-xs font-bold font-mono overflow-hidden">
            {user.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()
            )}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      className={
        collapsed
          ? 'absolute left-0 top-0 h-full w-56 flex flex-col bg-bg-base border-r border-bg-border z-40 shadow-2xl'
          : 'w-56 flex-shrink-0 flex flex-col bg-bg-base border-r border-bg-border h-full sticky top-0 self-start z-30'
      }
      onMouseLeave={collapsed ? () => setHovered(false) : undefined}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <AppLogo className="w-8 h-8 rounded-lg shadow-sm" />
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">AI Video</p>
            <p className="text-2xs text-zinc-400 leading-tight">Studio Web</p>
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
      <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
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
              <span className="text-xxs text-zinc-400">Loading balance...</span>
            </div>
          ) : isLoggedIn && sub ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-xxs font-bold text-white">
                    {sub.creditsRemaining} Credits
                  </span>
                </div>
                <span className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
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
                className="flex items-center justify-between w-full pt-1 text-xxs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Top-up / Upgrade</span>
                <ChevronRight size={12} />
              </Link>
            </>
          ) : (
            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-medium text-zinc-400">Guest</span>
                <span className="text-3xs uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  0 Credits
                </span>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center justify-between w-full text-xxs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Sign in</span>
                <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* User Profile & Interactive Menu Footer */}
      {isLoggedIn && user && (
        <div className="p-3 pt-0 relative" ref={menuRef}>
          {/* Popover Menu (Upward) */}
          {profileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-750 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-1">
              {/* Profile Card Header in Popover */}
              <div className="px-3 py-2.5 border-b border-zinc-800/80">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-zinc-100 truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                  </p>
                  {sub?.tier && (
                    <span className="text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 shrink-0">
                      {sub.tier}
                    </span>
                  )}
                </div>
                <p className="text-2xs text-zinc-400 truncate mt-0.5">{user.email}</p>
              </div>

              {/* Menu Links */}
              <div className="py-1 space-y-0.5">
                <Link
                  href="/dashboard"
                  onClick={() => setProfileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${pathname === '/dashboard'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                    }`}
                >
                  <LayoutDashboard size={14} className={pathname === '/dashboard' ? 'text-white' : 'text-zinc-400'} />
                  <span>Creator Dashboard</span>
                </Link>

                <Link
                  href="/plan"
                  onClick={() => setProfileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${pathname === '/plan'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                    }`}
                >
                  <CreditCard size={14} className={pathname === '/plan' ? 'text-white' : 'text-zinc-400'} />
                  <span>Plans & Credits</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${pathname === '/settings'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                    }`}
                >
                  <Settings size={14} className={pathname === '/settings' ? 'text-white' : 'text-zinc-400'} />
                  <span>Settings</span>
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setProfileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${pathname.startsWith('/admin')
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                      }`}
                  >
                    <ShieldCheck size={14} className={pathname.startsWith('/admin') ? 'text-white' : 'text-zinc-400'} />
                    <span>Admin Hub</span>
                  </Link>
                )}
              </div>

              {/* Sign Out Button in Popover */}
              <div className="pt-1 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleSignOut();
                  }}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                >
                  {signingOut ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Trigger Card */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left group ${profileMenuOpen || pathname === '/dashboard'
              ? 'bg-zinc-850 border-zinc-700 shadow-sm'
              : 'bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-850/80'
              }`}
            aria-label="User Account Menu"
            aria-expanded={profileMenuOpen}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {user.user_metadata?.avatar_url ? (
                <Image
                  width={28}
                  height={28}
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.full_name || 'User'}
                  className="w-7 h-7 rounded-full object-cover border border-zinc-700/80 group-hover:border-zinc-500 transition-colors shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                  {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white transition-colors leading-tight">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-2xs text-zinc-500 truncate leading-tight mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="p-1 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0">
              <ChevronsUpDown size={14} className={profileMenuOpen ? 'text-zinc-200' : 'text-zinc-400'} />
            </div>
          </button>
        </div>
      )}
    </aside>
  );
}

