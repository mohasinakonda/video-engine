'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, ClipboardCopy, Download, Loader2, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { MECHANISM_LABELS, titleMechanisms } from '@/lib/youtube/discover/formats';
import {
  THUMBNAIL_FIELDS,
  THUMB_TEXT_WORDS,
  TITLE_MAX,
  TITLE_VISIBLE,
  blankThumbnail,
  blankTitle,
  cleanTags,
  mechanismOf,
  missingForPackaged,
  packagingToText,
  wordsIn,
  type ThumbnailConcept,
  type TitleConcept,
  type VideoPackaging,
} from '@/lib/youtube/create/packaging';
import { scriptToText, type VideoScript } from '@/lib/youtube/create/script';
import { Field, Section } from './brief-editor';
import { IncludedNote } from './included-note';
import { priceTag, type PriceTag } from './pricing';
import type { CreateConfig, VideoProject } from './types';

const RISK_TEXT: Record<TitleConcept['risk'], { label: string; className: string }> = {
  low: { label: 'Matches the video', className: 'text-emerald-300' },
  medium: { label: 'Could overpromise a little', className: 'text-amber-300' },
  high: { label: 'Could overpromise', className: 'text-rose-300' },
};

/** Drops empty concepts (adjusting the choice) and settles each title's mechanism from its wording. */
function clean(p: VideoPackaging): VideoPackaging {
  const keepTitle = p.titles.map((t) => !!t.title.trim());
  const keepThumb = p.thumbnails.map((t) => !!t.mainSubject.trim());
  const reindex = (keep: boolean[], selected: number | null) => (selected === null || !keep[selected] ? null : keep.slice(0, selected).filter(Boolean).length);
  return {
    ...p,
    titles: p.titles.filter((_, i) => keepTitle[i]).map((t) => ({ ...t, title: t.title.trim(), mechanism: mechanismOf(t.title, t.mechanism) })),
    thumbnails: p.thumbnails.filter((_, i) => keepThumb[i]),
    selectedTitle: reindex(keepTitle, p.selectedTitle),
    selectedThumbnail: reindex(keepThumb, p.selectedThumbnail),
    tags: cleanTags(p.tags),
  };
}

export function PackagingEditor({
  project,
  script,
  packaging: initial,
  config,
  saving,
  generating,
  onSave,
  onGenerate,
}: {
  project: VideoProject;
  script: VideoScript;
  packaging: VideoPackaging;
  config: CreateConfig;
  saving: boolean;
  generating: boolean;
  onSave: (packaging: VideoPackaging) => void;
  onGenerate: (notes: string) => void;
}) {
  const [p, setP] = useState(initial);
  const [tagInput, setTagInput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setP(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(clean(p)) !== JSON.stringify(clean(initial)), [p, initial]);
  const set = <K extends keyof VideoPackaging>(key: K, value: VideoPackaging[K]) => setP((x) => ({ ...x, [key]: value }));
  const todo = missingForPackaged(clean(p));
  const stale = script.updatedAt > initial.scriptUpdatedAt;
  const chosenTitle = p.selectedTitle !== null ? p.titles[p.selectedTitle] : null;
  const chosenThumb = p.selectedThumbnail !== null ? p.thumbnails[p.selectedThumbnail] : null;
  const done = ['PACKAGED', 'IN_PRODUCTION'].includes(project.status);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked: the download still works.
    }
  };
  const download = () => {
    const body = `${packagingToText(clean(p))}\n${scriptToText(script, chosenTitle?.title ?? project.title)}`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video-package.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  const addTags = () => {
    const next = cleanTags([...p.tags, ...tagInput.split(',')]);
    set('tags', next);
    setTagInput('');
  };

  return (
    <div className="space-y-6 pb-28">
      {stale && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-base text-amber-100">The script changed after this packaging was made. Check the title still matches what the video delivers, then save.</p>
        </div>
      )}

      <Preview title={chosenTitle?.title ?? null} thumb={chosenThumb} />

      <Section title="1. Choose a title">
        <p className="text-sm text-zinc-400 -mt-2">Different ways to earn the click. The video has to deliver what the title promises.</p>
        <div className="space-y-3">
          {p.titles.map((t, i) => (
            <TitleCard
              key={i}
              concept={t}
              selected={p.selectedTitle === i}
              onSelect={() => set('selectedTitle', p.selectedTitle === i ? null : i)}
              onChange={(c) => set('titles', p.titles.map((x, j) => (j === i ? { ...x, ...c } : x)))}
              onRemove={() =>
                setP((x) => ({
                  ...x,
                  titles: x.titles.filter((_, j) => j !== i),
                  selectedTitle: x.selectedTitle === null || x.selectedTitle === i ? null : x.selectedTitle > i ? x.selectedTitle - 1 : x.selectedTitle,
                }))
              }
            />
          ))}
        </div>
        {p.titles.length < 10 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setP((x) => ({ ...x, titles: [...x.titles, blankTitle()], selectedTitle: x.titles.length }))}>
            <Plus size={14} />
            Write my own title
          </button>
        )}
      </Section>

      <Section title="2. Choose a thumbnail">
        <p className="text-sm text-zinc-400 -mt-2">A brief to shoot or design from. It works with the title: don’t repeat the title’s words on it.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {p.thumbnails.map((t, i) => (
            <ThumbnailCard
              key={i}
              concept={t}
              selected={p.selectedThumbnail === i}
              onSelect={() => set('selectedThumbnail', p.selectedThumbnail === i ? null : i)}
              onChange={(c) => set('thumbnails', p.thumbnails.map((x, j) => (j === i ? { ...x, ...c } : x)))}
              onRemove={() =>
                setP((x) => ({
                  ...x,
                  thumbnails: x.thumbnails.filter((_, j) => j !== i),
                  selectedThumbnail: x.selectedThumbnail === null || x.selectedThumbnail === i ? null : x.selectedThumbnail > i ? x.selectedThumbnail - 1 : x.selectedThumbnail,
                }))
              }
            />
          ))}
        </div>
        {p.thumbnails.length < 6 && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setP((x) => ({ ...x, thumbnails: [...x.thumbnails, blankThumbnail()], selectedThumbnail: x.thumbnails.length }))}
          >
            <Plus size={14} />
            Describe my own thumbnail
          </button>
        )}
      </Section>

      <Section
        title="3. Description and tags"
        action={
          <button type="button" className="btn-ghost btn-sm" onClick={() => copy('description', p.description)} disabled={!p.description}>
            {copied === 'description' ? <Check size={14} /> : <ClipboardCopy size={14} />}
            Copy description
          </button>
        }
      >
        <Field label="Description" hint="Add chapters after the video is edited: timings aren’t known yet.">
          <textarea className="input text-base min-h-[140px]" value={p.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-200">Tags</p>
            <button type="button" className="btn-ghost btn-xs" onClick={() => copy('tags', p.tags.join(', '))} disabled={!p.tags.length}>
              {copied === 'tags' ? <Check size={13} /> : <ClipboardCopy size={13} />}
              Copy tags
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-white/[0.07] text-xs text-zinc-200">
                {tag}
                <button type="button" aria-label={`Remove ${tag}`} className="text-zinc-500 hover:text-rose-300" onClick={() => set('tags', p.tags.filter((x) => x !== tag))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input text-sm flex-1"
              value={tagInput}
              placeholder="Add tags, separated by commas"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTags();
                }
              }}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={addTags} disabled={!tagInput.trim()}>
              Add
            </button>
          </div>
          <p className="text-xs text-zinc-500">{p.tags.join(',').length}/500 characters (YouTube’s limit)</p>
        </div>
      </Section>

      <GenerateMore price={priceTag(project, config, 'packaging')} running={generating} disabled={dirty} onRun={onGenerate} />

      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-bg-border bg-bg-base/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1 text-sm text-zinc-400">
            {todo.length ? `To finish packaging: ${todo.join(' and ')}.` : dirty ? 'Unsaved changes.' : stale ? 'Save once you’ve checked it against the new script.' : done ? 'Packaged. Ready to make the video.' : 'Save to finish packaging.'}
          </p>
          <button type="button" className="btn-ghost px-4" onClick={download}>
            <Download size={16} />
            Download package
          </button>
          <button
            type="button"
            className={dirty || stale || (!done && !todo.length) ? 'btn-primary px-5' : 'btn-ghost px-4'}
            disabled={(!dirty && !stale && (done || !!todo.length)) || saving || generating}
            onClick={() => onSave(clean(p))}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save packaging
          </button>
          {done && !dirty && !stale && (
            <Link href={`/create/${project.id}/publish`} className="btn-primary px-5">
              Next: publish
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** How the choice looks together, roughly as in a feed. */
function Preview({ title, thumb }: { title: string | null; thumb: ThumbnailConcept | null }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5">
      <p className="text-sm font-semibold text-zinc-300 mb-3">Your package</p>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-72 aspect-video rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-bg-border overflow-hidden shrink-0 flex items-end p-3">
          {thumb ? (
            <>
              <p className="absolute inset-0 p-3 text-xs text-zinc-300/80 leading-snug">{thumb.mainSubject}</p>
              {thumb.text && <p className="relative text-xl font-black text-white uppercase leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">{thumb.text}</p>}
            </>
          ) : (
            <p className="text-sm text-zinc-500">Choose a thumbnail</p>
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-lg font-semibold leading-snug ${title ? 'text-white' : 'text-zinc-500'}`}>{title ?? 'Choose a title'}</p>
          {title && title.length > TITLE_VISIBLE && <p className="text-sm text-amber-300 mt-1">Long titles get cut off after about {TITLE_VISIBLE} characters.</p>}
        </div>
      </div>
    </section>
  );
}

function TitleCard({
  concept,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  concept: TitleConcept;
  selected: boolean;
  onSelect: () => void;
  onChange: (c: Partial<TitleConcept>) => void;
  onRemove: () => void;
}) {
  const shown = titleMechanisms(concept.title);
  const mechanism = shown.length && !shown.includes(concept.mechanism) ? shown[0] : concept.mechanism;
  return (
    <div className={`rounded-xl border p-4 space-y-2 transition-colors ${selected ? 'border-white bg-white/5' : 'border-bg-border bg-bg-elevated'}`}>
      <div className="flex gap-3 items-start">
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label="Choose this title"
          onClick={onSelect}
          className={`w-5 h-5 mt-2 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-white bg-white' : 'border-zinc-500'}`}
        >
          {selected && <Check size={12} className="text-zinc-950" />}
        </button>
        <input
          className="input text-base font-semibold flex-1"
          value={concept.title}
          maxLength={TITLE_MAX}
          placeholder="Your title"
          onChange={(e) => onChange({ title: e.target.value, source: 'manual' })}
        />
        <button type="button" className="btn-ghost btn-xs text-rose-400 mt-1.5" aria-label="Remove title" onClick={onRemove}>
          <Trash2 size={13} />
        </button>
      </div>
      <div className="pl-8 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className={concept.title.length > TITLE_VISIBLE ? 'text-amber-300' : 'text-zinc-500'}>{concept.title.length}/{TITLE_VISIBLE}</span>
        {concept.title && <span className="text-zinc-300">{MECHANISM_LABELS[mechanism]}</span>}
        {concept.source === 'ai' && <span className={RISK_TEXT[concept.risk].className}>{RISK_TEXT[concept.risk].label}</span>}
      </div>
      {concept.source === 'ai' && (concept.rationale || concept.audience) && (
        <p className="pl-8 text-sm text-zinc-400">
          {concept.rationale}
          {concept.audience && <span className="text-zinc-500"> · For: {concept.audience}</span>}
        </p>
      )}
    </div>
  );
}

function ThumbnailCard({
  concept,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  concept: ThumbnailConcept;
  selected: boolean;
  onSelect: () => void;
  onChange: (c: Partial<ThumbnailConcept>) => void;
  onRemove: () => void;
}) {
  const tooManyWords = wordsIn(concept.text) > THUMB_TEXT_WORDS;
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${selected ? 'border-white bg-white/5' : 'border-bg-border bg-bg-elevated'}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={onSelect}
          className={`inline-flex items-center gap-2 text-sm font-semibold ${selected ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-white bg-white' : 'border-zinc-500'}`}>
            {selected && <Check size={12} className="text-zinc-950" />}
          </span>
          {selected ? 'Chosen' : 'Choose this thumbnail'}
        </button>
        <span className="flex-1" />
        <button type="button" className="btn-ghost btn-xs text-rose-400" aria-label="Remove thumbnail" onClick={onRemove}>
          <Trash2 size={13} />
        </button>
      </div>
      {THUMBNAIL_FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="block text-xs font-semibold text-zinc-400">{f.label}</span>
          <input
            className={`input text-sm py-1.5 ${f.key === 'mainSubject' || f.key === 'text' ? 'font-medium' : ''}`}
            value={concept[f.key]}
            maxLength={f.key === 'text' ? 40 : 240}
            placeholder={f.key === 'mainSubject' ? 'Required' : ''}
            onChange={(e) => onChange({ [f.key]: e.target.value, source: 'manual' })}
          />
          {f.key === 'text' && tooManyWords && <span className="text-xs text-amber-300">More than {THUMB_TEXT_WORDS} words is hard to read at a glance.</span>}
        </label>
      ))}
    </div>
  );
}

function GenerateMore({ price, running, disabled, onRun }: { price: PriceTag; running: boolean; disabled: boolean; onRun: (notes: string) => void }) {
  const [notes, setNotes] = useState('');
  if (running)
    return (
      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5">
        <p className="text-base text-white flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Coming up with new ideas…
        </p>
      </section>
    );
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
      <p className="text-base font-semibold text-white">More ideas</p>
      <p className="text-sm text-zinc-400">New titles and thumbnails replace the ones you haven’t chosen. Your chosen ones, description and tags are kept.</p>
      <input
        className="input text-sm"
        value={notes}
        maxLength={1500}
        placeholder="What should be different? (optional) e.g. more curious, shorter, about the anglerfish"
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="button" className="btn-secondary" disabled={disabled} onClick={() => onRun(notes)}>
        <Sparkles size={16} />
        New ideas
      </button>
      {disabled ? <p className="text-sm text-amber-300">Save your changes first.</p> : <IncludedNote note={price.note} included={price.included} />}
    </section>
  );
}
