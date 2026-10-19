'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, PenLine, Sparkles } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { ProjectHeader, ProjectPlaceholder } from '@/components/create/project-header';
import { runStream, type StreamFailure } from '@/components/create/run-stream';
import { LengthAndNotes, MINUTE_OPTIONS, ScriptEditor } from '@/components/create/script-editor';
import type { CreateConfig, VideoBrief, VideoProject, VideoScript } from '@/components/create/types';
import { useCreateConfig } from '@/components/create/use-create-config';
import { useProject } from '@/components/create/use-project';
import { StreamError } from '@/components/discover/stream-error';
import { briefSchema, missingForScript } from '@/lib/youtube/create/brief';
import { defaultMinutes, emptyScript, scriptSchema } from '@/lib/youtube/create/script';

export default function ScriptPage() {
  const { id } = useParams<{ id: string }>();
  const { config, error: configError } = useCreateConfig();
  const { project, setProject } = useProject(id, !!config?.hasAccess);
  const [draft, setDraft] = useState<VideoScript | null>(null);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [failure, setFailure] = useState<StreamFailure | null>(null);

  const loaded = project && project !== 'missing' ? project : null;
  const briefResult = loaded ? briefSchema.safeParse(loaded.brief) : null;
  const brief = briefResult?.success ? briefResult.data : null;
  const savedResult = loaded ? scriptSchema.safeParse(loaded.script) : null;
  const script = savedResult?.success ? savedResult.data : draft;

  const save = async (next: VideoScript) => {
    if (!loaded) return;
    setSaving(true);
    setFailure(null);
    const res = await fetch(`/api/create/projects/${loaded.id}/script`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setFailure({ message: data.error || 'Could not save the script.' });
    setProject(data.project);
    setDraft(null);
  };

  const write = async (body: { targetMinutes?: number; notes?: string; sectionId?: string }) => {
    if (!loaded) return;
    setRewriting(body.sectionId ?? 'all');
    setFailure(null);
    const result = await runStream<{ project: VideoProject }>(`/api/create/projects/${loaded.id}/script`, { ...body, notes: body.notes || undefined });
    setRewriting(null);
    if (!result.ok) return setFailure(result.error);
    setProject(result.data.project);
    setDraft(null);
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href={`/create/${id}`} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Brief
        </Link>

        <AccessGate config={config} error={configError}>
          {!loaded ? (
            <ProjectPlaceholder missing={project === 'missing'} />
          ) : (
            <>
              <ProjectHeader project={loaded} active="script" />

              {failure && <StreamError error={failure} />}

              {!brief || missingForScript(brief).length > 0 ? (
                <BriefFirst projectId={loaded.id} missing={brief ? missingForScript(brief) : null} />
              ) : script ? (
                <ScriptEditor
                  project={loaded}
                  brief={brief}
                  script={script}
                  config={config as CreateConfig}
                  saving={saving}
                  rewriting={rewriting}
                  onSave={save}
                  onRewrite={(sectionId, notes) => write({ sectionId, notes })}
                  onRewriteAll={(targetMinutes, notes) => write({ targetMinutes, notes })}
                />
              ) : (
                <StartScript
                  brief={brief}
                  config={config as CreateConfig}
                  running={rewriting === 'all'}
                  onAI={(targetMinutes, notes) => write({ targetMinutes, notes })}
                  onManual={(minutes) => setDraft(emptyScript(brief, minutes))}
                />
              )}
            </>
          )}
        </AccessGate>
      </div>
    </div>
  );
}

function BriefFirst({ projectId, missing }: { projectId: string; missing: string[] | null }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-xl font-bold text-white">Finish the brief first</h2>
      <p className="text-base text-zinc-400">
        {missing ? `The script is written from the brief. Add: ${missing.join(', ')}.` : 'The script is written from the brief, and there isn’t one yet.'}
      </p>
      <Link href={`/create/${projectId}`} className="btn-primary btn-sm w-fit">
        Go to the brief
      </Link>
    </section>
  );
}

/** First step: the AI writes every part from the brief, or the user writes them. */
function StartScript({
  brief,
  config,
  running,
  onAI,
  onManual,
}: {
  brief: VideoBrief;
  config: CreateConfig;
  running: boolean;
  onAI: (minutes: number, notes: string) => void;
  onManual: (minutes: number) => void;
}) {
  const suggested = defaultMinutes(brief.format);
  const [minutes, setMinutes] = useState(MINUTE_OPTIONS.includes(suggested) ? suggested : 8);
  const [notes, setNotes] = useState('');

  if (running) {
    return (
      <section className="card space-y-3">
        <p className="text-lg font-semibold text-white flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Writing your script…
        </p>
        <p className="text-sm text-zinc-400">Usually under a minute. Each part follows your brief’s structure.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Write the script</h2>
        <p className="text-base text-zinc-400 mt-1">
          The script follows your brief, part by part: {brief.structure.map((b) => b.label).join(' → ')}.
        </p>
      </div>
      <p className="text-base text-zinc-200">
        Promise: <span className="font-semibold">{brief.corePromise}</span>
      </p>
      <LengthAndNotes minutes={minutes} notes={notes} onMinutes={setMinutes} onNotes={setNotes} />
      <p className="text-sm text-zinc-500">
        Facts the brief doesn’t back are marked “Check this”, so you can verify them before recording.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" className="btn-primary px-6 py-3 text-base font-semibold" onClick={() => onAI(minutes, notes)}>
          <Sparkles size={18} />
          Write my script · {config.costs.script} credits
        </button>
        <button type="button" className="btn-ghost" onClick={() => onManual(minutes)}>
          <PenLine size={16} />
          I’ll write it myself
        </button>
      </div>
    </section>
  );
}
