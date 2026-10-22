'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuditShell } from '@/components/audit/audit-shell';
import { CompareReport } from '@/components/audit/compare-report';
import type { CompareReport as Report } from '@/components/audit/types';
import { useAudit } from '@/components/audit/use-audit';
import { resolveTarget } from '@/lib/youtube/audit/resolve';

const STAGES: Record<string, string> = {
  connect: 'Connecting to YouTube…',
  yours: 'Analyzing your video…',
  theirs: 'Analyzing their video…',
  compare: 'Comparing the two…',
};

export default function ComparePage() {
  return (
    <Suspense fallback={<Loader2 size={20} className="animate-spin text-zinc-400 m-8" />}>
      <CompareInner />
    </Suspense>
  );
}

/** Your video next to another one. Nothing runs (or is charged) until the creator asks. */
function CompareInner() {
  const params = useSearchParams();
  const [theirs, setTheirs] = useState(params.get('theirs') ?? '');
  const [yours, setYours] = useState(params.get('yours') ?? '');
  const ids = [resolveTarget(yours), resolveTarget(theirs)].map((t) => (t?.kind === 'video' ? t.videoId : null));
  const ready = !!ids[0] && !!ids[1] && ids[0] !== ids[1];
  const audit = useAudit<Report>('compare', `${ids[0]}:${ids[1]}`, '/api/youtube/audit/compare', () => ({ yours, theirs }));

  return (
    <AuditShell
      back="/discover?tab=market"
      title="Your video next to theirs"
      subtitle="Packaging, performance against each channel’s usual, and what viewers said: side by side."
      config={audit.config}
      cost={(c) => c.costs.compare}
      hasReport={!!audit.report}
      analyzedAt={audit.report?.analyzedAt ?? null}
      stage={audit.stage}
      stages={STAGES}
      failure={audit.failure}
      onRun={() => ready && audit.run()}
    >
      <section className="card grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold text-zinc-200">Your video</span>
          <input className="input text-base" value={yours} placeholder="Link to one of your videos" onChange={(e) => setYours(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-semibold text-zinc-200">Their video</span>
          <input className="input text-base" value={theirs} placeholder="Link to the video to compare with" onChange={(e) => setTheirs(e.target.value)} />
        </label>
        {!ready && (yours || theirs) && <p className="text-sm text-amber-300 sm:col-span-2">Paste two different YouTube video links.</p>}
      </section>
      {audit.report && <CompareReport report={audit.report.result} />}
    </AuditShell>
  );
}
