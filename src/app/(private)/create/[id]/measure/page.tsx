'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { PerformanceView, type PerformanceResult } from '@/components/create/performance-view';
import { ProjectHeader, ProjectPlaceholder } from '@/components/create/project-header';
import { runStream, type StreamFailure } from '@/components/create/run-stream';
import type { CreateConfig, VideoProject } from '@/components/create/types';
import { useCreateConfig } from '@/components/create/use-create-config';
import { useProject } from '@/components/create/use-project';
import { StreamError } from '@/components/discover/stream-error';
import { FLOW } from '@/lib/youtube/create/project-state';

type Saved = PerformanceResult & { video: { videoId: string } | null; measuredOn: string };

/** Today's result stays in this tab, so opening the page again doesn't charge again. Never stored on our servers. */
const key = (projectId: string) => `create:performance:${projectId}`;
const today = () => new Date().toISOString().slice(0, 10);

function load(projectId: string): Saved | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(key(projectId)) || 'null') as Saved | null;
    return saved?.measuredOn === today() ? saved : null;
  } catch {
    return null;
  }
}

export default function MeasurePage() {
  const { id } = useParams<{ id: string }>();
  const { config, error: configError } = useCreateConfig();
  const { project, setProject } = useProject(id, !!config?.hasAccess);
  const [result, setResult] = useState<Saved | null>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<(StreamFailure & { readyOn?: string }) | null>(null);

  useEffect(() => setResult(load(id)), [id]);

  const loaded = project && project !== 'missing' ? project : null;
  const status = loaded?.status === 'ARCHIVED' ? loaded.archivedFrom ?? 'DRAFT' : loaded?.status;
  const linked = !!status && FLOW.indexOf(status) >= FLOW.indexOf('PUBLISHED');

  const measure = async (finish = false) => {
    if (!loaded) return;
    setRunning(true);
    setFailure(null);
    const out = await runStream<{ project: VideoProject } & Saved>(`/api/create/projects/${loaded.id}/performance`, { finish });
    setRunning(false);
    if (!out.ok) return setFailure(out.error);
    const saved: Saved = { ...out.data, measuredOn: today() };
    try {
      window.sessionStorage.setItem(key(loaded.id), JSON.stringify({ ...saved, project: undefined }));
    } catch {
      // storage blocked: the result still shows
    }
    setResult(saved);
    setProject(out.data.project);
  };

  const canFinish = loaded?.status === 'ANALYZING' && !!result?.outcomes.some((o) => o.days >= 7);

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href={`/create/${id}/publish`} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Publish
        </Link>

        <AccessGate config={config} error={configError}>
          {!loaded ? (
            <ProjectPlaceholder missing={project === 'missing'} />
          ) : (
            <>
              <ProjectHeader project={loaded} active="measure" />

              {!linked ? (
                <section className="card space-y-3">
                  <h2 className="text-xl font-bold text-white">Link the published video first</h2>
                  <p className="text-base text-zinc-400">Once it’s linked, you can see how it does against your usual videos at the same age.</p>
                  <Link href={`/create/${loaded.id}/publish`} className="btn-primary btn-sm w-fit">
                    Go to publish
                  </Link>
                </section>
              ) : (
                <>
                  <section className="card space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-white">How is it doing?</h2>
                        <p className="text-base text-zinc-400">
                          Compared with your own videos at the same age, at each checkpoint. YouTube reports with a delay of about 3 days.
                        </p>
                      </div>
                      <button type="button" className="btn-primary px-5" disabled={running} onClick={() => measure()}>
                        {running ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                        {result ? 'Check again' : 'Check performance'} · {(config as CreateConfig).costs.performance} credits
                      </button>
                    </div>
                    {loaded.status === 'LEARNED' && (
                      <p className="text-sm text-emerald-300 inline-flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        Measuring is done. What this video taught is saved for Discover.
                      </p>
                    )}
                    {running && <p className="text-sm text-zinc-400">Reading YouTube Analytics for this video and your recent ones… usually under 15 seconds.</p>}
                  </section>

                  {failure && <StreamError error={failure} />}

                  {result && result.outcomes.length > 0 && <PerformanceView result={result} thesis={loaded.thesis} videoId={result.video?.videoId ?? ''} />}

                  {canFinish && (
                    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <p className="flex-1 text-sm text-zinc-400">Seen enough? Close measuring now and keep what it taught. Otherwise it closes by itself after the last checkpoint.</p>
                      <button type="button" className="btn-secondary btn-sm" disabled={running} onClick={() => measure(true)}>
                        Finish measuring
                      </button>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </AccessGate>
      </div>
    </div>
  );
}
