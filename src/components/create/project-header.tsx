'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Archive, ArchiveRestore, Loader2, Trash2, Unlock } from 'lucide-react';
import { ProjectSteps } from './project-steps';
import { useCreateConfig } from './use-create-config';
import { STATUS_LABELS, type VideoProject } from './types';

/** Title, status, step links, archive and delete: the same on every step of a project. */
export function ProjectHeader({ project, active }: { project: VideoProject; active: 'brief' | 'script' | 'package' | 'publish' | 'measure' }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);

  const restore = async () => {
    setRestoring(true);
    const res = await fetch(`/api/create/projects/${project.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unarchive' }) });
    setRestoring(false);
    // Reload so every step sees the restored status.
    if (res.ok) window.location.reload();
  };

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
            {project.status === 'ARCHIVED' && ' (read-only until restored)'}
          </p>
          <h1 className="text-2xl font-bold text-white leading-snug">{project.title}</h1>
        </div>
        {project.status === 'ARCHIVED' ? (
          <button type="button" className="btn-secondary btn-sm" onClick={restore} disabled={restoring}>
            {restoring ? <Loader2 size={15} className="animate-spin" /> : <ArchiveRestore size={15} />}
            Restore
          </button>
        ) : (
          <button type="button" className="btn-ghost btn-sm" onClick={archive} title="Archive">
            <Archive size={15} />
          </button>
        )}
        <button type="button" className="btn-ghost btn-sm text-rose-400" onClick={remove} title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
      <ProjectSteps project={project} active={active} />
      {!project.unlockedAt && project.status !== 'ARCHIVED' && <UnlockBar projectId={project.id} />}
    </header>
  );
}

/**
 * Projects started before per-video pricing pay per AI step. One click moves them to the
 * video price, so the steps are included from then on.
 */
function UnlockBar({ projectId }: { projectId: string }) {
  const { config } = useCreateConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!config?.hasAccess || config.bundle.cost <= 0) return null;

  const unlock = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/create/projects/${projectId}/unlock`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Couldn’t unlock this video.');
    window.dispatchEvent(new Event('credits_updated'));
    window.location.reload();
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-bg-border bg-bg-elevated">
      <p className="flex-1 text-sm text-zinc-300">This video was started before per-video pricing, so each AI step has its own price. Unlock it once and they’re included.</p>
      <div className="shrink-0 space-y-1">
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={unlock}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
          Unlock this video
        </button>
        <p className="text-xs text-zinc-500">Uses {config.bundle.cost} credits, once</p>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
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
