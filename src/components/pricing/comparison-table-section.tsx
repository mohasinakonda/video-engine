'use client';

import React from 'react';
import { Layers, ChevronDown, CheckCheck } from 'lucide-react';
import { COMPARISON_ROWS } from './pricing-data';

interface ComparisonTableSectionProps {
  showComparison: boolean;
  setShowComparison: (show: boolean) => void;
}

export function ComparisonTableSection({
  showComparison,
  setShowComparison,
}: ComparisonTableSectionProps) {
  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Layers size={22} className="text-emerald-400" />
            Full Plan Comparison Matrix
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Compare detailed features across Starter, Creator, and Studio Pro side-by-side
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowComparison(!showComparison)}
          className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>{showComparison ? 'Hide Table' : 'View Full Table'}</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${showComparison ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {showComparison && (
        <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60">
                <th className="py-4 px-5 font-bold text-zinc-300">Feature Specification</th>
                <th className="py-4 px-5 font-bold text-white">Starter</th>
                <th className="py-4 px-5 font-bold text-emerald-400 bg-emerald-500/5">
                  Creator (Most Popular)
                </th>
                <th className="py-4 px-5 font-bold text-amber-400">Studio Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e2e2e]">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-zinc-850/40 transition-colors ${
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-950/20'
                  }`}
                >
                  <td className="py-3.5 px-5 font-medium text-zinc-300 flex items-center gap-2">
                    <CheckCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>{row.name}</span>
                  </td>
                  <td className="py-3.5 px-5 text-zinc-300">{row.starter}</td>
                  <td className="py-3.5 px-5 font-semibold text-emerald-300 bg-emerald-500/5">
                    {row.creator}
                  </td>
                  <td className="py-3.5 px-5 font-semibold text-amber-300">{row.studio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
