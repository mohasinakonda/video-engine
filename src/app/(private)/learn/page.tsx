'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { useCreateConfig } from '@/components/create/use-create-config';
import { FORMAT_LABELS, MECHANISM_LABELS, type ContentFormat, type TitleMechanism } from '@/lib/youtube/discover/formats';
import type { Bottleneck, ThesisVerdict } from '@/lib/youtube/create/outcome';
import type { GroupStat, LearningSummary } from '@/lib/youtube/create/track-record';

const DIMENSION_TEXT = {
  format: (key: string) => `${FORMAT_LABELS[key as ContentFormat] ?? key} videos`,
  mechanism: (key: string) => `Titles using ${(MECHANISM_LABELS[key as TitleMechanism] ?? key).replace(/^A /, 'a ')}`,
  topic: (key: string) => `Videos on “${key}”`,
};

const BOTTLENECK_TEXT: Record<Bottleneck, string> = {
  none: 'Nothing held it back',
  discovery: 'Shown less by YouTube',
  packaging: 'Title and thumbnail (fewer clicks)',
  retention: 'Viewers left early',
  content_market_mismatch: 'The topic pulled less',
  execution: 'Both clicks and watching',
  insufficient_data: 'Not enough data',
};

const VERDICT_TEXT: Record<ThesisVerdict, string> = {
  supported: 'held up',
  partly_supported: 'partly held up',
  not_supported: 'didn’t hold up',
  inconclusive: 'not tested',
};

function Tendency({ dimension, stat, good }: { dimension: keyof typeof DIMENSION_TEXT; stat: GroupStat; good: boolean }) {
  return (
    <li className="rounded-xl border border-bg-border bg-bg-elevated p-4 space-y-2">
      <p className="text-base text-white">
        <span className="font-semibold">{DIMENSION_TEXT[dimension](stat.key)}</span> tend to do {good ? 'better' : 'worse'} than your usual.
      </p>
      <p className="text-sm text-zinc-400">
        {stat.above} of {stat.n} did better and {stat.below} did worse, each compared with your own videos at the same age.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {stat.videos.map((v) => (
          <li key={v.projectId}>
            <Link href={`/create/${v.projectId}/measure`} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-bg-border text-zinc-300 hover:text-white">
              {v.title}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** What the creator's own measured videos say. Tendencies, never rules. */
export default function LearnPage() {
  const { config, error } = useCreateConfig();
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!config?.hasAccess) return;
    fetch('/api/create/learning')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error))))
      .then((d) => setSummary(d.summary))
      .catch((e) => setLoadError(e.message || 'Could not load what you’ve learned.'));
  }, [config?.hasAccess]);

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <GraduationCap size={22} className="text-sky-400" />
              Learn
            </h1>
            <p className="page-subtitle text-base">What your measured videos say about your channel. Discover uses this when it scores new ideas.</p>
          </div>
        </header>

        <AccessGate config={config} error={error}>
          {loadError ? (
            <div className="card text-base text-rose-300">{loadError}</div>
          ) : !summary ? (
            <div className="card flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-400" />
            </div>
          ) : summary.measuredVideos < summary.minVideos ? (
            <section className="card space-y-3">
              <h2 className="text-xl font-bold text-white">Not enough videos yet</h2>
              <p className="text-base text-zinc-300">
                {summary.measuredVideos === 0
                  ? 'Nothing is measured yet.'
                  : `${summary.measuredVideos} of the ${summary.minVideos} measured videos needed so far.`}{' '}
                Plan a video in Create, publish it, link it, and check its performance from day 7. Each one teaches something.
              </p>
              <Link href="/create" className="btn-primary btn-sm w-fit">
                Go to Create
              </Link>
            </section>
          ) : (
            <>
              <section className="card">
                <p className="text-2xl font-bold text-white">
                  {summary.measuredVideos} measured videos
                  {summary.aboveShare !== null && <span className="text-base font-normal text-zinc-400"> · {Math.round(summary.aboveShare * 100)}% did better than your usual</span>}
                </p>
                <p className="text-sm text-zinc-500 mt-1">A tendency needs at least {summary.minVideos} videos behind it. Small groups count for less.</p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-300" />
                  What’s working
                </h2>
                {summary.working.length ? (
                  <ul className="space-y-2">
                    {summary.working.map((w) => (
                      <Tendency key={`${w.dimension}:${w.stat.key}`} dimension={w.dimension} stat={w.stat} good />
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-zinc-400">No clear pattern yet.</p>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
                  <TrendingDown size={18} className="text-amber-300" />
                  What isn’t
                </h2>
                {summary.notWorking.length ? (
                  <ul className="space-y-2">
                    {summary.notWorking.map((w) => (
                      <Tendency key={`${w.dimension}:${w.stat.key}`} dimension={w.dimension} stat={w.stat} good={false} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-zinc-400">No clear pattern yet.</p>
                )}
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <section className="card space-y-2">
                  <h2 className="text-base font-semibold text-white">What held videos back</h2>
                  {summary.bottlenecks.length ? (
                    <ul className="space-y-1 text-base text-zinc-300">
                      {summary.bottlenecks.map((b) => (
                        <li key={b.bottleneck} className="flex justify-between gap-3">
                          <span>{BOTTLENECK_TEXT[b.bottleneck]}</span>
                          <span className="tabular-nums text-zinc-400">{b.n}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-400">Nothing stood out.</p>
                  )}
                </section>
                <section className="card space-y-2">
                  <h2 className="text-base font-semibold text-white">Discover’s ideas, tested</h2>
                  {summary.verdicts.length ? (
                    <ul className="space-y-1 text-base text-zinc-300">
                      {summary.verdicts.map((v) => (
                        <li key={v.verdict} className="flex justify-between gap-3">
                          <span>Idea {VERDICT_TEXT[v.verdict]}</span>
                          <span className="tabular-nums text-zinc-400">{v.n}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-400">No Discover idea has been tested from day 7 yet.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </AccessGate>
      </div>
    </div>
  );
}
