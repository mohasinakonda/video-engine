'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Film, Loader2, Lock, Upload, X } from 'lucide-react';
import type { ExtractProgress } from '@/lib/viral-engine/extract';
import type { ViralStage } from '@/lib/viral-engine/server/run';
import type { Phase, RunInput, ViralError } from './use-viral-engine';

interface Props {
  cost: number;
  maxDurationSec: number;
  connected: boolean;
  phase: Phase;
  extract: ExtractProgress | null;
  stages: ViralStage[];
  error: ViralError | null;
  onRun: (input: RunInput) => void;
  onCancel: () => void;
}

const LOCAL_STEPS: { step: ExtractProgress['step']; label: string }[] = [
  { step: 'read', label: 'Opening your video' },
  { step: 'frames', label: 'Reading frames and movement' },
  { step: 'audio', label: 'Measuring sound' },
  { step: 'speech', label: 'Transcribing speech' },
];

const SERVER_STEPS: { stage: ViralStage; label: string }[] = [
  { stage: 'vision', label: 'Looking at the frames' },
  { stage: 'channel', label: 'Comparing with your channel' },
  { stage: 'analyze', label: 'Marking problems on the timeline' },
  { stage: 'write', label: 'Writing your report' },
];

/** Pick a Short and optional details, then real progress for the local and server steps. */
export function PickerPanel({ cost, maxDurationSec, connected, phase, extract, stages, error, onRun, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState('');
  const [useChannel, setUseChannel] = useState(true);
  const [title, setTitle] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [language, setLanguage] = useState<'en' | 'bn'>('en');
  const inputRef = useRef<HTMLInputElement>(null);

  if (phase !== 'idle') {
    const localIndex = extract ? LOCAL_STEPS.findIndex((s) => s.step === extract.step) : 0;
    const serverSteps = SERVER_STEPS.filter((s) => s.stage !== 'channel' || (connected && (useChannel || videoLink.trim())));
    const reached = serverSteps.filter((s) => stages.includes(s.stage)).length;
    return (
      <section className="card space-y-4">
        <p className="text-lg font-semibold text-white">Checking your Short…</p>
        <ol className="space-y-2">
          {LOCAL_STEPS.map((step, i) => {
            const done = phase === 'analyzing' || i < localIndex;
            const active = phase === 'extracting' && i === localIndex;
            return (
              <Step key={step.step} done={done} active={active}>
                {step.label}
                {active && step.step === 'frames' && extract ? ` (${Math.round(extract.progress * 100)}%)` : ''}
              </Step>
            );
          })}
          {serverSteps.map((step, i) => {
            const done = i < reached - 1;
            const active = phase === 'analyzing' && (i === reached - 1 || (reached === 0 && i === 0));
            return (
              <Step key={step.stage} done={done} active={active}>
                {step.label}
              </Step>
            );
          })}
        </ol>
        {phase === 'extracting' ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-400">This part runs on your computer and is free. Your video is not uploaded.</p>
            <button type="button" onClick={onCancel} className="btn-secondary btn-sm">
              <X size={14} />
              Cancel
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Usually under a minute. Please keep this tab open.</p>
        )}
      </section>
    );
  }

  const tags = hashtags
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));

  return (
    <section className="card space-y-5">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/*"
          className="sr-only"
          id="viral-file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="viral-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bg-border bg-bg-elevated px-4 py-8 text-center hover:border-zinc-500"
        >
          {file ? <Film size={22} className="text-emerald-400" /> : <Upload size={22} className="text-zinc-400" />}
          <span className="text-base font-semibold text-white">{file ? file.name : 'Choose your Short'}</span>
          <span className="text-sm text-zinc-400">
            {file ? `${(file.size / 1_000_000).toFixed(1)} MB · click to change` : `MP4, MOV or WebM, up to ${maxDurationSec} seconds`}
          </span>
        </label>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
          <Lock size={12} />
          Your video stays on your computer. We send about 40 still frames and the audio to our AI providers for this check, and save nothing.
        </p>
      </div>

      {connected ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-bg-border bg-bg-elevated px-4 py-3">
          <input type="checkbox" checked={useChannel} onChange={(e) => setUseChannel(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-500" />
          <span>
            <span className="block text-sm font-semibold text-white">Compare with my channel</span>
            <span className="block text-xs text-zinc-400">Checks whether this Short fits your channel’s topics and how it compares with your recent Shorts. Works before you publish.</span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-zinc-400">
          Connect your channel in{' '}
          <Link href="/youtube-doctor" className="text-emerald-300 hover:text-emerald-200">
            Channel Doctor
          </Link>{' '}
          to also check whether this Short fits your channel.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="viral-language" className="label">
            Spoken language
          </label>
          <select id="viral-language" className="input" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'bn')}>
            <option value="en">English</option>
            <option value="bn">Bangla</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="viral-link" className="label">
            Link to the published Short <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="viral-link"
            className="input"
            placeholder="https://youtube.com/shorts/…"
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            disabled={!connected}
          />
          <p className="text-xs text-zinc-400">
            {connected
              ? 'Adds where viewers actually left. The Short must be on your connected channel and at least 3 days old.'
              : 'Connect your channel in Channel Doctor to add real retention.'}
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="viral-title" className="label">
            Title <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input id="viral-title" className="input" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="viral-tags" className="label">
            Hashtags <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input id="viral-tags" className="input" placeholder="#cooking #noodles" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            {error.message}
            {error.refunded ? ' Your credits were refunded.' : ''}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary px-6 py-3 text-base font-semibold"
          disabled={!file}
          onClick={() => file && onRun({ file, videoLink: connected ? videoLink : '', useChannel: connected && useChannel, title, hashtags: tags, language })}
        >
          Check this Short
        </button>
        <span className="text-sm text-zinc-400">{cost > 0 ? `${cost} credits, charged after your video is read` : 'Free'}</span>
      </div>
    </section>
  );
}

function Step({ done, active, children }: { done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${done || active ? 'text-zinc-200' : 'text-zinc-500'}`}>
      {done ? <Check size={16} className="text-emerald-400" /> : active ? <Loader2 size={16} className="animate-spin text-zinc-300" /> : <span className="w-4" />}
      {children}
    </li>
  );
}
