'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PenLine, Plus } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { PublishReminders } from '@/components/create/publish-reminders';
import { STATUS_LABELS, type VideoProject } from '@/components/create/types';
import { useCreateConfig } from '@/components/create/use-create-config';

/** The Create library. A fuller view (performance, filters) comes with measurement. */
export default function CreateLibraryPage() {
  const { config, error } = useCreateConfig();
  const [projects, setProjects] = useState<VideoProject[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    fetch('/api/create/projects')
      .then(async (r) => ((r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error)))))
      .then((d) => setProjects(d.projects))
      .catch((e) => setLoadError(e.message || 'Could not load your projects.'));
  }, []);

  useEffect(() => {
    if (config?.hasAccess) load();
  }, [config?.hasAccess, load]);

  const active = projects?.filter((p) => p.status !== 'ARCHIVED') ?? [];

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <PenLine size={22} className="text-sky-400" />
              Create
            </h1>
            <p className="page-subtitle text-base">Plan a video from an idea, publish it, and see what it taught you.</p>
          </div>
          <Link href="/create/new" className="btn-primary">
            <Plus size={16} />
            New video
          </Link>
        </header>

        <AccessGate config={config} error={error}>
          {loadError ? (
            <div className="card text-base text-rose-300">{loadError}</div>
          ) : !projects ? (
            <div className="card flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
            </div>
          ) : active.length === 0 ? (
            <section className="card space-y-3">
              <h2 className="text-xl font-bold text-white">No videos planned yet</h2>
              <p className="text-base text-zinc-300">Start from a next-video idea in Discover, or from your own idea.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/discover?tab=next" className="btn-primary">
                  See next-video ideas
                </Link>
                <Link href="/create/new" className="btn-secondary">
                  Start from my own idea
                </Link>
              </div>
            </section>
          ) : (
            <div className="space-y-4">
              <PublishReminders hasWaiting={active.some((p) => p.status === 'IN_PRODUCTION')} onLinked={load} />
              <ul className="space-y-2">
                {active.map((p) => (
                  <li key={p.id}>
                    <Link href={`/create/${p.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 rounded-xl border border-bg-border bg-bg-surface hover:border-zinc-600">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-white truncate">{p.title}</p>
                        <p className="text-sm text-zinc-400">
                          {p.origin === 'opportunity' ? `From Discover: ${p.thesis?.topic}` : 'Your own idea'} · updated {new Date(p.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-bg-elevated border border-bg-border text-sm text-zinc-200 w-fit">{STATUS_LABELS[p.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AccessGate>
      </div>
    </div>
  );
}
