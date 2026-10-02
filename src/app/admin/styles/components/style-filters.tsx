'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { CORE_FAMILIES } from '@/lib/style-taxonomy';

interface StyleFiltersProps {
  activeFamily: string;
  onSelectFamily: (familyId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function StyleFilters({
  activeFamily,
  onSelectFamily,
  searchQuery,
  onSearchChange,
}: StyleFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CORE_FAMILIES.map((fam) => (
          <button
            key={fam.id}
            onClick={() => onSelectFamily(fam.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeFamily === fam.id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {fam.name}
          </button>
        ))}
      </div>

      <div className="relative min-w-[260px]">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search style, tag or prompt..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>
    </div>
  );
}
