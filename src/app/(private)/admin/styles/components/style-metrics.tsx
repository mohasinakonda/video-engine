'use client';

import React from 'react';
import { Palette, CheckCircle2, EyeOff, Layers } from 'lucide-react';
import { CORE_FAMILIES } from '@/lib/style-taxonomy';

interface StyleMetricsProps {
  totalCount: number;
  totalActive: number;
  totalInactive: number;
}

export function StyleMetrics({
  totalCount,
  totalActive,
  totalInactive,
}: StyleMetricsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Total Styles</span>
          <Palette size={16} className="text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white">{totalCount}</div>
        <p className="text-[11px] text-zinc-500 mt-1">Available in catalog</p>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Active</span>
          <CheckCircle2 size={16} className="text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-emerald-400">{totalActive}</div>
        <p className="text-[11px] text-zinc-500 mt-1">Visible to creators</p>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Disabled</span>
          <EyeOff size={16} className="text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-amber-400">{totalInactive}</div>
        <p className="text-[11px] text-zinc-500 mt-1">Hidden from picker</p>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Core Families</span>
          <Layers size={16} className="text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-blue-400">{CORE_FAMILIES.length - 1}</div>
        <p className="text-[11px] text-zinc-500 mt-1">Aesthetic movements</p>
      </div>
    </div>
  );
}
