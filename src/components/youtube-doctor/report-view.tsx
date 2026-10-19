'use client';

import { PlayCircle } from 'lucide-react';
import type { DiagnosisResult } from '@/lib/youtube/diagnosis';
import type { RetentionAnomaly } from '@/lib/youtube/types';
import {
  ActionPlan,
  LimitationsCard,
  OtherProblems,
  StrengthList,
  TrafficBars,
  VerdictCard,
  VideoTable,
} from './diagnosis-sections';
import { formatDate, formatDuration } from './format';
import { MetricCards } from './metric-cards';
import { TrendChart } from './trend-chart';

const MOMENT_TEXT: Record<RetentionAnomaly['kind'], (a: RetentionAnomaly) => string> = {
  early_exit: (a) => `${a.magnitude.toFixed(0)}% of viewers left in the first ${a.atSec ?? 30} seconds`,
  steep_drop: (a) => `Many viewers left at this moment (${a.magnitude.toFixed(0)}% at once)`,
  rewatch_spike: () => 'Viewers rewatched this part. Do more of this',
  weak_vs_similar: () => 'From here, people leave faster than on similar YouTube videos',
};

/** YouTube link that starts at the moment. An early exit starts at 0:00 so the whole intro is visible. */
function momentUrl(a: RetentionAnomaly): string {
  const start = a.kind === 'early_exit' ? 0 : Math.max(0, (a.atSec ?? 0) - 3);
  return `https://www.youtube.com/watch?v=${a.videoId}&t=${start}s`;
}

function momentLabel(a: RetentionAnomaly): string {
  if (a.kind === 'early_exit') return `0:00–${formatDuration(a.atSec ?? 30)}`;
  return a.atSec !== null ? formatDuration(a.atSec) : `${Math.round(a.atRatio * 100)}%`;
}

/**
 * Screen 6, ordered for how creators read: the answer, what to do, what else matters,
 * and only then the numbers for anyone who wants to dig in.
 */
export function ReportView({
  result,
  analyzedAt,
  onSelectVideo,
}: {
  result: DiagnosisResult;
  analyzedAt: string;
  onSelectVideo?: (videoId: string) => void;
}) {
  const { report } = result;
  const titleById = new Map(result.videos.map((v) => [v.id, v.title]));
  const moments = [...result.retentionAnomalies]
    .filter((a) => a.severity !== 'minor' && a.kind !== 'weak_vs_similar')
    .sort((a, b) => (a.severity === b.severity ? b.magnitude - a.magnitude : a.severity === 'major' ? -1 : 1))
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-400">
        Last {result.current.days} days ({formatDate(result.current.startDate)} – {formatDate(result.current.endDate)}) · checked at{' '}
        {new Date(analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>

      <VerdictCard result={result} />

      <ActionPlan actions={report.actions} evidence={result.evidence} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OtherProblems bottlenecks={report.secondaryBottlenecks} evidence={result.evidence} />
        <StrengthList result={result} />
      </div>

      <div className="pt-6 border-t border-bg-border space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">The numbers behind this</h2>
          <p className="text-sm text-zinc-400 mt-1">For when you want to dig deeper.</p>
        </div>

        <MetricCards metrics={result.metrics} previousLabel={`the ${result.current.days} days before`} />

        {result.daily && result.daily.length > 1 && <TrendChart daily={result.daily} />}

        {moments.length > 0 && (
          <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Moments to rewatch</h3>
              <p className="text-sm text-zinc-400 mt-0.5">Open each one and watch what happens on screen at that second.</p>
            </div>
            <ul className="space-y-3">
              {moments.map((a, i) => {
                const url = momentUrl(a);
                return (
                  <li key={`${a.videoId}-${a.kind}-${i}`} className="flex items-center gap-4">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Watch from ${momentLabel(a)}`}
                      className="shrink-0 w-32 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 tabular-nums"
                    >
                      <PlayCircle size={16} />
                      {momentLabel(a)}
                    </a>
                    <div className="min-w-0">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-base text-zinc-100 truncate hover:text-white hover:underline"
                      >
                        {titleById.get(a.videoId)}
                      </a>
                      <p className="text-sm text-zinc-400">{MOMENT_TEXT[a.kind](a)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {result.traffic && <TrafficBars traffic={result.traffic} />}

        <VideoTable videos={result.videos} onSelect={onSelectVideo} />

        <LimitationsCard limitations={result.limitations} aiSource={report.source} />
      </div>
    </div>
  );
}
