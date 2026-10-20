'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, PenLine, Sparkles } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { PackagingEditor } from '@/components/create/packaging-editor';
import { ProjectHeader, ProjectPlaceholder } from '@/components/create/project-header';
import { runStream, type StreamFailure } from '@/components/create/run-stream';
import type { CreateConfig, VideoProject } from '@/components/create/types';
import { useCreateConfig } from '@/components/create/use-create-config';
import { useProject } from '@/components/create/use-project';
import { StreamError } from '@/components/discover/stream-error';
import { blankThumbnail, blankTitle, emptyPackaging, packagingSchema, type VideoPackaging } from '@/lib/youtube/create/packaging';
import { FLOW } from '@/lib/youtube/create/project-state';
import { scriptSchema } from '@/lib/youtube/create/script';

export default function PackagePage() {
  const { id } = useParams<{ id: string }>();
  const { config, error: configError } = useCreateConfig();
  const { project, setProject } = useProject(id, !!config?.hasAccess);
  const [draft, setDraft] = useState<VideoPackaging | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [failure, setFailure] = useState<StreamFailure | null>(null);

  const loaded = project && project !== 'missing' ? project : null;
  const scriptResult = loaded ? scriptSchema.safeParse(loaded.script) : null;
  const script = scriptResult?.success ? scriptResult.data : null;
  const savedResult = loaded ? packagingSchema.safeParse(loaded.packaging) : null;
  const packaging = savedResult?.success ? savedResult.data : draft;
  // Packaging follows a saved script; a script under review after a brief change counts as not saved.
  const status = loaded?.status === 'ARCHIVED' ? loaded.archivedFrom ?? 'DRAFT' : loaded?.status;
  const scriptSaved = !!script && !!status && FLOW.indexOf(status) >= FLOW.indexOf('SCRIPT_READY');

  const save = async (next: VideoPackaging) => {
    if (!loaded) return;
    setSaving(true);
    setFailure(null);
    const res = await fetch(`/api/create/projects/${loaded.id}/packaging`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setFailure({ message: data.error || 'Could not save the packaging.' });
    setProject(data.project);
    setDraft(null);
  };

  const generate = async (notes: string) => {
    if (!loaded) return;
    setGenerating(true);
    setFailure(null);
    const result = await runStream<{ project: VideoProject }>(`/api/create/projects/${loaded.id}/packaging`, { notes: notes || undefined });
    setGenerating(false);
    if (!result.ok) return setFailure(result.error);
    setProject(result.data.project);
    setDraft(null);
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href={`/create/${id}/script`} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Script
        </Link>

        <AccessGate config={config} error={configError}>
          {!loaded ? (
            <ProjectPlaceholder missing={project === 'missing'} />
          ) : (
            <>
              <ProjectHeader project={loaded} active="package" />

              {failure && <StreamError error={failure} />}

              {!script || !scriptSaved ? (
                <section className="card space-y-3">
                  <h2 className="text-xl font-bold text-white">Save the script first</h2>
                  <p className="text-base text-zinc-400">Titles and thumbnails are made from the finished script, so they promise what the video delivers.</p>
                  <Link href={`/create/${loaded.id}/script`} className="btn-primary btn-sm w-fit">
                    Go to the script
                  </Link>
                </section>
              ) : packaging ? (
                <PackagingEditor
                  project={loaded}
                  script={script}
                  packaging={packaging}
                  config={config as CreateConfig}
                  saving={saving}
                  generating={generating}
                  onSave={save}
                  onGenerate={generate}
                />
              ) : (
                <StartPackaging
                  config={config as CreateConfig}
                  running={generating}
                  onAI={generate}
                  onManual={() => setDraft({ ...emptyPackaging(script.language, script.updatedAt), titles: [blankTitle()], thumbnails: [blankThumbnail()], selectedTitle: 0, selectedThumbnail: 0 })}
                />
              )}
            </>
          )}
        </AccessGate>
      </div>
    </div>
  );
}

function StartPackaging({ config, running, onAI, onManual }: { config: CreateConfig; running: boolean; onAI: (notes: string) => void; onManual: () => void }) {
  const [notes, setNotes] = useState('');

  if (running) {
    return (
      <section className="card space-y-3">
        <p className="text-lg font-semibold text-white flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Coming up with titles and thumbnails…
        </p>
        <p className="text-sm text-zinc-400">Usually under a minute.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Package the video</h2>
        <p className="text-base text-zinc-400 mt-1">
          Title and thumbnail decide whether people click. You’ll get 5 titles that each use a different approach, 3 thumbnail ideas to shoot or design, and a description with tags.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-zinc-200">Anything the AI should know? (optional)</span>
        <textarea
          className="input text-base min-h-[64px]"
          value={notes}
          maxLength={1500}
          placeholder="Your channel’s title style, what your thumbnails usually look like, what to avoid…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" className="btn-primary px-6 py-3 text-base font-semibold" onClick={() => onAI(notes)}>
          <Sparkles size={18} />
          Make packaging ideas · {config.costs.packaging} credits
        </button>
        <button type="button" className="btn-ghost" onClick={onManual}>
          <PenLine size={16} />
          I’ll write my own
        </button>
      </div>
    </section>
  );
}
