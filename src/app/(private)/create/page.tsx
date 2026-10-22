'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArchiveRestore, Loader2, PenLine, Plus, Search } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { Segmented } from '@/components/ui/segmented';
import { LIBRARY_TABS, nextStepOf, type LibraryTab } from '@/components/create/next-step';
import { STATUS_LABELS, type VideoProject } from '@/components/create/types';
import { useCreateConfig } from '@/components/create/use-create-config';
import { FLOW } from '@/lib/youtube/create/project-state';

const STEP_COUNT = 3;
/** Steps done (brief, script, packaging), from the status. */
const stepsDone = (p: VideoProject) => Math.max(0, FLOW.indexOf(p.status === 'ARCHIVED' ? p.archivedFrom ?? 'DRAFT' : p.status));

const TAB_KEY = 'create:library:tab';

/** The Create library: every planned video and what's next on each. */
export default function CreateLibraryPage() {
  const { config, error } = useCreateConfig();
  const [projects, setProjects] = useState<VideoProject[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<LibraryTab>('progress');
  const [query, setQuery] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/create/projects')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error))))
      .then((d) => setProjects(d.projects))
      .catch((e) => setLoadError(e.message || 'Could not load your projects.'));
  }, []);

  useEffect(() => {
    if (config?.hasAccess) load();
  }, [config?.hasAccess, load]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TAB_KEY) as LibraryTab | null;
      if (saved && LIBRARY_TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {
      // storage blocked: default tab
    }
  }, []);
  const chooseTab = (id: LibraryTab) => {
    setTab(id);
    try {
      window.localStorage.setItem(TAB_KEY, id);
    } catch {
      // storage blocked
    }
  };

  const counts = useMemo(
    () => Object.fromEntries(LIBRARY_TABS.map((t) => [t.id, (projects ?? []).filter((p) => (t.statuses as readonly string[]).includes(p.status)).length])) as Record<LibraryTab, number>,
    [projects]
  );
  const shown = useMemo(() => {
    const statuses = LIBRARY_TABS.find((t) => t.id === tab)?.statuses as readonly string[];
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => statuses.includes(p.status) && (!q || p.title.toLowerCase().includes(q) || p.thesis?.topic.toLowerCase().includes(q)));
  }, [projects, tab, query]);

  const restore = async (p: VideoProject) => {
    setRestoring(p.id);
    const res = await fetch(`/api/create/projects/${p.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unarchive' }) });
    setRestoring(null);
    if (res.ok) load();
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <PenLine size={22} className="text-sky-400" />
              Create
            </h1>
            <p className="page-subtitle text-base">Plan a video from an idea: brief, script, title and thumbnail.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/create/new" className="btn-primary">
              <Plus size={16} />
              New video
            </Link>
          </div>
        </header>

        <AccessGate config={config} error={error}>
          {loadError ? (
            <div className="card text-base text-rose-300">{loadError}</div>
          ) : !projects ? (
            <div className="card flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
            </div>
          ) : projects.length === 0 ? (
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Segmented
                  label="Show videos"
                  value={tab}
                  onChange={chooseTab}
                  options={LIBRARY_TABS.map((t) => ({
                    id: t.id,
                    label: (
                      <>
                        {t.label} <span className="tabular-nums opacity-60">{counts[t.id]}</span>
                      </>
                    ),
                  }))}
                />
                <label className="relative sm:ml-auto sm:w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input className="input text-sm pl-9 py-1.5" value={query} placeholder="Search titles" onChange={(e) => setQuery(e.target.value)} />
                </label>
              </div>

              {shown.length === 0 ? (
                <p className="card text-base text-zinc-400">{query ? 'No videos match your search.' : 'Nothing here yet.'}</p>
              ) : (
                <ul className="space-y-2">
                  {shown.map((p) => {
                    const next = nextStepOf(p);
                    const done = stepsDone(p);
                    return (
                      <li key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-bg-border bg-bg-surface hover:border-zinc-600">
                        <Link href={`/create/${p.id}`} className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-base font-semibold text-white truncate">{p.title}</p>
                          <p className="text-sm text-zinc-400 truncate">
                            {STATUS_LABELS[p.status === 'ARCHIVED' ? p.archivedFrom ?? 'DRAFT' : p.status]} ·{' '}
                            {p.origin === 'opportunity' ? `From Discover: ${p.thesis?.topic}` : 'Your own idea'} · updated {new Date(p.updatedAt).toLocaleDateString()}
                          </p>
                          <span className="flex gap-1" aria-label={`${done} of ${STEP_COUNT} steps done`}>
                            {Array.from({ length: STEP_COUNT }, (_, i) => (
                              <span key={i} className={`h-1.5 w-8 rounded-full ${i < done ? 'bg-emerald-400/80' : 'bg-white/10'}`} />
                            ))}
                          </span>
                        </Link>
                        {p.status === 'ARCHIVED' ? (
                          <button type="button" className="btn-secondary btn-sm shrink-0" disabled={restoring === p.id} onClick={() => restore(p)}>
                            {restoring === p.id ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                            Restore
                          </button>
                        ) : (
                          next && (
                            <Link href={next.href} className="btn-secondary btn-sm shrink-0">
                              {next.label}
                              <ArrowRight size={14} />
                            </Link>
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </AccessGate>
      </div>
    </div>
  );
}
