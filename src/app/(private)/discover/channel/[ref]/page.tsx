'use client';

import { useParams } from 'next/navigation';
import { AuditShell } from '@/components/audit/audit-shell';
import { ChannelReport } from '@/components/audit/channel-report';
import type { ChannelAuditReport } from '@/components/audit/types';
import { useAudit } from '@/components/audit/use-audit';

const STAGES: Record<string, string> = {
  connect: 'Connecting to YouTube…',
  channel: 'Finding the channel…',
  videos: 'Reading its recent videos (and yours, to compare)…',
  analyze: 'Comparing its standouts with its weakest videos…',
  thumbnails: 'Looking at its thumbnails…',
  lessons: 'Writing what you could try…',
};

/** A channel's audit, by channel id or @handle. Nothing runs (or is charged) until the creator asks. */
export default function ChannelAuditPage() {
  const ref = decodeURIComponent(useParams<{ ref: string }>().ref);
  const audit = useAudit<ChannelAuditReport>('channel', ref, '/api/youtube/audit/channel', (language) => ({ channel: ref, language }));

  return (
    <AuditShell
      back="/discover?tab=competitors"
      title="What works on this channel?"
      subtitle="Its standouts vs its weakest videos, its thumbnails and rhythm, and how it compares with yours."
      config={audit.config}
      cost={(c) => c.costs.channel}
      hasReport={!!audit.report}
      analyzedAt={audit.report?.analyzedAt ?? null}
      stage={audit.stage}
      stages={STAGES}
      failure={audit.failure}
      onRun={audit.run}
    >
      {audit.report && <ChannelReport report={audit.report.result} />}
    </AuditShell>
  );
}
