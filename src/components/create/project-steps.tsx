import Link from 'next/link';
import { Check } from 'lucide-react';
import type { ProjectStatus, VideoProject } from './types';

const AFTER_BRIEF: ProjectStatus[] = ['BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED'];

const STEPS: { id: string; label: string; path: string | null; doneAt: ProjectStatus[] }[] = [
  { id: 'brief', label: 'Brief', path: '', doneAt: AFTER_BRIEF },
  { id: 'script', label: 'Script', path: '/script', doneAt: AFTER_BRIEF.slice(1) },
  { id: 'package', label: 'Packaging', path: '/package', doneAt: AFTER_BRIEF.slice(2) },
  { id: 'publish', label: 'Publish', path: '/publish', doneAt: AFTER_BRIEF.slice(4) },
  { id: 'measure', label: 'Measure', path: '/measure', doneAt: ['LEARNED'] },
];

/** Where the project is in the loop. Only real statuses mark a step done; a step opens once the one before it is done. */
export function ProjectSteps({ project, active }: { project: VideoProject; active: string }) {
  const status = project.status === 'ARCHIVED' ? project.archivedFrom ?? 'DRAFT' : project.status;
  // One grey track, like every other "choose where to go" control; the open step is white.
  return (
    <nav aria-label="Project steps" className="max-w-full overflow-x-auto">
      <ol className="inline-flex gap-0.5 p-1 rounded-xl bg-bg-elevated border border-bg-border">
        {STEPS.map((step, i) => {
          const done = step.doneAt.includes(status);
          const current = step.id === active;
          const open = step.path !== null && (i === 0 || STEPS[i - 1].doneAt.includes(status) || (step.id === 'script' && !!project.script) || (step.id === 'package' && !!project.packaging));
          const className = `inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm transition-colors ${
            current ? 'bg-white text-zinc-950 font-medium shadow-sm' : open ? 'text-zinc-300 hover:text-white hover:bg-white/5' : 'text-zinc-600 cursor-not-allowed'
          }`;
          const content = (
            <>
              {done && !current ? <Check size={14} className="text-emerald-400" /> : <span className="tabular-nums text-xs opacity-70">{i + 1}</span>}
              {step.label}
            </>
          );
          return (
            <li key={step.id} aria-current={current ? 'step' : undefined}>
              {open && !current ? (
                <Link href={`/create/${project.id}${step.path}`} className={className}>
                  {content}
                </Link>
              ) : (
                <span className={className} title={!open && !current ? 'Finish the step before it first' : undefined}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
