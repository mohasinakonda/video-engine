import { YOUTUBE_ANALYTICS_API } from './config';
import { googleJson } from './google-fetch';
import type {
  AgeGroupRow,
  ChannelTotals,
  CountryRow,
  DailyPoint,
  DateRange,
  PeriodStats,
  RetentionPoint,
  TrafficRow,
  VideoFormat,
} from './types';

interface ReportResponse {
  columnHeaders?: Array<{ name: string }>;
  rows?: Array<Array<string | number>>;
}

type Row = Record<string, string | number>;

/** One reports.query call; rows come back keyed by column name. */
async function query(accessToken: string, range: DateRange, params: Record<string, string>): Promise<Row[]> {
  const search = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: range.startDate,
    endDate: range.endDate,
    ...params,
  });
  const data = await googleJson<ReportResponse>(`${YOUTUBE_ANALYTICS_API}/reports?${search}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const names = (data.columnHeaders || []).map((column) => column.name);
  return (data.rows || []).map((row) => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

const num = (value: string | number | undefined): number => (typeof value === 'number' ? value : Number(value) || 0);
/** Averages are meaningless without views: YouTube reports 0, we report null. */
const avg = (value: string | number | undefined, views: number): number | null => (views > 0 ? num(value) : null);

const CORE_METRICS = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained';

export async function fetchDaily(accessToken: string, range: DateRange): Promise<DailyPoint[]> {
  const rows = await query(accessToken, range, {
    dimensions: 'day',
    metrics: `${CORE_METRICS},subscribersLost`,
    sort: 'day',
  });
  return rows.map((row) => {
    const views = num(row.views);
    return {
      date: String(row.day),
      views,
      minutesWatched: num(row.estimatedMinutesWatched),
      avgViewDurationSec: avg(row.averageViewDuration, views),
      avgViewPct: avg(row.averageViewPercentage, views),
      subscribersGained: num(row.subscribersGained),
      subscribersLost: num(row.subscribersLost),
    };
  });
}

/** Channel totals for a period (no dimension). Returns null when YouTube has no row at all. */
export async function fetchTotals(accessToken: string, range: DateRange): Promise<ChannelTotals | null> {
  const [row] = await query(accessToken, range, { metrics: `${CORE_METRICS},subscribersLost` });
  if (!row) return null;
  const views = num(row.views);
  return {
    views,
    minutesWatched: num(row.estimatedMinutesWatched),
    avgViewDurationSec: avg(row.averageViewDuration, views),
    avgViewPct: avg(row.averageViewPercentage, views),
    subscribersGained: num(row.subscribersGained),
    subscribersLost: num(row.subscribersLost),
  };
}

/**
 * Per-video stats for one content type. YouTube rejects video × creatorContentType as
 * dimensions, but accepts the type as a filter, which also tells us each video's format.
 */
export async function fetchPerVideo(
  accessToken: string,
  range: DateRange,
  format: VideoFormat
): Promise<Record<string, PeriodStats>> {
  const rows = await query(accessToken, range, {
    dimensions: 'video',
    metrics: CORE_METRICS,
    filters: `creatorContentType==${format === 'short' ? 'shorts' : 'videoOnDemand'}`,
    sort: '-views',
    maxResults: '200',
  });
  const result: Record<string, PeriodStats> = {};
  for (const row of rows) {
    const views = num(row.views);
    result[String(row.video)] = {
      views,
      minutesWatched: num(row.estimatedMinutesWatched),
      avgViewDurationSec: avg(row.averageViewDuration, views),
      avgViewPct: avg(row.averageViewPercentage, views),
      subscribersGained: num(row.subscribersGained),
    };
  }
  return result;
}

/** Views per traffic source, for the channel or for one video. */
export async function fetchTraffic(accessToken: string, range: DateRange, videoId?: string): Promise<TrafficRow[]> {
  const rows = await query(accessToken, range, {
    dimensions: 'insightTrafficSourceType',
    metrics: 'views,estimatedMinutesWatched',
    sort: '-views',
    ...(videoId ? { filters: `video==${videoId}` } : {}),
  });
  return rows.map((row) => ({
    source: String(row.insightTrafficSourceType),
    views: num(row.views),
    minutesWatched: num(row.estimatedMinutesWatched),
  }));
}

/** Views split by Shorts vs regular videos. */
export async function fetchFormatViews(accessToken: string, range: DateRange): Promise<Record<VideoFormat, number>> {
  const rows = await query(accessToken, range, { dimensions: 'creatorContentType', metrics: 'views' });
  const result: Record<VideoFormat, number> = { short: 0, video: 0 };
  for (const row of rows) {
    if (row.creatorContentType === 'shorts') result.short += num(row.views);
    else if (row.creatorContentType === 'videoOnDemand') result.video += num(row.views);
  }
  return result;
}

/** Audience retention curve for one video (YouTube allows one video per request). */
export async function fetchRetention(accessToken: string, range: DateRange, videoId: string): Promise<RetentionPoint[]> {
  const rows = await query(accessToken, range, {
    dimensions: 'elapsedVideoTimeRatio',
    metrics: 'audienceWatchRatio,relativeRetentionPerformance',
    filters: `video==${videoId}`,
    sort: 'elapsedVideoTimeRatio',
  });
  return rows.map((row) => ({
    ratio: num(row.elapsedVideoTimeRatio),
    watchRatio: num(row.audienceWatchRatio),
    relativePerformance:
      row.relativeRetentionPerformance === undefined || row.relativeRetentionPerformance === null
        ? null
        : num(row.relativeRetentionPerformance),
  }));
}

/** Share of viewers per age group (signed-in viewers only; YouTube may return no rows for small channels). */
export async function fetchAgeGroups(accessToken: string, range: DateRange): Promise<AgeGroupRow[]> {
  const rows = await query(accessToken, range, { dimensions: 'ageGroup', metrics: 'viewerPercentage', sort: 'ageGroup' });
  return rows.map((row) => ({ ageGroup: String(row.ageGroup), viewerPct: num(row.viewerPercentage) }));
}

/** Views per viewer country, most first. */
export async function fetchCountries(accessToken: string, range: DateRange): Promise<CountryRow[]> {
  const rows = await query(accessToken, range, {
    dimensions: 'country',
    metrics: 'views,estimatedMinutesWatched',
    sort: '-views',
  });
  return rows.map((row) => ({
    country: String(row.country),
    views: num(row.views),
    minutesWatched: num(row.estimatedMinutesWatched),
  }));
}
