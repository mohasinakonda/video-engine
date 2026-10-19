import { analyzeChannel } from './analysis/engine';
import { TRAFFIC_LABELS } from './analysis/rules-config';
import { analyzeThumbnails, thumbnailEvidence, type ThumbnailResult } from './analysis/thumbnails';
import { generateReport } from './ai/report';
import type { PublicConnection } from './connection-service';
import { fetchChannelDataset } from './fetcher';
import type { ChannelDoctorSettings } from './settings';
import type {
  ChannelDataset,
  ChannelInfo,
  DailyPoint,
  DateRange,
  DeterministicReport,
  DiagnosisReport,
  DiagnosisStage,
  RangeKey,
  VideoFormat,
} from './types';

/** Everything the browser renders. Sent once, kept only in the tab's sessionStorage. */
export interface DiagnosisResult {
  version: 1;
  range: RangeKey;
  current: DateRange;
  previous: DateRange;
  channel: ChannelInfo;
  metrics: DeterministicReport['metrics'];
  daily: DailyPoint[] | null;
  traffic: { source: string; label: string; views: number; sharePct: number }[] | null;
  formatViews: Record<VideoFormat, number> | null;
  videos: DeterministicReport['videos'];
  retentionAnomalies: DeterministicReport['retentionAnomalies'];
  thumbnails: Omit<ThumbnailResult, 'model'>[];
  evidence: DeterministicReport['evidence'];
  findings: DeterministicReport['findings'];
  strengths: DeterministicReport['strengths'];
  limitations: string[];
  report: DiagnosisReport;
  generatedAt: string;
}

interface RunOptions {
  userId: string;
  accessToken: string;
  connection: PublicConnection;
  reportingJobId: string | null;
  settings: ChannelDoctorSettings;
  range: RangeKey;
  onStage: (stage: DiagnosisStage) => void;
}

export async function runDiagnosis(options: RunOptions): Promise<DiagnosisResult> {
  const { settings, onStage } = options;
  const dataset = await fetchChannelDataset(options);

  onStage('compare_videos');
  const report = analyzeChannel(dataset);

  onStage('packaging');
  const thumbnails = await analyzeThumbnails(report.videos, settings.visionModels, settings.maxThumbnails);
  addThumbnailEvidence(report, thumbnails);

  onStage('ai_report');
  const diagnosis = await generateReport(dataset, report, settings.textModels);

  return toResult(dataset, report, thumbnails, diagnosis);
}

/** Thumbnail differences are observations: they join packaging as a hypothesis, never as proof. */
function addThumbnailEvidence(report: DeterministicReport, thumbnails: ThumbnailResult[]) {
  const evidence = thumbnailEvidence(thumbnails);
  if (thumbnails.length > 0 && thumbnails.every((t) => !t.findings)) {
    report.limitations.push('Thumbnails could not be analyzed this time.');
  }
  if (evidence.length === 0) return;
  report.evidence.push(...evidence);
  const ids = evidence.map((e) => e.id);
  const packaging = report.findings.find((f) => f.category === 'packaging');
  if (packaging) packaging.evidenceIds.push(...ids);
  else report.findings.push({ category: 'packaging', evidenceIds: ids, confidence: 'low', isHypothesis: true });
}

function toResult(
  dataset: ChannelDataset,
  report: DeterministicReport,
  thumbnails: ThumbnailResult[],
  diagnosis: DiagnosisReport
): DiagnosisResult {
  const trafficTotal = dataset.traffic.ok ? dataset.traffic.data.reduce((sum, r) => sum + r.views, 0) : 0;
  return {
    version: 1,
    range: dataset.range,
    current: dataset.current,
    previous: dataset.previous,
    channel: dataset.channel,
    metrics: report.metrics,
    daily: dataset.daily.ok ? dataset.daily.data : null,
    traffic:
      dataset.traffic.ok && trafficTotal > 0
        ? dataset.traffic.data.map((r) => ({
            source: r.source,
            label: TRAFFIC_LABELS[r.source] || r.source,
            views: r.views,
            sharePct: (r.views / trafficTotal) * 100,
          }))
        : null,
    formatViews: dataset.formatViews.ok ? dataset.formatViews.data : null,
    videos: report.videos,
    retentionAnomalies: report.retentionAnomalies,
    thumbnails: thumbnails.map(({ model: _model, ...rest }) => rest),
    evidence: report.evidence,
    findings: report.findings,
    strengths: report.strengths,
    limitations: report.limitations,
    report: diagnosis,
    generatedAt: new Date().toISOString(),
  };
}
