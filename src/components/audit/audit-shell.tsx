'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Loader2, ScanSearch } from 'lucide-react';
import { StreamError } from '@/components/discover/stream-error';
import type { StreamFailure } from '@/components/create/run-stream';
import type { AuditConfig } from './types';

/**
 * The frame around an audit: back link, access, what the run gives, the run button with its price,
 * progress and errors. Reports are written in the language the analyzed channel works in.
 */
export function AuditShell({
  back,
  title,
  subtitle,
  config,
  cost,
  hasReport,
  analyzedAt,
  stage,
  stages,
  failure,
  onRun,
  preview,
  children,
}: {
  back: string;
  title: string;
  subtitle: string;
  config: AuditConfig | null;
  cost: (c: AuditConfig) => number;
  hasReport: boolean;
  analyzedAt: string | null;
  stage: string | null;
  stages: Record<string, string>;
  failure: StreamFailure | null;
  onRun: () => void;
  /** What the run gives, shown until the first report. */
  preview?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href={back} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to Discover
        </Link>

        {!config ? (
          <div className="card flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
          </div>
        ) : !config.hasAccess ? (
          <section className="card space-y-3">
            <h1 className="text-xl font-bold text-white">Analysis isn’t available yet</h1>
            <p className="text-base text-zinc-400">{config.enabled ? 'It isn’t included in your current plan.' : 'It’s being prepared and will open soon.'}</p>
            {config.enabled && (
              <Link href="/plan" className="btn-primary btn-sm w-fit">
                See plans
              </Link>
            )}
          </section>
        ) : (
          <>
            <section className="card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-white inline-flex items-center gap-2">
                    <ScanSearch size={20} className="text-amber-300" />
                    {title}
                  </h1>
                  <p className="text-base text-zinc-400">{subtitle}</p>
                </div>
                <div className="space-y-1">
                  <button type="button" className="btn-primary px-5" disabled={stage !== null} onClick={onRun}>
                    {stage ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                    {hasReport ? 'Analyze again' : 'Analyze'}
                  </button>
                  <p className="text-xs text-zinc-500 text-center">Uses {cost(config)} credits</p>
                </div>
              </div>
              {!hasReport && !stage && preview && preview.length > 0 && (
                <div className="space-y-2 border-t border-bg-border pt-4">
                  <p className="text-sm font-semibold text-zinc-300">What you’ll get</p>
                  <ul className="space-y-1.5">
                    {preview.map((p) => (
                      <li key={p} className="text-sm text-zinc-300 flex gap-2">
                        <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-zinc-500">The report stays on this page until you close the tab. Analyzing again uses credits again.</p>
                </div>
              )}
              {stage && <p className="text-sm text-zinc-300">{stages[stage] ?? 'Working…'} Usually under 30 seconds.</p>}
              {analyzedAt && !stage && (
                <p className="text-xs text-zinc-500">
                  Analyzed {new Date(analyzedAt).toLocaleString()}. It stays here until you close this tab; analyzing again uses credits again.
                </p>
              )}
            </section>

            {failure && <StreamError error={failure} />}
            {children}
          </>
        )}
      </div>
    </div>
  );
}
