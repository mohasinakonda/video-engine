'use client';

import React from 'react';
import { Layers, ChevronDown, CheckCheck, Minus } from 'lucide-react';
import { estimateVideoCount } from '@/lib/plan-pricing';
import type { PricingCatalog } from '@/lib/pricing-catalog';
import type { PlanTier, SubscriptionPlan } from '@/types/subscription';
import { COMPARISON_ROWS } from './pricing-data';

interface ComparisonTableSectionProps {
  showComparison: boolean;
  setShowComparison: (show: boolean) => void;
  plans: SubscriptionPlan[];
  catalog: PricingCatalog | null;
}

const TIERS = ['STARTER', 'CREATOR', 'STUDIO'] as const satisfies readonly PlanTier[];
type Cell = React.ReactNode;
type Row = { name: string; cells: Record<(typeof TIERS)[number], Cell>; group?: string };

const included = <CheckCheck size={15} className="text-emerald-600" aria-label="Included" />;
const notIncluded = <Minus size={15} className="text-zinc-400" aria-label="Not included" />;

/** Every row of the table: live plan credits, growth tools and image models, then the fixed rows. */
function buildRows(plans: SubscriptionPlan[], catalog: PricingCatalog | null): Row[] {
  const planOf = (tier: PlanTier) => plans.find((p) => p.id === tier);
  const perTier = (cell: (tier: PlanTier) => Cell) => Object.fromEntries(TIERS.map((t) => [t, cell(t)])) as Row['cells'];
  const rows: Row[] = [
    { name: 'Credits per month', cells: perTier((t) => (planOf(t) ? planOf(t)!.creditsPerMonth.toLocaleString('en-US') : '—')) },
    {
      name: 'About how many 3-minute videos',
      cells: perTier((t) => {
        const plan = planOf(t);
        if (!plan) return '—';
        const { min, max } = estimateVideoCount(plan.creditsPerMonth);
        return `~${min}–${max}`;
      }),
    },
  ];
  for (const tool of catalog?.tools ?? []) {
    if (!tool.plans.length) continue;
    rows.push({ group: 'YouTube growth tools', name: tool.name, cells: perTier((t) => (tool.plans.includes(t) ? included : notIncluded)) });
  }
  if (catalog?.images.length) {
    rows.push({
      group: 'Video making',
      name: 'AI image models',
      cells: perTier((t) => {
        const names = catalog.images.filter((m) => !m.plans.length || m.plans.includes(t)).map((m) => `${m.name} (${m.credits} cr)`);
        return names.length ? names.join(' · ') : '—';
      }),
    });
  }
  COMPARISON_ROWS.forEach((r, i) => rows.push({ group: i === 0 && !catalog?.images.length ? 'Video making' : undefined, name: r.name, cells: { STARTER: r.starter, CREATOR: r.creator, STUDIO: r.studio } }));
  return rows;
}

export function ComparisonTableSection({ showComparison, setShowComparison, plans, catalog }: ComparisonTableSectionProps) {
  const rows = buildRows(plans, catalog);

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
                <th className="py-4 px-5 font-bold text-zinc-900">Feature</th>
                <th className="py-4 px-5 font-bold text-zinc-900">Starter</th>
                <th className="py-4 px-5 font-bold text-[#E05A30] bg-orange-50/50">
                  Creator (Most Popular)
                </th>
                <th className="py-4 px-5 font-bold text-zinc-900">Studio Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D8]">
              {rows.map((row) => (
                <React.Fragment key={row.name}>
                  {row.group && (
                    <tr className="bg-[#F4F0EA]/60">
                      <td colSpan={4} className="py-2.5 px-5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                        {row.group}
                      </td>
                    </tr>
                  )}
                  <tr className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-zinc-800">{row.name}</td>
                    <td className="py-3.5 px-5 text-zinc-700">{row.cells.STARTER}</td>
                    <td className="py-3.5 px-5 font-semibold text-zinc-950 bg-orange-50/30">{row.cells.CREATOR}</td>
                    <td className="py-3.5 px-5 font-semibold text-zinc-950">{row.cells.STUDIO}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
