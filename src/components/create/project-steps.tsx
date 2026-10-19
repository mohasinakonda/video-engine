import Link from 'next/link';
import { Check } from 'lucide-react';
import type { ProjectStatus, VideoProject } from './types';

const AFTER_BRIEF: ProjectStatus[] = ['BRIEF_READY', 'SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION', 'PUBLISHED', 'ANALYZING', 'LEARNED'];

const STEPS: { id: string; label: string; path: string | null; doneAt: ProjectStatus[] }[] = [
  { id: 'brief', label: 'Brief', path: '', doneAt: AFTER_BRIEF },
  { id: 'script', label: 'Script', path: '/script', doneAt: AFTER_BRIEF.slice(1) },
  // Pages for the later steps arrive with their milestones (C4–C6).
  { id: 'package', label: 'Packaging', path: null, doneAt: AFTER_BRIEF.slice(2) },
  { id: 'publish', label: 'Publish', path: null, doneAt: AFTER_BRIEF.slice(4) },
  { id: 'measure', label: 'Measure', path: null, doneAt: ['LEARNED'] },
];

/** Where the project is in the loop. Only real statuses mark a step done; a step opens once the one before it is done. */
export function ProjectSteps({ project, active }: { project: VideoProject; active: string }) {
  const status = project.status === 'ARCHIVED' ? project.archivedFrom ?? 'DRAFT' : project.status;
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Project steps">
      {STEPS.map((step, i) => {
        const done = step.doneAt.includes(status);
        const current = step.id === active;
        const open = step.path !== null && (i === 0 || STEPS[i - 1].doneAt.includes(status) || (step.id === 'script' && !!project.script));
        const className = `px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border ${
          current ? 'bg-white text-zinc-950 border-white' : done ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' : 'bg-bg-elevated text-zinc-500 border-bg-border'
        } ${open && !current ? 'hover:border-zinc-400' : ''}`;
        const content = (
          <>
            {done && !current ? <Check size={14} /> : <span className="tabular-nums">{i + 1}</span>}
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
              <span className={className}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
