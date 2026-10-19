'use client';

import { Check, Loader2 } from 'lucide-react';
import type { DiagnosisStage } from '@/lib/youtube/types';

const STEPS: { stage: DiagnosisStage; label: string }[] = [
  { stage: 'connect', label: 'Connecting to YouTube' },
  { stage: 'fetch_channel', label: 'Reading your videos' },
  { stage: 'fetch_analytics', label: 'Loading your analytics' },
  { stage: 'retention', label: 'Checking where people stop watching' },
  { stage: 'compare_videos', label: 'Comparing your videos' },
  { stage: 'packaging', label: 'Looking at your thumbnails' },
  { stage: 'ai_report', label: 'Writing your plan' },
];

/** Screen 5: the server's real stages. No percentage, because the server doesn't know one. */
export function ProgressSteps({ reached }: { reached: DiagnosisStage[] }) {
  const lastIndex = Math.max(-1, ...reached.map((s) => STEPS.findIndex((step) => step.stage === s)));

  return (
    <ol className="space-y-3" aria-live="polite">
      {STEPS.map((step, index) => {
        const done = index < lastIndex || reached.includes('done');
        const active = index === lastIndex && !reached.includes('done');
        return (
          <li key={step.stage} className="flex items-center gap-3 text-base">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                done ? 'bg-emerald-500 text-zinc-950' : active ? 'bg-white/10 text-white' : 'bg-bg-elevated text-zinc-600'
              }`}
            >
              {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            </span>
            <span className={done ? 'text-zinc-300' : active ? 'text-white font-medium' : 'text-zinc-500'}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
