'use client';

import React from 'react';
import { Compass, PenLine, Search, Stethoscope, TrendingUp } from 'lucide-react';
import type { GrowthToolId, PricingCatalog } from '@/lib/pricing-catalog';
import type { PlanTier } from '@/types/subscription';

const ICONS: Record<GrowthToolId, typeof Compass> = { doctor: Stethoscope, discover: Compass, create: PenLine, audit: Search };
const PLAN_NAMES: Record<PlanTier, string> = { TRIAL: 'Trial', STARTER: 'Starter', CREATOR: 'Creator', STUDIO: 'Studio Pro' };
const PAID: PlanTier[] = ['STARTER', 'CREATOR', 'STUDIO'];

/** Which plans include a tool, in words: "Starter and up", "Creator and Studio Pro". */
export function plansText(plans: PlanTier[]): string {
  const paid = PAID.filter((p) => plans.includes(p));
  if (!paid.length) return 'Coming soon';
  if (paid.length === PAID.length) return plans.includes('TRIAL') ? 'Every plan, including Trial' : 'Every paid plan';
  return paid.map((p) => PLAN_NAMES[p]).join(' and ');
}

/** The YouTube growth tools: what each does, which plans include it and what a run costs (live from admin). */
export function GrowthToolsSection({ catalog }: { catalog: PricingCatalog | null }) {
  const tools = catalog?.tools.filter((t) => t.plans.length > 0) ?? [];

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-700 bg-[#F4F0EA] border border-[#E5E0D8] px-3 py-1 rounded-full">
          <TrendingUp size={13} className="text-[#E05A30]" />
          YouTube growth tools
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950">Know what to make, then make it</h2>
        <p className="text-sm text-zinc-600">
          Connect your channel with YouTube&apos;s official, read-only access. We never post or change anything.
        </p>
      </div>

      {!catalog ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-44 rounded-3xl bg-white border border-[#E5E0D8] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tools.map((tool, i) => {
            const Icon = ICONS[tool.id];
            return (
              <div key={tool.id} className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E5E0D8] shadow-sm flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-100/60 border border-orange-200/60 text-[#E05A30] flex items-center justify-center">
                    <Icon size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-zinc-500">Step {i + 1}</p>
                    <h3 className="text-base font-bold text-zinc-950">{tool.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{tool.pitch}</p>
                <ul className="mt-auto pt-3 border-t border-[#E5E0D8] space-y-1">
                  {tool.prices.map((p) => (
                    <li key={p.label} className="flex justify-between gap-3 text-xs">
                      <span className="text-zinc-600">{p.label}</span>
                      <span className="font-semibold text-zinc-950 tabular-nums whitespace-nowrap">{p.credits === 0 ? 'Free' : `${p.credits} credits`}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] font-semibold text-[#E05A30]">
                  {plansText(tool.plans)}
                  {tool.freeOnTrial > 0 && ` · first ${tool.freeOnTrial === 1 ? 'diagnosis' : `${tool.freeOnTrial} diagnoses`} free on Trial`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
