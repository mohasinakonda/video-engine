import { analyzeChannel } from '../analysis/engine';
import { median } from '../analysis/stats';
import type { PublicConnection } from '../connection-service';
import { fetchChannelDataset } from '../fetcher';
import type { ChannelDoctorSettings } from '../settings';
import type { BottleneckCategory, Confidence, PerformanceLabel } from '../types';

/** What Discover takes from the Channel Doctor diagnosis (recomputed on the server, never trusted from the browser). */
export interface Phase1Summary {
  /** The clearest problem, or null when none stands out. */
  primary: BottleneckCategory | null;
  primaryConfidence: Confidence | null;
  primaryIsHypothesis: boolean;
  /** Per video: Channel Doctor's label and average % viewed (Analytics, last 90 days). */
  videos: Map<string, { label: PerformanceLabel; avgViewPct: number | null; relativeViews: number | null }>;
  medianAvgViewPct: number | null;
}

/**
 * Runs the deterministic part of Channel Doctor (no AI, no thumbnails) for the last 90 days.
 * Returns null when YouTube Analytics can't be read; Discover then scores without it.
 */
export async function loadPhase1(options: {
  userId: string;
  accessToken: string;
  connection: PublicConnection;
  reportingJobId: string | null;
  settings: ChannelDoctorSettings;
}): Promise<Phase1Summary | null> {
  try {
    const dataset = await fetchChannelDataset({ ...options, range: '90d', onStage: () => undefined });
    const report = analyzeChannel(dataset);
    const primary = report.findings[0] ?? null;
    const videos = new Map(
      report.videos.map((v) => [v.id, { label: v.label, avgViewPct: v.stats?.avgViewPct ?? null, relativeViews: v.relativeViews }])
    );
    const avps = report.videos.map((v) => v.stats?.avgViewPct).filter((x): x is number => typeof x === 'number');
    return {
      primary: primary?.category ?? null,
      primaryConfidence: primary?.confidence ?? null,
      primaryIsHypothesis: primary?.isHypothesis ?? false,
      videos,
      medianAvgViewPct: median(avps),
    };
  } catch (err) {
    console.error('[discover/phase1] unavailable:', (err as Error)?.message);
    return null;
  }
}
