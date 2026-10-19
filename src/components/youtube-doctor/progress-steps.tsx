'use client';

import { Check, Loader2 } from 'lucide-react';
import type { DiagnosisStage } from '@/lib/youtube/types';

export interface ProgressStep<S extends string> {
  stage: S;
  /** Receives the count the server reported for this stage, if any. */
  label: string | ((count: number | undefined) => string);
}

const STEPS: ProgressStep<DiagnosisStage>[] = [
  { stage: 'connect', label: 'Connecting to YouTube' },
  { stage: 'fetch_channel', label: 'Reading your videos' },
  { stage: 'fetch_analytics', label: 'Loading your analytics' },
  { stage: 'retention', label: 'Checking where people stop watching' },
  { stage: 'compare_videos', label: 'Comparing your videos' },
  { stage: 'packaging', label: 'Looking at your thumbnails' },
  { stage: 'ai_report', label: 'Writing your plan' },
];

/** Screen 5: the server's real stages. No percentage, because the server doesn't know one. */
export function ProgressSteps<S extends string = DiagnosisStage>({
  reached,
  steps = STEPS as unknown as ProgressStep<S>[],
  counts = {},
}: {
  reached: S[];
  steps?: ProgressStep<S>[];
  counts?: Partial<Record<S, number>>;
}) {
  const lastIndex = Math.max(-1, ...reached.map((s) => steps.findIndex((step) => step.stage === s)));
  const isDone = (reached as string[]).includes('done');

  return (
    <ol className="space-y-3" aria-live="polite">
      {steps.map((step, index) => {
        const done = index < lastIndex || isDone;
        const active = index === lastIndex && !isDone;
        const label = typeof step.label === 'function' ? step.label(counts[step.stage]) : step.label;
        return (
          <li key={step.stage} className="flex items-center gap-3 text-base">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                done ? 'bg-emerald-500 text-zinc-950' : active ? 'bg-white/10 text-white' : 'bg-bg-elevated text-zinc-600'
              }`}
            >
              {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            </span>
            <span className={done ? 'text-zinc-300' : active ? 'text-white font-medium' : 'text-zinc-500'}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
