'use client';

import Link from 'next/link';
import { AlertCircle, Check, Loader2, RefreshCw, Search } from 'lucide-react';
import type { ViewsCheckRunStage } from '@/lib/youtube/views-check/run';
import { CONNECT_URL } from '../intro-card';
import type { DiagnosisError } from '../use-diagnosis';

type Stage = ViewsCheckRunStage | 'connect' | 'done';

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'fetch_channel', label: 'Reading your recent uploads' },
  { stage: 'fetch_analytics', label: 'Checking availability, impressions and views' },
  { stage: 'deep_dive', label: 'Looking at how each new video’s views arrived' },
  { stage: 'analyze', label: 'Finding the reasons' },
  { stage: 'write', label: 'Writing your report' },
];

interface Props {
  cost: number;
  running: boolean;
  stages: Stage[];
  error: DiagnosisError | null;
  hasReport: boolean;
  onRun: () => void;
}

/** One button, then real progress: why are my videos getting no views? */
export function ViewsCheckPanel({ cost, running, stages, error, hasReport, onRun }: Props) {
  if (running) {
    const reached = STEPS.filter((s) => stages.includes(s.stage)).length;
    return (
      <div className="pt-5 border-t border-bg-border space-y-4">
        <p className="text-lg font-semibold text-white">Checking why your views are low…</p>
        <ol className="space-y-2">
          {STEPS.map((step, i) => {
            const done = i < reached - 1 || stages.includes('done');
            const active = i === reached - 1 && !done;
            return (
              <li key={step.stage} className={`flex items-center gap-2 text-sm ${done || active ? 'text-zinc-200' : 'text-zinc-500'}`}>
                {done ? <Check size={16} className="text-emerald-400" /> : active ? <Loader2 size={16} className="animate-spin text-zinc-300" /> : <span className="w-4" />}
                {step.label}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-zinc-400">Usually under a minute. Please keep this tab open.</p>
      </div>
    );
  }

  return (
    <div className="pt-5 border-t border-bg-border space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-base text-zinc-300">
          Why do my videos get 0 views, and why do my Shorts stop after a few hours? We check your last uploads one by one.
        </p>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <button type="button" onClick={onRun} className="btn-primary px-6 py-3 text-base font-semibold">
            {hasReport ? <RefreshCw size={18} /> : <Search size={18} />}
            {hasReport ? 'Check again' : 'Check my views'}
          </button>
          <p className="text-sm text-zinc-400">{cost === 0 ? 'Free' : `Uses ${cost} credits`}</p>
        </div>
      </div>

      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <AlertCircle size={20} className="text-rose-400 shrink-0" />
          <p className="flex-1 text-base text-rose-100">
            {error.message}
            {error.refunded && ' Your credits were returned.'}
          </p>
          {error.code === 'credits' || error.code === 'plan' ? (
            <Link href="/plan" className="btn-primary btn-sm">
              {error.code === 'credits' ? 'Get credits' : 'See plans'}
            </Link>
          ) : error.code === 'reauth' ? (
            <a href={CONNECT_URL} className="btn-primary btn-sm">
              Reconnect YouTube
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
