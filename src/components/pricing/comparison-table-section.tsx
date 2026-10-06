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
          <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-950 flex items-center gap-2">
            <Layers size={22} className="text-[#E05A30]" />
            Full Plan Comparison Matrix
          </h3>
          <p className="text-xs text-zinc-600 mt-0.5">
            Compare detailed features across Starter, Creator, and Studio Pro side-by-side
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowComparison(!showComparison)}
          className="px-3.5 py-1.5 rounded-xl bg-white border border-[#E5E0D8] text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:border-zinc-400 transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <span>{showComparison ? 'Hide Table' : 'View Full Table'}</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${showComparison ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {showComparison && (
        <div className="overflow-x-auto rounded-3xl border border-[#E5E0D8] bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E0D8] bg-[#FAF8F5]">
                <th className="py-4 px-5 font-bold text-zinc-900">Feature Specification</th>
                <th className="py-4 px-5 font-bold text-zinc-900">Starter</th>
                <th className="py-4 px-5 font-bold text-[#E05A30] bg-orange-50/50">
                  Creator (Most Popular)
                </th>
                <th className="py-4 px-5 font-bold text-zinc-900">Studio Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D8]">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-[#FAF8F5]/60 transition-colors ${
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-[#FAF8F5]/30'
                  }`}
                >
                  <td className="py-3.5 px-5 font-medium text-zinc-800 flex items-center gap-2">
                    <CheckCheck size={14} className="text-emerald-600 shrink-0" />
                    <span>{row.name}</span>
                  </td>
                  <td className="py-3.5 px-5 text-zinc-700">{row.starter}</td>
                  <td className="py-3.5 px-5 font-semibold text-zinc-950 bg-orange-50/30">
                    {row.creator}
                  </td>
                  <td className="py-3.5 px-5 font-semibold text-zinc-950">{row.studio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
