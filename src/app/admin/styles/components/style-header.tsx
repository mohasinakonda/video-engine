'use client';

import React from 'react';
import Link from 'next/link';
import { Palette, Plus, RefreshCw, ArrowLeft } from 'lucide-react';

interface StyleHeaderProps {
  isLiveSupabase: boolean;
  seeding: boolean;
  onSeedDefaults: () => void;
  onOpenCreateModal: () => void;
}

export function StyleHeader({
  isLiveSupabase,
  seeding,
  onSeedDefaults,
  onOpenCreateModal,
}: StyleHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to Admin Hub
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Palette size={22} />
          </span>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Art Styles & Visual Presets Studio
              </h1>
              {isLiveSupabase ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Supabase Database Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Local Catalog Mode
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Manage prompts, visual thumbnails, categories, and test AI outputs in real time
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/plan"
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
        >
          Plans & Pricing
        </Link>
        <Link
          href="/admin/users"
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
        >
          User Directory
        </Link>
        <button
          onClick={onSeedDefaults}
          disabled={seeding}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} />
          {seeding ? 'Syncing...' : 'Sync Default 30+ Catalog'}
        </button>
        <button
          onClick={onOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-900/30 transition-all"
        >
          <Plus size={15} /> Add New Style
        </button>
      </div>
    </div>
  );
}
