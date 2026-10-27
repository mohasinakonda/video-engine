'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Check, Clapperboard, ClipboardCopy, Download, Loader2, Mic, Plus, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react';
import {
  AI_MAX_MINUTES,
  AI_MIN_MINUTES,
  CLAIM_KINDS,
  ISSUE_TEXT,
  estimateSeconds,
  isStale,
  narrationText,
  researchChecklist,
  scriptToText,
  sectionIssues,
  targetWords,
  wordCount,
} from '@/lib/youtube/create/script';
import { IncludedNote } from './included-note';
import { priceTag, type PriceTag } from './pricing';
import type { ClaimKind, CreateConfig, ScriptSection, VideoBrief, VideoProject, VideoScript } from './types';

export const CLAIM_LABELS: Record<ClaimKind, { label: string; hint: string; className: string }> = {
  evidence: { label: 'Evidence', hint: 'Backed by the brief', className: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  needs_research: { label: 'Check this', hint: 'Verify before recording', className: 'bg-amber-500/10 text-amber-200 border-amber-500/30' },
  creative: { label: 'Creative', hint: 'Opinion, story or framing', className: 'bg-sky-500/10 text-sky-200 border-sky-500/30' },
};

export const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Lengths offered for AI writing, in minutes. */
export const MINUTE_OPTIONS = [2, 3, 5, 8, 10, 12, 15].filter((m) => m >= AI_MIN_MINUTES && m <= AI_MAX_MINUTES);

/** Runs of characters other than letters and digits (any script), for file names. */
const FILE_UNSAFE = new RegExp('[^\\p{L}\\p{M}\\p{N}]+', 'gu');

const clean = (s: VideoScript): VideoScript => ({
  ...s,
  sections: s.sections.map((x) => ({ ...x, heading: x.heading.trim() || 'Part', claims: x.claims.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text) })),
});

export function ScriptEditor({
  project,
  brief,
  script: initial,
  config,
  saving,
  rewriting,
  onSave,
  onRewrite,
  onRewriteAll,
}: {
  project: VideoProject;
  brief: VideoBrief;
  script: VideoScript;
  config: CreateConfig;
  saving: boolean;
  /** The part being rewritten, or 'all'. */
  rewriting: string | null;
  onSave: (script: VideoScript) => void;
  onRewrite: (sectionId: string, notes: string) => void;
  onRewriteAll: (targetMinutes: number, notes: string) => void;
}) {
  const [script, setScript] = useState(initial);
  const [copied, setCopied] = useState(false);
  useEffect(() => setScript(initial), [initial]);

  const dirty = useMemo(() => JSON.stringify(clean(script)) !== JSON.stringify(clean(initial)), [script, initial]);
  const issues = useMemo(() => sectionIssues(script), [script]);
  const targets = useMemo(() => targetWords(script.sections, script.targetMinutes, script.language), [script]);
  const checklist = researchChecklist(script);
  const totalSec = script.sections.reduce((sum, s) => sum + estimateSeconds(s.narration, script.language), 0);
  const totalWords = script.sections.reduce((sum, s) => sum + wordCount(s.narration), 0);
  const unwritten = script.sections.filter((s) => !s.narration.trim()).length;
  const stale = isStale(initial, brief);
  const busy = rewriting !== null;

  const setSection = (id: string, change: Partial<ScriptSection>) => setScript((s) => ({ ...s, sections: s.sections.map((x) => (x.id === id ? { ...x, ...change } : x)) }));

  const text = () => scriptToText(clean(script), project.title);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the download still works.
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(FILE_UNSAFE, '-').replace(/^-|-$/g, '').slice(0, 60) || 'script'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Hands the saved narration to another tool. Each key holds one script and the page that reads it removes it,
  // so nothing piles up. Voice uses sessionStorage, which the browser also clears when the tab closes;
  // the scene maker already reads `pending_script` from localStorage.
  const router = useRouter();
  const canHandOff = !dirty && project.status !== 'BRIEF_READY' && unwritten === 0 && !busy;
  const handOff = (to: 'voice' | 'scenes') => {
    const narration = narrationText(clean(initial));
    try {
      if (to === 'voice') sessionStorage.setItem('pending_voice_script', narration);
      else localStorage.setItem('pending_script', narration);
    } catch {
      // Storage blocked or full: the tool still opens, and Copy still works.
    }
    window.open(to === 'voice' ? '/voice-studio' : '/project/new', "_blank")
    // router.push(to === 'voice' ? '/voice-studio' : '/project/new');
  };

  return (
    <div className="space-y-6 pb-28">
      {stale && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-base text-amber-100">The brief changed after this script was written. Read it through and save, or write it again from the new brief.</p>
        </div>
      )}

      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-2xl font-bold text-white tabular-nums">
            ~{formatTime(totalSec)} <span className="text-base font-normal text-zinc-400">of {script.targetMinutes}:00 target</span>
          </p>
          <p className="text-sm text-zinc-400">
            {totalWords} words · {script.sections.length} parts
            {unwritten > 0 && <span className="text-amber-300"> · {unwritten} not written yet</span>}
            {checklist.length > 0 && <span className="text-amber-300"> · {checklist.length} to check</span>}
          </p>
          <p className="text-xs text-zinc-500">Time is estimated from words at a normal speaking pace.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={copy}>
            {copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={download}>
            <Download size={15} />
            Download
          </button>
        </div>
      </section>

      {checklist.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Check before recording</h2>
          <p className="text-sm text-zinc-400">These are facts the brief doesn’t back. Verify each one, or change the line.</p>
          <ul className="space-y-2">
            {checklist.map((c, i) => (
              <li key={i} className="text-base text-zinc-200">
                <a href={`#part-${c.sectionId}`} className="text-sm text-zinc-500 hover:text-zinc-300 mr-2">
                  {c.heading}
                </a>
                {c.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="space-y-4">
        {script.sections.map((s, i) => (
          <SectionCard
            key={s.id}
            index={i}
            section={s}
            language={script.language}
            target={targets.get(s.id) ?? 100}
            issues={issues.get(s.id) ?? []}
            price={priceTag(project, config, 'section')}
            dirty={dirty}
            rewriting={rewriting === s.id}
            busy={busy}
            onChange={(change) => setSection(s.id, change)}
            onRewrite={(notes) => onRewrite(s.id, notes)}
          />
        ))}
      </ol>

      <RewriteAll script={initial} price={priceTag(project, config, 'script')} running={rewriting === 'all'} disabled={busy || dirty} onRun={onRewriteAll} />

      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-bg-border bg-bg-base/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1 text-sm text-zinc-400">
            {dirty
              ? project.status === 'PACKAGED'
                ? 'Unsaved changes. Saving sends the packaging back for review.'
                : 'Unsaved changes.'
              : stale
                ? 'Save once you’ve checked it against the new brief.'
                : project.status === 'BRIEF_READY'
                  ? 'Not saved yet.'
                  : 'Script saved.'}
          </p>
          <button
            type="button"
            className={dirty || stale || project.status === 'BRIEF_READY' ? 'btn-primary px-5' : 'btn-ghost px-4'}
            disabled={(!dirty && !stale && project.status !== 'BRIEF_READY') || saving || busy}
            onClick={() => onSave(clean(script))}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save script
          </button>
          {canHandOff && (
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => handOff('voice')}>
                <Mic size={16} />
                Make voice
              </button>
              <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => handOff('scenes')}>
                <Clapperboard size={16} />
                Make scenes
              </button>
            </div>
          )}
          {!dirty && !stale && project.status !== 'BRIEF_READY' && (
            <Link href={`/create/${project.id}/package`} className="btn-primary px-5">
              {project.packaging ? 'Go to packaging' : 'Next: title & thumbnail'}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  index,
  section,
  language,
  target,
  issues,
  price,
  dirty,
  rewriting,
  busy,
  onChange,
  onRewrite,
}: {
  index: number;
  section: ScriptSection;
  language: VideoScript['language'];
  target: number;
  issues: (keyof typeof ISSUE_TEXT)[];
  price: PriceTag;
  dirty: boolean;
  rewriting: boolean;
  busy: boolean;
  onChange: (change: Partial<ScriptSection>) => void;
  onRewrite: (notes: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [notes, setNotes] = useState('');
  const words = wordCount(section.narration);
  const shown = issues.filter((i) => i !== 'empty');

  return (
    <li id={`part-${section.id}`} className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3 scroll-mt-24">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 mt-1 rounded-full bg-white/10 text-zinc-300 text-sm flex items-center justify-center shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <input
            className="w-full bg-transparent text-lg font-semibold text-white outline-none focus:underline decoration-zinc-600"
            value={section.heading}
            maxLength={80}
            aria-label="Part heading"
            onChange={(e) => onChange({ heading: e.target.value })}
          />
          {section.purpose && <p className="text-sm text-zinc-500">{section.purpose}</p>}
        </div>
        <span className="text-sm text-zinc-400 tabular-nums shrink-0 mt-1.5">
          {words}/{target} words · ~{formatTime(estimateSeconds(section.narration, language))}
        </span>
      </div>

      {section.needsWriting && !section.narration.trim() && (
        <p className="text-sm text-amber-300">The AI couldn’t write a usable version of this part. Write it yourself, or try rewriting it.</p>
      )}

      <textarea
        className="input text-base leading-relaxed w-full"
        rows={Math.max(4, Math.ceil(section.narration.length / 85))}
        value={section.narration}
        maxLength={8000}
        placeholder="What you’ll say in this part…"
        onChange={(e) => onChange({ narration: e.target.value })}
      />

      {shown.length > 0 && (
        <ul className="space-y-1">
          {shown.map((i) => (
            <li key={i} className="text-sm text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {ISSUE_TEXT[i]}
            </li>
          ))}
        </ul>
      )}

      <Claims claims={section.claims} onChange={(claims) => onChange({ claims })} />

      {asking ? (
        <div className="space-y-2 rounded-xl bg-bg-elevated border border-bg-border p-3">
          <input
            className="input text-sm"
            value={notes}
            maxLength={1500}
            placeholder="What should change? (optional) e.g. shorter, more concrete, a story to open"
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy || dirty}
              onClick={() => {
                onRewrite(notes);
                setAsking(false);
                setNotes('');
              }}
            >
              <Sparkles size={14} />
              Rewrite
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAsking(false)}>
              Cancel
            </button>
            {dirty && <span className="text-sm text-amber-300 self-center">Save your changes first.</span>}
          </div>
          {!dirty && <IncludedNote note={price.note} included={price.included} />}
        </div>
      ) : (
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setAsking(true)}>
          {rewriting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {rewriting ? 'Rewriting this part…' : section.narration.trim() ? 'Rewrite this part with AI' : 'Write this part with AI'}
        </button>
      )}
    </li>
  );
}

function Claims({ claims, onChange }: { claims: ScriptSection['claims']; onChange: (claims: ScriptSection['claims']) => void }) {
  if (claims.length === 0)
    return (
      <button type="button" className="btn-ghost btn-xs text-zinc-500" onClick={() => onChange([{ text: '', kind: 'needs_research' }])}>
        <Plus size={13} />
        Add a claim to check
      </button>
    );
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-zinc-300">Claims in this part</p>
      {claims.map((c, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-1.5 sm:items-center">
          <select
            className={`text-xs font-medium rounded-lg border px-2 py-1 sm:w-32 ${CLAIM_LABELS[c.kind].className}`}
            value={c.kind}
            title={CLAIM_LABELS[c.kind].hint}
            onChange={(e) => onChange(claims.map((x, j) => (j === i ? { ...x, kind: e.target.value as ClaimKind } : x)))}
          >
            {CLAIM_KINDS.map((k) => (
              <option key={k} value={k}>
                {CLAIM_LABELS[k].label}
              </option>
            ))}
          </select>
          <input
            className="input text-sm flex-1 py-1.5"
            value={c.text}
            maxLength={300}
            onChange={(e) => onChange(claims.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
          />
          <button type="button" className="btn-ghost btn-xs text-rose-400 self-end sm:self-auto" aria-label="Remove claim" onClick={() => onChange(claims.filter((_, j) => j !== i))}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {claims.length < 12 && (
        <button type="button" className="btn-ghost btn-xs text-zinc-500" onClick={() => onChange([...claims, { text: '', kind: 'needs_research' }])}>
          <Plus size={13} />
          Add a claim
        </button>
      )}
    </div>
  );
}

function RewriteAll({ script, price, running, disabled, onRun }: { script: VideoScript; price: PriceTag; running: boolean; disabled: boolean; onRun: (minutes: number, notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(MINUTE_OPTIONS.includes(script.targetMinutes) ? script.targetMinutes : 8);
  const [notes, setNotes] = useState('');

  if (running)
    return (
      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5">
        <p className="text-base text-white flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Writing the whole script again… usually under a minute.
        </p>
      </section>
    );

  return open ? (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-white">Write the whole script again</p>
        <button type="button" className="btn-ghost btn-xs" aria-label="Close" onClick={() => setOpen(false)}>
          <X size={14} />
        </button>
      </div>
      <p className="text-sm text-zinc-400">This replaces every part, including your edits, using the current brief.</p>
      <LengthAndNotes minutes={minutes} notes={notes} onMinutes={setMinutes} onNotes={setNotes} />
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => {
          if (window.confirm('Replace the whole script? Your edits to it will be lost.')) onRun(minutes, notes);
        }}
      >
        <Sparkles size={16} />
        Write again
      </button>
      <IncludedNote note={price.note} included={price.included} />
      {disabled && <p className="text-sm text-amber-300">Save your changes first.</p>}
    </section>
  ) : (
    <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
      <RefreshCw size={14} />
      Write the whole script again
    </button>
  );
}

export function LengthAndNotes({ minutes, notes, onMinutes, onNotes }: { minutes: number; notes: string; onMinutes: (m: number) => void; onNotes: (n: string) => void }) {
  return (
    <>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        Video length
        <select className="input text-sm py-1.5 w-auto" value={minutes} onChange={(e) => onMinutes(Number(e.target.value))}>
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              about {m} minutes
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-zinc-200">Anything the AI should know? (optional)</span>
        <textarea
          className="input text-base min-h-[64px]"
          value={notes}
          maxLength={1500}
          placeholder="Your speaking style, a story to include, what to avoid…"
          onChange={(e) => onNotes(e.target.value)}
        />
      </label>
    </>
  );
}
