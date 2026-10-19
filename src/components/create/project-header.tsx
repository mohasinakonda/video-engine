'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Loader2, Trash2 } from 'lucide-react';
import { ProjectSteps } from './project-steps';
import { STATUS_LABELS, type VideoProject } from './types';

/** Title, status, step links, archive and delete: the same on every step of a project. */
export function ProjectHeader({ project, active }: { project: VideoProject; active: 'brief' | 'script' }) {
  const router = useRouter();

  const archive = async () => {
    const res = await fetch(`/api/create/projects/${project.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) });
    if (res.ok) router.push('/create');
  };

  const remove = async () => {
    if (!window.confirm('Delete this project? Its brief, script and any measurements are removed. This can’t be undone.')) return;
    const res = await fetch(`/api/create/projects/${project.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/create');
  };

  return (
    <header className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-400">
            {project.origin === 'opportunity' ? 'From a Discover idea' : 'Your own idea'} · {STATUS_LABELS[project.status]}
          </p>
          <h1 className="text-2xl font-bold text-white leading-snug">{project.title}</h1>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={archive} title="Archive">
          <Archive size={15} />
        </button>
        <button type="button" className="btn-ghost btn-sm text-rose-400" onClick={remove} title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
      <ProjectSteps project={project} active={active} />
    </header>
  );
}

/** Loading and not-found states shared by the project pages. */
export function ProjectPlaceholder({ missing }: { missing: boolean }) {
  return missing ? (
    <div className="card space-y-3">
      <p className="text-base text-zinc-300">This project doesn’t exist or isn’t yours.</p>
      <Link href="/create" className="btn-primary btn-sm w-fit">
        Back to Create
      </Link>
    </div>
  ) : (
    <div className="card flex justify-center py-16">
      <Loader2 size={22} className="animate-spin text-zinc-400" />
    </div>
  );
}
