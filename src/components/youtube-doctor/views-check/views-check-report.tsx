'use client';

/**
 * The views check report, as a story: your problem in one line → the three scores → what to do this
 * week → will your Shorts grow → the proof (numbers, each Short, what YouTube doesn't share).
 */
import { useState } from 'react';
import { ArrowRight, Check, ClipboardCopy } from 'lucide-react';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import type { ViewsCheckReport as Report } from '@/lib/youtube/views-check/types';
import { StopPointsCard, TopicsCard } from './channel-cards';
import { OutlookCard } from './outlook-card';
import { reportText } from './report-text';
import { ScoreCards } from './score-cards';
import { KeyTiles, VerdictNumbers } from './summary';
import { TestCard } from './test-rounds';
import { VideoTable } from './video-table';

/** Kept in step with VIEWS_CHECK_VERSION in run.ts (not imported: run.ts is server code). */
const REPORT_VERSION = 20;
/** Steps shown up front; the rest open on request. */
const TOP_STEPS = 3;

export function ViewsCheckReport({ result, analyzedAt }: { result: ViewsCheckResult; analyzedAt: string }) {
  if (result.version !== REPORT_VERSION) {
    return <div className="card text-base text-zinc-300">This report was made by an older version of the check. Click “Check again” for the new report.</div>;
  }
  const { report, wording } = result;
  const timelines = new Map(report.shorts.map((s) => [s.videoId, s]));
  return (
    <div className="space-y-6">
      <Hero result={result} analyzedAt={analyzedAt} />
      <ScoreCards health={report.health} distribution={report.distribution} account={report.account} />
      {wording.plan.length > 0 && <Plan steps={wording.plan} />}
      <OutlookCard outlook={report.outlook} />

      <div className="space-y-1 pt-4">
        <h2 className="text-xl font-bold text-white">The proof: your numbers</h2>
        <p className="text-sm text-zinc-400">Everything above comes from these numbers. Open any Short to see why it got the views it did.</p>
      </div>
      <VerdictNumbers report={report} />
      <KeyTiles report={report} />
      {/* <TestCard shorts={report.shorts} agreement={report.testAgreement ?? null} /> */}
      {report.stopPoints && <StopPointsCard stops={report.stopPoints} />}
      {report.topics?.length > 0 && <TopicsCard topics={report.topics} />}
      <VideoTable videos={report.videos} timelines={timelines} analyzedAt={analyzedAt} />
      {report.limitations.length > 0 && <Limitations items={report.limitations} />}
    </div>
  );
}

/** Your problem in one line, why, in plain words. */
function Hero({ result, analyzedAt }: { result: ViewsCheckResult; analyzedAt: string }) {
  const { wording } = result;
  return (
    <section className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">What’s holding your views back</p>
        <CopyReport result={result} analyzedAt={analyzedAt} />
      </div>
      <h2 className=" max-w-3xl  text-2xl font-bold leading-snug text-white sm:text-3xl">{wording.headline}</h2>
      {wording.explanation && <p className="max-w-3xl text-base leading-relaxed text-zinc-300">{wording.explanation}</p>}
      <p className="text-xs text-zinc-500">
        From your last {result.period.days} days · {result.report.verdict.basedOn} videos checked · {new Date(analyzedAt).toLocaleString()}
      </p>
    </section>
  );
}

/** Copies the full report with a prompt, so ChatGPT, Claude or any chat AI can explain it in Bangla. */
function CopyReport({ result, analyzedAt }: { result: ViewsCheckResult; analyzedAt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(result, analyzedAt));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-primary btn-md"
        onClick={copy}
        title="Copy the full report, then paste it into ChatGPT, Claude or Gemini to get it explained in Bangla"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />}
        {copied ? 'Copied! Paste it in ChatGPT' : 'Copy full report'}
      </button>

    </div>
  );
}

function Plan({ steps }: { steps: string[] }) {
  const top = steps.slice(0, TOP_STEPS);
  const more = steps.slice(TOP_STEPS);
  return (
    <section id="views-plan" className="space-y-4 rounded-2xl border border-emerald-500/30 bg-bg-surface p-6">
      <h2 className="text-lg font-bold text-white">This week: {top.length === 1 ? 'one thing' : `${top.length} things`} to do</h2>
      <ol className="space-y-3">
        {top.map((step, i) => (
          <Step key={step} n={i + 1} text={step} />
        ))}
      </ol>
      {more.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-300">
            {more.length} more {more.length === 1 ? 'step' : 'steps'} after these
          </summary>
          <ol className="mt-3 space-y-3">
            {more.map((step, i) => (
              <Step key={step} n={TOP_STEPS + i + 1} text={step} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3 text-base text-zinc-100">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-200">{n}</span>
      <span className="pt-0.5">{text}</span>
    </li>
  );
}

function Limitations({ items }: { items: Report['limitations'] }) {
  return (
    <details className="rounded-xl border border-bg-border bg-bg-surface px-5 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-400">What YouTube doesn’t share (check these in Studio)</summary>
      <ul className="mt-2 space-y-1">
        {items.map((l) => (
          <li key={l} className="flex gap-2 text-sm text-zinc-400">
            <ArrowRight size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {l}
          </li>
        ))}
      </ul>
    </details>
  );
}
