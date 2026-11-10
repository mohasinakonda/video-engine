'use client';

/** Channel-wide patterns, and the checks only YouTube Studio can show. */
import { ChevronDown } from 'lucide-react';
import type { ChannelSignal, StudioCheck } from '@/lib/youtube/views-check/types';
import { SEVERITY } from './styles';

export function Signals({ signals }: { signals: ChannelSignal[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <h3 className="text-lg font-bold text-white">
        Channel patterns <span className="font-medium text-zinc-400">· {signals.length}</span>
      </h3>
      {signals.length === 0 ? (
        <p className="text-sm text-zinc-400">No channel-wide problems found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {signals.map((s) => (
            <li key={s.id}>
              <details className="rounded-xl border border-bg-border bg-bg-base px-3 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className={`w-[68px] shrink-0 rounded-full py-0.5 text-center text-xs font-semibold ${SEVERITY[s.severity].pill}`}>{SEVERITY[s.severity].label}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-white">{s.title}</span>
                  <ChevronDown size={16} className="shrink-0 text-zinc-500" aria-hidden="true" />
                </summary>
                <div className="mt-2 space-y-1 sm:pl-[80px]">
                  <p className="text-sm text-zinc-300">{s.detail}</p>
                  <p className="text-sm text-emerald-300">{s.fix}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StudioChecks({ checks, found, onToggle }: { checks: StudioCheck[]; found: Set<string>; onToggle: (id: string) => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-white">Check in YouTube Studio</h3>
        <span className="text-sm text-zinc-400">
          {found.size} of {checks.length} with a problem
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {checks.map((c) => (
          <StudioCheckItem key={c.id} check={c} checked={found.has(c.id)} onToggle={onToggle} />
        ))}
      </ul>
      <p className="text-xs text-zinc-400">YouTube’s API doesn’t share these. Tick one if you find a problem there.</p>
    </section>
  );
}

function StudioCheckItem({ check, checked, onToggle }: { check: StudioCheck; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <li>
      <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
        <input type="checkbox" className="h-[18px] w-[18px] accent-amber-500" checked={checked} onChange={() => onToggle(check.id)} />
        <span className="font-medium">{check.title}</span>
      </label>
      <details className="ml-7">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Where to look</summary>
        <p className="mt-1 text-xs text-zinc-300">{check.where}</p>
        <p className="text-xs text-zinc-400">{check.why}</p>
      </details>
      {checked && <p className="ml-7 mt-1 text-sm text-amber-200">{check.ifFound}</p>}
    </li>
  );
}
