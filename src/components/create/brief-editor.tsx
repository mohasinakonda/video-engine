'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { EvidenceBadge } from '@/components/youtube-doctor/diagnosis-sections';
import { FORMATS, FORMAT_LABELS, MECHANISMS, MECHANISM_LABELS } from '@/lib/youtube/discover/formats';
import { structureFor } from '@/lib/youtube/create/structures';
import type { CreateConfig, VideoBrief, VideoProject } from './types';

const INTENT_LABELS: Record<VideoBrief['intent'], string> = {
  inform: 'Inform',
  compare: 'Compare',
  teach: 'Teach',
  entertain: 'Entertain',
  persuade: 'Persuade',
};

/** Fields the user must fill before a script can be written. */
function missing(b: VideoBrief): string[] {
  const out: string[] = [];
  if (!b.corePromise.trim()) out.push('core promise');
  if (!b.audience.trim()) out.push('audience');
  if (b.keyPoints.filter((p) => p.trim()).length === 0) out.push('a key point');
  return out;
}

/** Drops empty list items before saving, so validation doesn't trip on a half-added line. */
function clean(b: VideoBrief): VideoBrief {
  return {
    ...b,
    keyPoints: b.keyPoints.map((p) => p.trim()).filter(Boolean),
    keyQuestions: b.keyQuestions.map((q) => q.trim()).filter(Boolean),
    titleDirections: b.titleDirections.filter((d) => d.direction.trim()),
    structure: b.structure.filter((s) => s.label.trim()),
  };
}

export function BriefEditor({
  project,
  brief: initial,
  config,
  saving,
  aiRunning,
  onSave,
  onFillWithAI,
}: {
  project: VideoProject;
  brief: VideoBrief;
  config: CreateConfig;
  saving: boolean;
  aiRunning: boolean;
  onSave: (brief: VideoBrief) => void;
  onFillWithAI: (notes: string) => void;
}) {
  const [brief, setBrief] = useState(initial);
  const [notes, setNotes] = useState('');
  useEffect(() => setBrief(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(clean(brief)) !== JSON.stringify(clean(initial)), [brief, initial]);
  const set = <K extends keyof VideoBrief>(key: K, value: VideoBrief[K]) => setBrief((b) => ({ ...b, [key]: value }));
  const todo = missing(brief);
  const later = ['SCRIPT_READY', 'PACKAGED', 'IN_PRODUCTION'].includes(project.status);
  const hasEmpty = !brief.corePromise || !brief.audience || brief.keyPoints.length === 0 || brief.titleDirections.length === 0 || !brief.thumbnailDirection;

  return (
    <div className="space-y-6 pb-28">
      {brief.supportingEvidence.length > 0 && (
        <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Why this idea</h2>
            {brief.confidence && <EvidenceBadge confidence={brief.confidence} />}
            {brief.productionDifficulty && <span className="text-sm text-zinc-400">· {brief.productionDifficulty} effort</span>}
          </div>
          <ul className="space-y-1.5">
            {brief.supportingEvidence.map((e) => (
              <li key={e.statement} className="text-base text-zinc-300">
                ✓ {e.statement}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section title="The idea">
        <Field label="Topic">
          <input className="input text-base" value={brief.topic} maxLength={120} onChange={(e) => set('topic', e.target.value)} />
        </Field>
        <Field label="Core promise" hint="What the viewer gets by watching to the end. The script is built around this.">
          <textarea className="input text-lg font-medium min-h-[72px]" value={brief.corePromise} maxLength={240} onChange={(e) => set('corePromise', e.target.value)} />
        </Field>
        <Field label="Angle" hint="Your own way into the topic.">
          <input className="input text-base" value={brief.angle} maxLength={160} onChange={(e) => set('angle', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Audience">
            <textarea className="input text-base min-h-[64px]" value={brief.audience} maxLength={240} onChange={(e) => set('audience', e.target.value)} />
          </Field>
          <Field label="Viewer need (optional)">
            <textarea className="input text-base min-h-[64px]" value={brief.problem ?? ''} maxLength={200} onChange={(e) => set('problem', e.target.value || null)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Format">
            <select
              className="input text-base"
              value={brief.format ?? ''}
              onChange={(e) => set('format', (e.target.value || null) as VideoBrief['format'])}
            >
              <option value="">Not chosen</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Goal">
            <select className="input text-base" value={brief.intent} onChange={(e) => set('intent', e.target.value as VideoBrief['intent'])}>
              {(Object.keys(INTENT_LABELS) as VideoBrief['intent'][]).map((i) => (
                <option key={i} value={i}>
                  {INTENT_LABELS[i]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select className="input text-base" value={brief.language} onChange={(e) => set('language', e.target.value as VideoBrief['language'])}>
              <option value="English">English</option>
              <option value="Bangla">বাংলা</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="What the video must cover">
        <TextList label="Key points" items={brief.keyPoints} max={8} maxLength={240} placeholder="A point the video must make" onChange={(v) => set('keyPoints', v)} />
        <TextList label="Questions the viewer wants answered" items={brief.keyQuestions} max={6} maxLength={200} placeholder="A viewer question" onChange={(v) => set('keyQuestions', v)} />
      </Section>

      <Section
        title="Structure"
        action={
          <button type="button" className="btn-ghost btn-sm" onClick={() => set('structure', structureFor(brief.format))}>
            <RotateCcw size={14} />
            Reset to {brief.format ? FORMAT_LABELS[brief.format].toLowerCase() : 'default'}
          </button>
        }
      >
        <p className="text-sm text-zinc-400 -mt-2">The order of the video. The script follows these parts.</p>
        <ol className="space-y-2">
          {brief.structure.map((beat, i) => (
            <li key={`${beat.id}-${i}`} className="flex gap-2 items-start p-3 rounded-xl bg-bg-elevated border border-bg-border">
              <span className="w-6 h-6 mt-2 rounded-full bg-white/10 text-zinc-300 text-sm flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
                <input
                  className="input text-base font-medium"
                  value={beat.label}
                  maxLength={60}
                  onChange={(e) => set('structure', brief.structure.map((b, j) => (j === i ? { ...b, label: e.target.value } : b)))}
                />
                <input
                  className="input text-sm"
                  value={beat.purpose}
                  maxLength={160}
                  placeholder="What this part does"
                  onChange={(e) => set('structure', brief.structure.map((b, j) => (j === i ? { ...b, purpose: e.target.value } : b)))}
                />
              </div>
              <ListControls
                index={i}
                count={brief.structure.length}
                min={2}
                onMove={(d) => set('structure', move(brief.structure, i, d))}
                onRemove={() => set('structure', brief.structure.filter((_, j) => j !== i))}
              />
            </li>
          ))}
        </ol>
        {brief.structure.length < 12 && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => set('structure', [...brief.structure, { id: `part${Date.now()}`, label: 'New part', purpose: '' }])}
          >
            <Plus size={14} />
            Add a part
          </button>
        )}
      </Section>

      <Section title="Packaging direction">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-200">Title directions</p>
          {brief.titleDirections.map((d, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <select
                className="input text-sm sm:w-64"
                value={d.mechanism}
                onChange={(e) => set('titleDirections', brief.titleDirections.map((x, j) => (j === i ? { ...x, mechanism: e.target.value as typeof d.mechanism } : x)))}
              >
                {MECHANISMS.map((m) => (
                  <option key={m} value={m}>
                    {MECHANISM_LABELS[m]}
                  </option>
                ))}
              </select>
              <input
                className="input text-base flex-1"
                value={d.direction}
                maxLength={200}
                onChange={(e) => set('titleDirections', brief.titleDirections.map((x, j) => (j === i ? { ...x, direction: e.target.value } : x)))}
              />
              <button type="button" className="btn-ghost btn-sm text-rose-400" aria-label="Remove" onClick={() => set('titleDirections', brief.titleDirections.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {brief.titleDirections.length < 5 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => set('titleDirections', [...brief.titleDirections, { mechanism: 'question', direction: '' }])}>
              <Plus size={14} />
              Add a direction
            </button>
          )}
        </div>
        <Field label="Thumbnail direction">
          <textarea className="input text-base min-h-[80px]" value={brief.thumbnailDirection} maxLength={400} onChange={(e) => set('thumbnailDirection', e.target.value)} />
        </Field>
      </Section>

      {hasEmpty && (
        <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
          <p className="text-base font-semibold text-white">Let AI fill the empty parts</p>
          <p className="text-sm text-zinc-400">It only fills what’s empty and never changes what you wrote.</p>
          <textarea
            className="input text-base min-h-[64px]"
            value={notes}
            maxLength={1500}
            placeholder="Anything it should know (optional): your style, who watches, what to avoid…"
            onChange={(e) => setNotes(e.target.value)}
          />
          <button type="button" className="btn-secondary" disabled={aiRunning || dirty} onClick={() => onFillWithAI(notes)} title={dirty ? 'Save your changes first' : undefined}>
            {aiRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Fill empty parts · {config.costs.brief} credits
          </button>
          {dirty && <p className="text-sm text-amber-300">Save your changes first.</p>}
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-bg-border bg-bg-base/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1 text-sm text-zinc-400">
            {dirty
              ? later
                ? 'Unsaved changes. Saving sends the script and packaging back for review.'
                : 'Unsaved changes.'
              : todo.length
                ? `To write a script, add: ${todo.join(', ')}.`
                : project.status === 'DRAFT'
                  ? 'Not saved yet.'
                  : 'Brief saved.'}
          </p>
          {!dirty && !todo.length && project.status !== 'DRAFT' && (
            <Link href={`/create/${project.id}/script`} className="btn-primary px-5">
              {project.script ? 'Go to the script' : 'Next: write the script'}
              <ArrowRight size={16} />
            </Link>
          )}
          <button type="button" className={dirty || project.status === 'DRAFT' ? 'btn-primary px-5' : 'btn-ghost px-4'} disabled={(!dirty && project.status !== 'DRAFT') || saving} onClick={() => onSave(clean(brief))}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save brief
          </button>
        </div>
      </div>
    </div>
  );
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(i + d, 0, item);
  return next;
}

function ListControls({ index, count, min, onMove, onRemove }: { index: number; count: number; min: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      <button type="button" className="btn-ghost btn-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
        <ArrowUp size={13} />
      </button>
      <button type="button" className="btn-ghost btn-xs" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
        <ArrowDown size={13} />
      </button>
      <button type="button" className="btn-ghost btn-xs text-rose-400" disabled={count <= min} onClick={onRemove} aria-label="Remove">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function TextList({
  label,
  items,
  max,
  maxLength,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  max: number;
  maxLength: number;
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-zinc-200">{label}</p>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="w-6 h-6 mt-2 rounded-full bg-white/10 text-zinc-300 text-sm flex items-center justify-center shrink-0">{i + 1}</span>
            <input
              className="input text-base flex-1"
              value={item}
              maxLength={maxLength}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <ListControls index={i} count={items.length} min={0} onMove={(d) => onChange(move(items, i, d))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => onChange([...items, ''])}>
          <Plus size={14} />
          Add
        </button>
      )}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-zinc-200">{label}</span>
      {hint && <span className="block text-sm text-zinc-500 -mt-1">{hint}</span>}
      {children}
    </label>
  );
}
