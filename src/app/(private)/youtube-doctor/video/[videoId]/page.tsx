'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { reportKey } from '@/lib/channel-doctor-storage';
import type { RangeKey } from '@/lib/youtube/types';
import type { VideoAnalysisResult } from '@/lib/youtube/video-analysis';
import { AnalysisPanel } from '@/components/youtube-doctor/analysis-panel';
import { EvidenceBadge, LimitationsCard, SummaryCard, TrafficBars, WhyWeThinkThis } from '@/components/youtube-doctor/diagnosis-sections';
import { formatCompact, formatDate, formatDuration } from '@/components/youtube-doctor/format';
import { RetentionChart } from '@/components/youtube-doctor/retention-chart';
import type { ConnectionState, DoctorConfig } from '@/components/youtube-doctor/types';
import { useAnalysisStream } from '@/components/youtube-doctor/use-diagnosis';
import { ViewerThemesView } from '@/components/audit/audit-report';
import { PackagingFindings, ScriptRetention, TranscriptMatch } from '@/components/audit/own-video-sections';
import type { OwnVideoExtras } from '@/lib/youtube/audit/own-video';

export default function VideoAnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      }
    >
      <VideoAnalysisInner />
    </Suspense>
  );
}

/** Screen 7: one video's metrics, retention moments, packaging and recommendations. */
function VideoAnalysisInner() {
  const { videoId } = useParams<{ videoId: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>(searchParams.get('range') === '90d' ? '90d' : '28d');
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [config, setConfig] = useState<DoctorConfig | null>(null);

  useEffect(() => {
    Promise.all([fetch('/api/youtube/connection').then((r) => r.json()), fetch('/api/youtube/config').then((r) => r.json())])
      .then(([conn, cfg]) => {
        setConnection(conn);
        setConfig(cfg);
      })
      .catch(() => setConnection({ connected: false }));
  }, []);

  const channelId = connection?.connected ? connection.connection.channelId : null;
  const key = user && channelId ? reportKey(user.id, channelId, range, videoId) : null;
  const analysis = useAnalysisStream<VideoAnalysisResult>(`/api/youtube/videos/${videoId}/analysis`, key, { range });
  const result = analysis.saved?.result;

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-5">
        <Link href="/youtube-doctor" className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to channel report
        </Link>

        {!connection || !config ? (
          <div className="card flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
          </div>
        ) : !connection.connected ? (
          <div className="card text-sm text-zinc-300">
            Connect YouTube first on the <Link href="/youtube-doctor" className="underline">Channel Doctor</Link> page.
          </div>
        ) : (
          <section className="card space-y-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles size={22} className="text-emerald-400" />
              Video check-up
            </h1>
            <p className="text-base text-zinc-400">See how this video did compared with your others, and where people stopped watching.</p>
            {config.hasAccess ? (
              <AnalysisPanel
                range={range}
                onRangeChange={setRange}
                cost={config.videoCost}
                running={analysis.running}
                stages={analysis.stages}
                error={analysis.error}
                hasReport={Boolean(result)}
                onRun={analysis.run}
                actionLabel="Check this video"
              />
            ) : (
              <p className="text-base text-zinc-400">
                Video check-up is not included in your current plan. <Link href="/plan" className="underline">See plans</Link>
              </p>
            )}
          </section>
        )}

        {result && !analysis.running && <VideoReport result={result} />}
      </div>
    </div>
  );
}

function VideoReport({ result }: { result: VideoAnalysisResult & { extras?: OwnVideoExtras } }) {
  const { video, stats, baseline } = result;
  // Packaging rules, viewer themes and script timing; missing on reports saved before they existed.
  const extras = result.extras;
  const compare = (value: number | null, base: number | null, format: (v: number) => string) =>
    value === null ? 'Not available' : base === null ? format(value) : `${format(value)}  (usual ${format(base)})`;

  const rows = [
    { label: 'Views', value: compare(stats?.views ?? null, baseline.views, formatCompact) },
    { label: 'Time per view', value: compare(stats?.avgViewDurationSec ?? null, baseline.avgViewDurationSec, formatDuration) },
    { label: 'Share watched', value: compare(stats?.avgViewPct ?? null, baseline.avgViewPct, (v) => `${v.toFixed(1)}%`) },
    { label: 'Times shown', value: result.impressions !== null ? formatCompact(result.impressions) : 'Not available' },
    { label: 'Click rate', value: compare(result.ctr, baseline.ctr, (v) => `${(v * 100).toFixed(1)}%`) },
  ];

  return (
    <div className="space-y-5">
      <section className="card flex flex-col sm:flex-row gap-4">
        {video.thumbnailUrl && (
          <Image src={video.thumbnailUrl} alt="" width={240} height={135} className="w-full sm:w-60 h-auto rounded-lg object-cover" />
        )}
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-xl font-bold text-white leading-snug">{video.title}</h2>
          <p className="text-sm text-zinc-400">
            {video.format === 'short' ? 'Short' : 'Video'} · {video.durationSec !== null ? formatDuration(video.durationSec) : '—'} · published{' '}
            {formatDate(video.publishedAt)}
          </p>
          <a
            href={`https://youtu.be/${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-300 hover:text-white inline-flex items-center gap-1"
          >
            Open on YouTube <ExternalLink size={11} />
          </a>
          <p className="text-sm text-zinc-500">
            Last {result.current.days} days: {formatDate(result.current.startDate)} – {formatDate(result.current.endDate)} · compared with{' '}
            {baseline.size} other {video.format === 'short' ? 'Shorts' : 'videos'}
          </p>
        </div>
      </section>

      <SummaryCard summary={result.summary} source={result.source} />

      {result.recommendations.length > 0 && (
        <section className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/[0.05] p-6 space-y-4">
          <h3 className="text-xl font-bold text-white">What to do next</h3>
          <ol className="space-y-4">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-white text-zinc-950 text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="space-y-1.5">
                  <p className="text-base font-semibold text-white">{r.title}</p>
                  <p className="text-base text-zinc-300 leading-relaxed">{r.how}</p>
                  <WhyWeThinkThis ids={r.evidenceIds} evidence={result.evidence} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}


      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
        <h3 className="text-lg font-semibold text-white">Compared with your usual</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-base">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3 border-b border-bg-border py-2.5">
              <dt className="text-zinc-400">{row.label}</dt>
              <dd className="text-zinc-100 text-right tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {result.retention && result.retention.length > 1 && (
        <section className="card space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Where people stop watching</h3>
            <p className="text-sm text-zinc-400">The line shows how many viewers are still watching. Red dots: many left at once. Green: people rewatched.</p>
          </div>
          <RetentionChart points={result.retention} anomalies={result.retentionAnomalies} durationSec={video.durationSec} />
          <ul className="space-y-1.5">
            {result.evidence
              .filter((e) => e.id.startsWith('ev_video_retention'))
              .map((e) => (
                <li key={e.id} className="text-base text-zinc-200 flex flex-wrap items-start gap-2">
                  <span>{e.statement}</span>
                  <EvidenceBadge confidence={e.confidence} />
                </li>
              ))}
          </ul>
        </section>
      )}

      {extras?.script ? (
        <ScriptRetention timeline={extras.script.timeline} projectId={extras.script.projectId} />
      ) : (
        result.retention && <TranscriptMatch anomalies={result.retentionAnomalies} durationSec={video.durationSec} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {result.traffic && <TrafficBars traffic={result.traffic} />}
        <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
          <h3 className="text-lg font-semibold text-white">Title and thumbnail</h3>
          <dl className="text-sm space-y-2.5">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-400">Title length</dt>
              <dd className="text-zinc-200">{result.title.length} characters, {result.title.words} words</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-400">Title has</dt>
              <dd className="text-zinc-200 text-right">
                {[result.title.hasNumber && 'a number', result.title.hasQuestion && 'a question', result.title.hasBrackets && 'brackets', result.title.capsWords > 0 && `${result.title.capsWords} all-caps words`]
                  .filter(Boolean)
                  .join(', ') || 'none of: numbers, questions, brackets, all-caps'}
              </dd>
            </div>
            {result.thumbnail ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">Thumbnail subject</dt>
                  <dd className="text-zinc-200 text-right">{result.thumbnail.subject} (~{result.thumbnail.subjectSizePct}% of the image)</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">Text on thumbnail</dt>
                  <dd className="text-zinc-200 text-right">{result.thumbnail.textOnImage ? `"${result.thumbnail.textOnImage}"` : 'None'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">Face · contrast · background</dt>
                  <dd className="text-zinc-200 text-right">
                    {result.thumbnail.faceVisible ? 'Face' : 'No face'} · {result.thumbnail.contrast} · {result.thumbnail.background}
                  </dd>
                </div>
                <p className="text-xs text-zinc-500">Thumbnail details are read by AI and may not be perfect.</p>
              </>
            ) : (
              <p className="text-zinc-500">{video.format === 'short' ? 'Thumbnails are not analyzed for Shorts.' : 'The thumbnail could not be analyzed.'}</p>
            )}
          </dl>
          {extras && <PackagingFindings findings={extras.packaging} />}
        </section>
      </div>

      {extras?.viewers && <ViewerThemesView viewers={extras.viewers} />}

      <LimitationsCard limitations={result.limitations} aiSource={result.source} />
    </div>
  );
}
