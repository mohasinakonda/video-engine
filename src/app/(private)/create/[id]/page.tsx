'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, PenLine, Sparkles } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { BriefEditor } from '@/components/create/brief-editor';
import { ProjectHeader, ProjectPlaceholder } from '@/components/create/project-header';
import { runStream, type StreamFailure } from '@/components/create/run-stream';
import { type CreateConfig, type VideoBrief, type VideoProject } from '@/components/create/types';
import { useCreateConfig } from '@/components/create/use-create-config';
import { useProject } from '@/components/create/use-project';
import { StreamError } from '@/components/discover/stream-error';
import { briefFromThesis, briefSchema, emptyBrief } from '@/lib/youtube/create/brief';

/** Bangla when the text is mostly Bangla script (kept here: the server helper pulls in AI code). */
const guessLanguage = (text: string): VideoBrief['language'] => ((text.match(/[\u0980-\u09FF]/g)?.length ?? 0) > text.length / 3 ? 'Bangla' : 'English');

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { config, error: configError } = useCreateConfig();
  const { project, setProject } = useProject(id, !!config?.hasAccess);
  const [draft, setDraft] = useState<VideoBrief | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [failure, setFailure] = useState<StreamFailure | null>(null);

  const saved = project && project !== 'missing' ? briefSchema.safeParse(project.brief) : null;
  const brief = saved?.success ? saved.data : draft;

  const save = async (next: VideoBrief) => {
    if (!project || project === 'missing') return;
    setSaving(true);
    setFailure(null);
    const res = await fetch(`/api/create/projects/${project.id}/brief`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setFailure({ message: data.error || 'Could not save the brief.' });
    setProject(data.project);
    setDraft(null);
  };

  const fillWithAI = async (notes: string, language?: VideoBrief['language']) => {
    if (!project || project === 'missing') return;
    setAiRunning(true);
    setFailure(null);
    const result = await runStream<{ project: VideoProject }>(`/api/create/projects/${project.id}/brief`, { notes: notes || undefined, language });
    setAiRunning(false);
    if (!result.ok) return setFailure(result.error);
    setProject(result.data.project);
    setDraft(null);
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href="/create" className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          All videos
        </Link>

        <AccessGate config={config} error={configError}>
          {project === null || project === 'missing' ? (
            <ProjectPlaceholder missing={project === 'missing'} />
          ) : (
            <>
              <ProjectHeader project={project} active="brief" />

              {failure && <StreamError error={failure} />}

              {brief ? (
                <BriefEditor project={project} brief={brief} config={config as CreateConfig} saving={saving} aiRunning={aiRunning} onSave={save} onFillWithAI={(n) => fillWithAI(n)} />
              ) : (
                <StartBrief
                  project={project}
                  config={config as CreateConfig}
                  running={aiRunning}
                  onAI={(notes, language) => fillWithAI(notes, language)}
                  onManual={(language) =>
                    setDraft(project.thesis ? { ...briefFromThesis(project.thesis, language), source: 'manual' } : emptyBrief(project.title, language))
                  }
                />
              )}
            </>
          )}
        </AccessGate>
      </div>
    </div>
  );
}

/** First step: let the AI draft the brief, or write it yourself. */
function StartBrief({
  project,
  config,
  running,
  onAI,
  onManual,
}: {
  project: VideoProject;
  config: CreateConfig;
  running: boolean;
  onAI: (notes: string, language: VideoBrief['language']) => void;
  onManual: (language: VideoBrief['language']) => void;
}) {
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState<VideoBrief['language']>(guessLanguage(project.thesis?.topic ?? project.title));

  if (running) {
    return (
      <section className="card space-y-3">
        <p className="text-lg font-semibold text-white flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Writing your brief…
        </p>
        <p className="text-sm text-zinc-400">Usually about 15 seconds.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Plan this video</h2>
        <p className="text-base text-zinc-400 mt-1">
          A brief says who the video is for, what it promises and what it must cover. The script is written from it.
        </p>
      </div>
      {project.thesis && (
        <p className="text-base text-zinc-200">
          Idea from Discover: <span className="font-semibold">{project.thesis.recommendedAngle ?? project.thesis.topic}</span>
        </p>
      )}
      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-zinc-200">Anything the AI should know? (optional)</span>
        <textarea
          className="input text-base min-h-[72px]"
          value={notes}
          maxLength={1500}
          placeholder="Your style, who watches, what to include or avoid…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        Write in
        <select className="input text-sm py-1.5 w-auto" value={language} onChange={(e) => setLanguage(e.target.value as VideoBrief['language'])}>
          <option value="English">English</option>
          <option value="Bangla">বাংলা</option>
        </select>
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" className="btn-primary px-6 py-3 text-base font-semibold" onClick={() => onAI(notes, language)}>
          <Sparkles size={18} />
          Draft my brief · {config.costs.brief} credits
        </button>
        <button type="button" className="btn-ghost" onClick={() => onManual(language)}>
          <PenLine size={16} />
          I’ll write it myself
        </button>
      </div>
    </section>
  );
}
