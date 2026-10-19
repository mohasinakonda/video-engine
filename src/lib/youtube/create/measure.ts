/**
 * Measuring a published video against the creator's usual (docs/create-plan.md §11.1).
 * Everything is fetched on demand and held in memory for one request: no view counts, CTRs
 * or curves are stored. Only the labels from outcome.ts may be saved.
 */
import { fetchPerVideo, fetchTraffic } from '../analytics-client';
import { DISCOVERY_SOURCES } from '../analysis/rules-config';
import { DATA_LAG_DAYS, daysBetween, getPeriods } from '../analysis/period';
import { median } from '../analysis/stats';
import { YOUTUBE_ANALYTICS_API } from '../config';
import { fetchUploadIds, fetchVideoDetails } from '../data-client';
import { mapLimit } from '../fetcher';
import { googleJson } from '../google-fetch';
import { fetchReach } from '../reporting-client';
import type { DateRange, TrafficRow, VideoFormat } from '../types';
import { MIN_BASELINE, type Measurement } from './outcome';

const DAY = 86_400_000;
/** Comparable videos read for the baseline (each is one Analytics query). */
export const BASELINE_MAX = 20;
/** Only the last year counts as "your usual". */
const BASELINE_WINDOW_DAYS = 365;

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => isoDay(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + n * DAY);
const range = (start: string, days: number): DateRange => ({ startDate: start.slice(0, 10), endDate: addDays(start, days - 1), days });

/** The last day YouTube Analytics has (nearly) complete data for. */
export const lastDataDay = (now: Date) => isoDay(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DATA_LAG_DAYS * DAY);

export interface CheckpointState {
  days: number;
  ready: boolean;
  /** The date this checkpoint's data is expected. */
  readyOn: string;
}

/** Which checkpoints have data, counting the publish day as day 1. */
export function checkpointStates(publishedAt: string, checkpoints: number[], now: Date): CheckpointState[] {
  const age = daysBetween(publishedAt, lastDataDay(now)) + 1;
  return [...checkpoints].sort((a, b) => a - b).map((days) => ({ days, ready: age >= days, readyOn: addDays(publishedAt, days - 1 + DATA_LAG_DAYS) }));
}

interface Day {
  date: string;
  views: number;
  avgViewPct: number | null;
}

/** One video's daily views and average % viewed (one Analytics query). */
async function fetchVideoDays(accessToken: string, videoId: string, r: DateRange): Promise<Day[]> {
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: r.startDate,
    endDate: r.endDate,
    dimensions: 'day',
    metrics: 'views,averageViewPercentage',
    filters: `video==${videoId}`,
    sort: 'day',
  });
  const data = await googleJson<{ columnHeaders?: { name: string }[]; rows?: (string | number)[][] }>(`${YOUTUBE_ANALYTICS_API}/reports?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const names = (data.columnHeaders ?? []).map((c) => c.name);
  return (data.rows ?? []).map((row) => {
    const get = (n: string) => row[names.indexOf(n)];
    const views = Number(get('views')) || 0;
    return { date: String(get('day')), views, avgViewPct: views > 0 ? Number(get('averageViewPercentage')) : null };
  });
}

/** Views and view-weighted average % viewed over the first `days` days. */
export function cumulative(days: Day[], start: string, n: number): { views: number; avgViewPct: number | null } {
  const end = addDays(start, n - 1);
  const within = days.filter((d) => d.date >= start.slice(0, 10) && d.date <= end);
  const views = within.reduce((s, d) => s + d.views, 0);
  const weighted = within.reduce((s, d) => s + (d.avgViewPct ?? 0) * d.views, 0);
  return { views, avgViewPct: views > 0 ? weighted / views : null };
}

export const discoveryShare = (rows: TrafficRow[]): number | null => {
  const total = rows.reduce((s, r) => s + r.views, 0);
  return total > 0 ? rows.filter((r) => DISCOVERY_SOURCES.has(r.source)).reduce((s, r) => s + r.views, 0) / total : null;
};

export interface MeasureResult {
  format: VideoFormat;
  checkpoints: CheckpointState[];
  measurements: Measurement[];
  limitations: string[];
}

/**
 * Measures every checkpoint that has data. The baseline is the channel's own videos of the
 * same format from the last year, each read at the same age as this video.
 */
export async function measureVideo(options: {
  accessToken: string;
  channelId: string;
  reportingJobId: string | null;
  reportingStartedAt: string | null;
  videoId: string;
  publishedAt: string;
  checkpoints: number[];
  now?: Date;
}): Promise<MeasureResult> {
  const { accessToken, videoId } = options;
  const now = options.now ?? new Date();
  const start = options.publishedAt.slice(0, 10);
  const checkpoints = checkpointStates(start, options.checkpoints, now);
  const ready = checkpoints.filter((c) => c.ready).map((c) => c.days);
  const limitations: string[] = [];
  if (!ready.length) return { format: 'video', checkpoints, measurements: [], limitations };
  const maxDays = Math.max(...ready);

  const year: DateRange = { startDate: addDays(lastDataDay(now), -(BASELINE_WINDOW_DAYS - 1)), endDate: lastDataDay(now), days: BASELINE_WINDOW_DAYS };
  const [own, shorts, longs, uploadIds, channelTraffic] = await Promise.all([
    fetchVideoDays(accessToken, videoId, range(start, maxDays)),
    fetchPerVideo(accessToken, year, 'short'),
    fetchPerVideo(accessToken, year, 'video'),
    fetchUploadIds(accessToken, `UU${options.channelId.slice(2)}`, 50),
    fetchTraffic(accessToken, getPeriods('90d', now).current).catch(() => null),
  ]);
  const formatOf = (id: string): VideoFormat | null => (shorts[id] ? 'short' : longs[id] ? 'video' : null);
  const format = formatOf(videoId) ?? 'video';

  // Comparable videos: same format, published in the year before this one, newest first.
  const uploads = await fetchVideoDetails(accessToken, uploadIds.filter((id) => id !== videoId));
  const earliest = addDays(start, -BASELINE_WINDOW_DAYS);
  const peers = uploads
    .filter((u) => formatOf(u.id) === format && u.publishedAt.slice(0, 10) < start && u.publishedAt.slice(0, 10) >= earliest)
    .slice(0, BASELINE_MAX);
  const peerDays = await mapLimit(peers, 5, async (p) => ({ start: p.publishedAt.slice(0, 10), days: await fetchVideoDays(accessToken, p.id, range(p.publishedAt, maxDays)).catch(() => null) }));
  const usable = peerDays.filter((p): p is { start: string; days: Day[] } => p.days !== null);
  if (usable.length < MIN_BASELINE) {
    limitations.push(`Only ${usable.length} of your ${format === 'short' ? 'Shorts' : 'videos'} from the past year can be compared (${MIN_BASELINE} are needed), so views aren’t compared yet.`);
  }

  // Reach (impressions, CTR) for the latest checkpoint only: the files are downloaded per day.
  let reach: { ctr: number | null; impressions: number | null; baselineCtr: number | null } = { ctr: null, impressions: null, baselineCtr: null };
  if (format === 'short') {
    // The Shorts feed plays videos without a thumbnail click, so click rate doesn't apply.
  } else if (!options.reportingJobId) {
    limitations.push('Impressions and click rate aren’t available: the reach report isn’t set up for your channel yet (Channel Doctor starts it).');
  } else {
    try {
      const data = await fetchReach(accessToken, options.reportingJobId, options.reportingStartedAt, range(start, maxDays));
      if (data.coveredDays < Math.ceil(maxDays * 0.8)) {
        limitations.push('Impressions and click rate aren’t available for all of this video’s days yet.');
      } else {
        const others = Object.entries(data.byVideo)
          .filter(([id, v]) => id !== videoId && v.impressions >= 100 && v.ctr !== null)
          .map(([, v]) => v.ctr as number);
        const mine = data.byVideo[videoId];
        reach = { ctr: mine?.ctr ?? null, impressions: mine?.impressions ?? 0, baselineCtr: others.length >= 3 ? median(others) : null };
      }
    } catch {
      limitations.push('Impressions and click rate couldn’t be read from YouTube just now.');
    }
  }
  if (!channelTraffic) limitations.push('Traffic sources couldn’t be read, so discovery isn’t judged.');

  const measurements = await mapLimit(ready, 2, async (n): Promise<Measurement> => {
    const mine = cumulative(own, start, n);
    const base = usable.map((p) => cumulative(p.days, p.start, n));
    const traffic = channelTraffic ? await fetchTraffic(accessToken, range(start, n), videoId).catch(() => null) : null;
    const latest = n === maxDays;
    return {
      days: n,
      views: mine.views,
      baselineViews: base.length >= MIN_BASELINE ? median(base.map((b) => b.views)) : null,
      baselineSample: base.length,
      avgViewPct: mine.avgViewPct,
      baselineAvgViewPct: median(base.map((b) => b.avgViewPct).filter((v): v is number => v !== null)),
      ctr: latest ? reach.ctr : null,
      impressions: latest ? reach.impressions : null,
      baselineCtr: latest ? reach.baselineCtr : null,
      discoveryShare: traffic ? discoveryShare(traffic) : null,
      channelDiscoveryShare: channelTraffic ? discoveryShare(channelTraffic) : null,
    };
  });

  return { format, checkpoints, measurements, limitations };
}
