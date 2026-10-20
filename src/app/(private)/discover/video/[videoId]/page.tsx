'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, ScanSearch } from 'lucide-react';
import { AuditReport } from '@/components/audit/audit-report';
import type { AuditConfig, VideoAuditReport } from '@/components/audit/types';
import { runStream, type StreamFailure } from '@/components/create/run-stream';
import { StreamError } from '@/components/discover/stream-error';
import { useAuth } from '@/contexts/auth-context';
import { loadReport, reportKey, saveReport } from '@/lib/channel-doctor-storage';

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
  const { user } = useAuth();
  const [config, setConfig] = useState<AuditConfig | null>(null);
  const [report, setReport] = useState<{ result: VideoAuditReport; analyzedAt: string } | null>(null);
  const [language, setLanguage] = useState<'English' | 'Bangla'>('English');
  const [stage, setStage] = useState<string | null>(null);
  const [failure, setFailure] = useState<StreamFailure | null>(null);

  const key = user ? reportKey(user.id, 'audit', 'video', videoId) : null;

  useEffect(() => {
    fetch('/api/youtube/discover/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfig(d?.audit ?? { enabled: false, hasAccess: false, costs: { video: 0, channel: 0 } }))
      .catch(() => setConfig({ enabled: false, hasAccess: false, costs: { video: 0, channel: 0 } }));
  }, []);

  useEffect(() => {
    if (key) setReport(loadReport<VideoAuditReport>(key));
  }, [key]);

  const run = async () => {
    setFailure(null);
    setStage('connect');
    const out = await runStream<VideoAuditReport>('/api/youtube/audit/video', { link: videoId, language }, setStage);
    setStage(null);
    if (!out.ok) return setFailure(out.error);
    if (key) saveReport(key, out.data);
    setReport({ result: out.data, analyzedAt: new Date().toISOString() });
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl space-y-6">
        <Link href={`/discover?tab=${from === 'competitors' ? 'competitors' : 'market'}`} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to Discover
        </Link>

        {!config ? (
          <div className="card flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
          </div>
        ) : !config.hasAccess ? (
          <section className="card space-y-3">
            <h1 className="text-xl font-bold text-white">Video analysis isn’t available yet</h1>
            <p className="text-base text-zinc-400">
              {config.enabled ? 'It isn’t included in your current plan.' : 'It’s being prepared and will open soon.'}
            </p>
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
                    Why did this video do what it did?
                  </h1>
                  <p className="text-base text-zinc-400">
                    Its title, thumbnail, description and what viewers say, compared with its own channel’s usual.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select className="input text-sm py-1.5 w-auto" value={language} onChange={(e) => setLanguage(e.target.value as 'English' | 'Bangla')} aria-label="Language">
                    <option value="English">English</option>
                    <option value="Bangla">বাংলা</option>
                  </select>
                  <button type="button" className="btn-primary px-5" disabled={stage !== null} onClick={run}>
                    {stage ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
                    {report ? 'Analyze again' : 'Analyze'} · {config.costs.video} credits
                  </button>
                </div>
              </div>
              {stage && <p className="text-sm text-zinc-300">{STAGES[stage] ?? 'Working…'} Usually under 30 seconds.</p>}
              {report && !stage && <p className="text-xs text-zinc-500">Analyzed {new Date(report.analyzedAt).toLocaleString()}. Kept in this tab only.</p>}
            </section>

            {failure && <StreamError error={failure} />}
            {report && <AuditReport report={report.result} />}
          </>
        )}
      </div>
    </div>
  );
}
