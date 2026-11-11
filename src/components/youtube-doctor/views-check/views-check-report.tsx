'use client';

/** The views check report: why the channel's Shorts got the views they did, and what to do. */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import type { ViewsCheckReport as Report } from '@/lib/youtube/views-check/types';
import { StageCard, StopPointsCard, TopicsCard } from './channel-cards';
import { KeyTiles, VerdictNumbers } from './summary';
import { TestCard } from './test-rounds';
import { VideoTable } from './video-table';

/** Kept in step with VIEWS_CHECK_VERSION in run.ts (not imported: run.ts is server code). */
const REPORT_VERSION = 20;

export function ViewsCheckReport({ result, analyzedAt }: { result: ViewsCheckResult; analyzedAt: string }) {
  const [found, setFound] = useState<Set<string>>(new Set());
  if (result.version !== REPORT_VERSION) {
    return <div className="card text-base text-zinc-300">This report was made by an older version of the views check. Click “Check again” for the new report.</div>;
  }
  const { report, wording } = result;
  const timelines = new Map(report.shorts.map((s) => [s.videoId, s]));



  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-400">
        Last {result.period.days} days · {report.verdict.basedOn} videos judged · {new Date(analyzedAt).toLocaleString()}
      </p>

      <VerdictNumbers report={report} />
      <KeyTiles report={report} />
      {report.stage && <StageCard stage={report.stage} />}
      <TestCard shorts={report.shorts} agreement={report.testAgreement ?? null} />
      {report.stopPoints && <StopPointsCard stops={report.stopPoints} />}
      {report.topics?.length > 0 && <TopicsCard topics={report.topics} />}

      <ExplainInWords wording={wording} />

      {found.size > 0 && <StudioProblemNotice />}

      <VideoTable videos={report.videos} timelines={timelines} analyzedAt={analyzedAt} />



      {wording.plan.length > 0 && <Plan steps={wording.plan} />}
      {report.limitations.length > 0 && <Limitations items={report.limitations} />}
    </div>
  );
}

function ExplainInWords({ wording }: { wording: ViewsCheckResult['wording'] }) {
  return (
    <details className="rounded-2xl border border-bg-border bg-bg-surface px-5 py-3.5">
      <summary className="cursor-pointer text-sm font-semibold text-emerald-300">Explain this in words</summary>
      <div className="mt-3 space-y-2">
        <p className="text-base font-semibold text-white">{wording.headline}</p>
        <p className="text-base leading-relaxed text-zinc-300">{wording.explanation}</p>
        {wording.source === 'rules' && <p className="text-xs text-zinc-500">Written from the rules directly (the AI summary wasn’t available).</p>}
      </div>
    </details>
  );
}

function StudioProblemNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
      <p className="text-base text-amber-100">You found a problem in Studio. Fix that first: it outranks everything else in this report.</p>
    </div>
  );
}

function Plan({ steps }: { steps: string[] }) {
  return (
    <section id="views-plan" className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <h3 className="text-lg font-bold text-white">Your plan</h3>
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-base text-zinc-200">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Limitations({ items }: { items: Report['limitations'] }) {
  return (
    <details className="rounded-xl border border-bg-border bg-bg-surface px-5 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-400">What this check can’t see</summary>
      <ul className="mt-2 space-y-1">
        {items.map((l) => (
          <li key={l} className="text-sm text-zinc-400">
            {l}
          </li>
        ))}
      </ul>
    </details>
  );
}
