'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { DiagnosisStage, RangeKey } from '@/lib/youtube/types';
import { CONNECT_URL } from './intro-card';
import { ProgressSteps } from './progress-steps';
import type { DiagnosisError } from './use-diagnosis';

interface AnalysisPanelProps {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  cost: number;
  running: boolean;
  stages: DiagnosisStage[];
  error: DiagnosisError | null;
  hasReport: boolean;
  onRun: () => void;
  /** Button text for a first run, e.g. "Check my channel". */
  actionLabel?: string;
}

/** Screens 4 and 5: one choice (period), one button, then real progress. */
export function AnalysisPanel({ range, onRangeChange, cost, running, stages, error, hasReport, onRun, actionLabel = 'Check my channel' }: AnalysisPanelProps) {
  if (running) {
    return (
      <div className="pt-5 border-t border-bg-border space-y-4">
        <p className="text-lg font-semibold text-white">Checking your channel…</p>
        <ProgressSteps reached={stages} />
        <p className="text-sm text-zinc-400">Usually 30–60 seconds. Please keep this tab open.</p>
      </div>
    );
  }

  return (
    <div className="pt-5 border-t border-bg-border space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Look at the last</p>
          <div className="inline-flex gap-1 p-1 rounded-xl bg-bg-elevated border border-bg-border" role="radiogroup" aria-label="Period">
            {(['28d', '90d'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={range === key}
                onClick={() => onRangeChange(key)}
                className={`px-4 py-2 rounded-lg text-base font-semibold ${range === key ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
              >
                {key === '28d' ? '28 days' : '90 days'}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:ml-auto flex flex-col items-start sm:items-end gap-1.5">
          <button type="button" onClick={onRun} className="btn-primary px-6 py-3 text-base font-semibold">
            {hasReport ? <RefreshCw size={18} /> : <Sparkles size={18} />}
            {hasReport ? 'Check again' : actionLabel}
          </button>
          <p className="text-sm text-zinc-400">Uses {cost} credits</p>
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
