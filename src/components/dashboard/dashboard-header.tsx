'use client';

import React from 'react';
import Link from 'next/link';
import {
  Video,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, AdminSettings } from '@/types/subscription';

interface DashboardHeaderProps {
  profile: UserProfile;
  settings: AdminSettings | null;
  isLoggedIn: boolean;
  isLiveSupabase: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function DashboardHeader({
  profile,
  settings,
  isLoggedIn,
  isLiveSupabase,
  isLoading,
  onRefresh,
}: DashboardHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Guest Warning Banner if not authenticated */}
      {!isLoggedIn && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
            <span>
              You are in <strong>Guest Demo Mode</strong>. Sign in with Google or Email to save your projects across devices, link bKash payments, and earn 15% affiliate cash.
            </span>
          </div>
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shrink-0 transition-colors"
          >
            Sign In Now &rarr;
          </Link>
        </div>
      )}

      {/* Global Announcement Banner (if active in settings) */}
      {settings?.globalBannerActive && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-purple-500/20 border border-amber-500/30 text-xs font-medium text-amber-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400 shrink-0" />
            <span>{settings.globalBannerText}</span>
          </div>
          <Link
            href="/pricing"
            className="text-white underline hover:text-amber-300 font-semibold shrink-0 ml-4"
          >
            View Offers &rarr;
          </Link>
        </div>
      )}

      {/* Studio Welcome & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Video className="text-amber-400" size={28} />
              Creator Studio Dashboard
            </h1>
            {isLoggedIn && isLiveSupabase ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Cloud Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Local Studio Mode
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Welcome back, <strong className="text-zinc-200">{profile.name}</strong> ({profile.email})
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors disabled:opacity-50"
            title="Refresh Studio"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/project/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <PlusCircle size={15} />
            + Create New Video
          </Link>
        </div>
      </div>
    </div>
  );
}
