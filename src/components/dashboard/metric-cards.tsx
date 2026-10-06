'use client';

import React from 'react';
import Link from 'next/link';
import {
  Zap,
  Film,
  Clock,
  HardDrive,
  DollarSign,
} from 'lucide-react';
import type { UserProfile } from '@/types/subscription';

interface MetricCardsProps {
  profile: UserProfile;
  totalProjectsCount: number;
  completedProjectsCount: number;
  totalMinutesProduced: string;
  storageInfo: { usedMB: number; quotaMB: number };
  onNavigateTab: (tab: 'projects' | 'affiliate' | 'billing') => void;
}

export default function MetricCards({
  profile,
  totalProjectsCount,
  completedProjectsCount,
  totalMinutesProduced,
  storageInfo,
  onNavigateTab,
}: MetricCardsProps) {
  const creditsPercent = Math.min(
    100,
    Math.round(
      (profile.creditsRemaining / Math.max(1, profile.creditsRemaining + profile.creditsUsed)) * 100
    )
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Image Credits */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>AI Credits</span>
          <Zap size={16} className="text-amber-400 fill-amber-400" />
        </div>
        <div>
          <p className="text-2xl font-black text-emerald-400 tracking-tight">
            {profile.creditsRemaining} Credits
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {profile.creditsUsed} used · Plan: <strong className="text-zinc-300">{profile.tier}</strong>
          </p>
        </div>
        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800/80">
          <div
            className="bg-emerald-400 h-full transition-all duration-500"
            style={{ width: `${Math.max(5, creditsPercent)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-zinc-500">{creditsPercent}% available</span>
          <Link href="/plan" className="text-amber-400 hover:underline font-semibold">
            Top-up &rarr;
          </Link>
        </div>
      </div>

      {/* Metric 2: Total Projects */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Studio Projects</span>
          <Film size={16} className="text-blue-400" />
        </div>
        <div>
          <p className="text-2xl font-black text-white tracking-tight">
            {totalProjectsCount}{' '}
            <span className="text-xs font-normal text-zinc-500">videos</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {completedProjectsCount} ready for export
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-medium pt-1">
          <span>Crash-safe IndexedDB saved</span>
        </div>
      </div>

      {/* Metric 3: Video Minutes Produced */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Content Generated</span>
          <Clock size={16} className="text-purple-400" />
        </div>
        <div>
          <p className="text-2xl font-black text-purple-400 tracking-tight font-mono">
            {totalMinutesProduced}{' '}
            <span className="text-xs font-normal text-zinc-400">mins</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Total runtime across all scenes
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pt-1">
          <HardDrive size={13} className="text-zinc-500" />
          <span>{storageInfo.usedMB > 0 ? `${storageInfo.usedMB} MB local cache` : 'Disk cached'}</span>
        </div>
      </div>

      {/* Metric 4: Affiliate Earnings */}
      <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-sm hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Affiliate Commission</span>
          <DollarSign size={16} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-2xl font-black text-white tracking-tight font-mono">
            ৳{profile.referralPendingBDT}{' '}
            <span className="text-xs font-normal text-zinc-500">BDT</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Earned: ৳{profile.referralEarningsBDT} · {profile.referralCount} referrals
          </p>
        </div>
        <button
          onClick={() => onNavigateTab('affiliate')}
          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 pt-1"
        >
          <span>Withdraw Cash &rarr;</span>
        </button>
      </div>
    </div>
  );
}
