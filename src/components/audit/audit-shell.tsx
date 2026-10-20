'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ScanSearch } from 'lucide-react';
import { StreamError } from '@/components/discover/stream-error';
import type { StreamFailure } from '@/components/create/run-stream';
import type { AuditConfig } from './types';

/** The frame around an audit: back link, access, language, the run button with its price, progress and errors. */
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
  onRun: (language: 'English' | 'Bangla') => void;
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<'English' | 'Bangla'>('English');
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
                <div className="flex items-center gap-2">
                  <select className="input text-sm py-1.5 w-auto" value={language} onChange={(e) => setLanguage(e.target.value as 'English' | 'Bangla')} aria-label="Language">
                    <option value="English">English</option>
                    <option value="Bangla">বাংলা</option>
                  </select>
                  <button type="button" className="btn-primary px-5" disabled={stage !== null} onClick={() => onRun(language)}>
                    {stage ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                    {hasReport ? 'Analyze again' : 'Analyze'} · {cost(config)} credits
                  </button>
                </div>
              </div>
              {stage && <p className="text-sm text-zinc-300">{stages[stage] ?? 'Working…'} Usually under 30 seconds.</p>}
              {analyzedAt && !stage && <p className="text-xs text-zinc-500">Analyzed {new Date(analyzedAt).toLocaleString()}. Kept in this tab only.</p>}
            </section>

            {failure && <StreamError error={failure} />}
            {children}
          </>
        )}
      </div>
    </div>
  );
}
