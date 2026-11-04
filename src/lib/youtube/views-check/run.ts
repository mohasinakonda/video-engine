import { detectReportLanguage } from '../audit/language';
import type { PublicConnection } from '../connection-service';
import type { ChannelDoctorSettings } from '../settings';
import type { ChannelInfo, DateRange } from '../types';
import { wordViewsReport, type ViewsWording } from './ai';
import { analyzeViews } from './engine';
import { fetchViewsCheckDataset, type ViewsCheckStage } from './fetch';
import type { ViewsCheckReport } from './types';

export type ViewsCheckRunStage = ViewsCheckStage | 'analyze' | 'write';

/** Everything the browser renders. Sent once, kept only in the tab's sessionStorage. */
export const VIEWS_CHECK_VERSION = 3;

export interface ViewsCheckResult {
  /** Bumped when the report shape changes; older reports saved in the tab are not rendered. */
  version: number;
  channel: ChannelInfo;
  period: DateRange;
  report: ViewsCheckReport;
  wording: ViewsWording;
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
  const data = await fetchViewsCheckDataset({
    ...options,
    limits: { maxVideos: settings.viewsCheck.maxVideos, maxDeepDives: settings.viewsCheck.maxDeepDives },
  });

  onStage('analyze');
  const report = analyzeViews(data);

  onStage('write');
  const language = detectReportLanguage(data.videos.slice(0, 30).map((v) => v.title), [data.channelLanguage]);
  const wording = await wordViewsReport(report, language, settings.textModels);

  return { version: VIEWS_CHECK_VERSION, channel: data.channel, period: data.period, report, wording, generatedAt: data.collectedAt };
}
