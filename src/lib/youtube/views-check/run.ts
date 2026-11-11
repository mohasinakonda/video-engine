import { analyzeChannel } from '../analysis/engine';
import type { HealthInput } from '../analysis/health-score';
import { detectReportLanguage } from '../audit/language';
import { fetchChannelDataset } from '../fetcher';
import type { PublicConnection } from '../connection-service';
import type { ChannelDoctorSettings } from '../settings';
import type { ChannelInfo, DateRange } from '../types';
import { wordViewsReport, type ViewsWording } from './ai';
import { analyzeViews } from './engine';
import { fetchViewsCheckDataset, type ViewsCheckStage } from './fetch';
import { groupTopics } from './topics';
import type { ViewsCheckReport } from './types';

export type ViewsCheckRunStage = ViewsCheckStage | 'analyze' | 'write';

/** Everything the browser renders. Sent once, kept only in the tab's sessionStorage. */
/** 6: retention on YouTube Studio's scale, exit window, topics and the stop-point per Short. */
export const VIEWS_CHECK_VERSION = 20;

/** The days the channel health score covers (the same window the diagnosis uses by default). */
const HEALTH_RANGE = '28d';

export interface ViewsCheckResult {
  /** Bumped when the report shape changes; older reports saved in the tab are not rendered. */
  version: number;
  channel: ChannelInfo;
  period: DateRange;
  report: ViewsCheckReport;
  wording: ViewsWording;
  /** Inputs for the channel health score (last 28 days); null when they couldn't be loaded. */
  health: HealthInput | null;
  generatedAt: string;
}

interface RunOptions {
  userId: string;
  accessToken: string;
  connection: PublicConnection;
  reportingJobId: string | null;
  settings: ChannelDoctorSettings;
  onStage: (stage: ViewsCheckRunStage) => void;
}

export async function runViewsCheck(options: RunOptions): Promise<ViewsCheckResult> {
  const { settings, onStage } = options;
  // The channel health score needs the diagnosis numbers (not its AI parts), read alongside.
  const [data, health] = await Promise.all([
    fetchViewsCheckDataset({
      ...options,
      limits: { maxVideos: settings.viewsCheck.maxVideos, maxDeepDives: settings.viewsCheck.maxDeepDives },
    }),
    channelHealth(options),
  ]);

  onStage('analyze');
  data.topics = await groupTopics(
    data.videos.map((v) => ({ id: v.id, title: v.title })),
    settings.textModels
  );
  const report = analyzeViews(data);

  onStage('write');
  const language = detectReportLanguage(data.videos.slice(0, 30).map((v) => v.title), [data.channelLanguage]);
  const wording = await wordViewsReport(report, language, settings.textModels);

  return { version: VIEWS_CHECK_VERSION, channel: data.channel, period: data.period, report, wording, health, generatedAt: data.collectedAt };
}

/** The numbers behind the health score. Optional: if they can't be loaded, the report still comes. */
async function channelHealth(options: RunOptions): Promise<HealthInput | null> {
  try {
    const dataset = await fetchChannelDataset({ ...options, range: HEALTH_RANGE, onStage: () => undefined });
    const report = analyzeChannel(dataset);
    const total = dataset.traffic.ok ? dataset.traffic.data.reduce((sum, r) => sum + r.views, 0) : 0;
    return {
      metrics: report.metrics,
      traffic: dataset.traffic.ok && total > 0 ? dataset.traffic.data.map((r) => ({ source: r.source, views: r.views, sharePct: (r.views / total) * 100 })) : null,
      videos: report.videos,
      current: dataset.current,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[views-check] channel health unavailable:', (err as Error)?.message);
    return null;
  }
}
