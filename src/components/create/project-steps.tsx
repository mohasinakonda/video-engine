import { Check } from 'lucide-react';
import type { ProjectStatus } from './types';

const STEPS: { id: string; label: string; doneAt: ProjectStatus[] }[] = [
  { id: 'brief', label: 'Brief', doneAt: ['BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED'] },
  { id: 'script', label: 'Script', doneAt: ['SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED'] },
  { id: 'package', label: 'Packaging', doneAt: ['PACKAGED', 'IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED'] },
  { id: 'publish', label: 'Publish', doneAt: ['PUBLISHED', 'ANALYZING', 'LEARNED'] },
  { id: 'measure', label: 'Measure', doneAt: ['LEARNED'] },
];

/** Where the project is in the loop. Only real statuses mark a step done. */
export function ProjectSteps({ status, active }: { status: ProjectStatus; active: string }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Project steps">
      {STEPS.map((step, i) => {
        const done = step.doneAt.includes(status);
        const current = step.id === active;
        return (
          <li
            key={step.id}
            aria-current={current ? 'step' : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border ${
              current ? 'bg-white text-zinc-950 border-white' : done ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' : 'bg-bg-elevated text-zinc-500 border-bg-border'
            }`}
          >
            {done && !current ? <Check size={14} /> : <span className="tabular-nums">{i + 1}</span>}
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
