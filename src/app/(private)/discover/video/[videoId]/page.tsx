'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { AuditReport } from '@/components/audit/audit-report';
import { AuditShell } from '@/components/audit/audit-shell';
import type { VideoAuditReport } from '@/components/audit/types';
import { useAudit } from '@/components/audit/use-audit';

const STAGES: Record<string, string> = {
  connect: 'Connecting to YouTube…',
  video: 'Reading the video…',
  channel: 'Reading its channel’s recent videos…',
  analyze: 'Comparing it with the channel’s usual…',
  thumbnail: 'Looking at the thumbnail…',
  comments: 'Reading what viewers say…',
  lessons: 'Writing what you can learn from it…',
};

/** A video's audit. Nothing runs (or is charged) until the creator asks. */
export default function VideoAuditPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const from = useSearchParams().get('from');
  const audit = useAudit<VideoAuditReport>('video', videoId, '/api/youtube/audit/video', (language) => ({ link: videoId, language }));

  return (
    <AuditShell
      back={`/discover?tab=${from === 'competitors' ? 'competitors' : 'market'}`}
      title="Why did this video do what it did?"
      subtitle="Its title, thumbnail, description and what viewers say, compared with its own channel’s usual."
      config={audit.config}
      cost={(c) => c.costs.video}
      hasReport={!!audit.report}
      analyzedAt={audit.report?.analyzedAt ?? null}
      stage={audit.stage}
      stages={STAGES}
      failure={audit.failure}
      onRun={audit.run}
    >
      {audit.report && <AuditReport report={audit.report.result} />}
    </AuditShell>
  );
}
