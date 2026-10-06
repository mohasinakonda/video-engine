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



      {/* Studio Welcome & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">

              Creator Studio Dashboard
            </h1>

          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Welcome back, <strong className="text-zinc-200">{profile.name}</strong>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <PlusCircle size={15} />
            + Create New Video
          </Link>
        </div>
      </div>
    </div>
  );
}
