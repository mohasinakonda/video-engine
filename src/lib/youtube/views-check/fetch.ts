import { fetchCountries, fetchPerVideo, fetchRetention, fetchTraffic, query } from '../analytics-client';
import { getPeriods } from '../analysis/period';
import { YOUTUBE_DATA_API } from '../config';
import { updateReportingJob, type PublicConnection } from '../connection-service';
import { fetchMyChannels, fetchUploadIds, fetchVideoDetails } from '../data-client';
import { ChannelMismatchError, mapLimit, settle } from '../fetcher';
import { googleJson } from '../google-fetch';
import { ensureReachJob, fetchReach } from '../reporting-client';
import type { DateRange, PeriodStats, Result } from '../types';
import { videoRange } from './period';
import type { DayViews, VideoDeepDive, VideoStatus, ViewsCheckDataset, ViewsCheckLimits } from './types';

export type ViewsCheckStage = 'fetch_channel' | 'fetch_analytics' | 'deep_dive';

interface StatusResponse {
  items?: Array<{
    id: string;
    status?: {
      uploadStatus?: string;
      failureReason?: string;
      rejectionReason?: string;
      privacyStatus?: string;
      madeForKids?: boolean;
    };
    contentDetails?: {
      regionRestriction?: { allowed?: string[]; blocked?: string[] };
      contentRating?: { ytRating?: string };
    };
  }>;
}

/** Availability of up to 50 videos per request (1 quota unit each). */
export async function fetchVideoStatus(accessToken: string, ids: string[]): Promise<Record<string, VideoStatus>> {
  const result: Record<string, VideoStatus> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      part: 'status,contentDetails',
      id: ids.slice(i, i + 50).join(','),
      fields:
        'items(id,status(uploadStatus,failureReason,rejectionReason,privacyStatus,madeForKids),contentDetails(regionRestriction,contentRating/ytRating))',
    });
    const data = await googleJson<StatusResponse>(`${YOUTUBE_DATA_API}/videos?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    for (const item of data.items || []) {
      const region = item.contentDetails?.regionRestriction;
      result[item.id] = {
        uploadStatus: item.status?.uploadStatus ?? null,
        failureReason: item.status?.failureReason ?? null,
        rejectionReason: item.status?.rejectionReason ?? null,
        privacyStatus: item.status?.privacyStatus ?? null,
        madeForKids: item.status?.madeForKids ?? null,
        regionAllowed: region?.allowed ?? null,
        regionBlocked: region?.blocked ?? null,
        ageRestricted: item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted',
      };
    }
  }
  return result;
}

const num = (value: string | number | undefined): number => (typeof value === 'number' ? value : Number(value) || 0);

/** Views and engaged views per day for one video. */
export async function fetchVideoDaily(accessToken: string, range: DateRange, videoId: string): Promise<DayViews[]> {
  const rows = await query(accessToken, range, {
    dimensions: 'day',
    metrics: 'views,engagedViews',
    filters: `video==${videoId}`,
    sort: 'day',
  });
  return rows.map((row) => ({ date: String(row.day), views: num(row.views), engagedViews: num(row.engagedViews) }));
}

/** Engaged views per video over a period (top 200 by views). */
export async function fetchEngagedPerVideo(accessToken: string, range: DateRange): Promise<Record<string, number>> {
  const rows = await query(accessToken, range, {
    dimensions: 'video',
    metrics: 'views,engagedViews',
    sort: '-views',
    maxResults: '200',
  });
  return Object.fromEntries(rows.map((row) => [String(row.video), num(row.engagedViews)]));
}

interface FetchOptions {
  userId: string;
  accessToken: string;
  connection: PublicConnection;
  reportingJobId: string | null;
  limits: ViewsCheckLimits;
  onStage: (stage: ViewsCheckStage) => void;
  now?: Date;
}

/**
 * Collects the views check data in memory only. The channel and its uploads are required
 * (they throw); every other source is optional and becomes a Result the report can explain.
 */
export async function fetchViewsCheckDataset(options: FetchOptions): Promise<ViewsCheckDataset> {
  const { userId, accessToken, connection, limits, onStage } = options;
  const now = options.now ?? new Date();
  const { current: period } = getPeriods('90d', now);

  onStage('fetch_channel');
  const channel = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
  if (!channel) throw new ChannelMismatchError();
  const uploadIds = channel.uploadsPlaylistId ? await fetchUploadIds(accessToken, channel.uploadsPlaylistId, limits.maxVideos) : [];
  const videos = await fetchVideoDetails(accessToken, uploadIds);

  onStage('fetch_analytics');
  let jobId = options.reportingJobId;
  let jobCreatedAt = connection.reportingStartedAt;
  if (!jobId) {
    try {
      const job = await ensureReachJob(accessToken);
      await updateReportingJob(userId, job);
      jobId = job.id;
      jobCreatedAt = job.createdAt;
    } catch {
      // reported below as unavailable reach data
    }
  }

  const [status, shorts, longForm, engaged, reach, countries] = await Promise.all([
    settle(fetchVideoStatus(accessToken, uploadIds), 'video availability'),
    settle(fetchPerVideo(accessToken, period, 'short'), 'Shorts performance'),
    settle(fetchPerVideo(accessToken, period, 'video'), 'video performance'),
    settle(fetchEngagedPerVideo(accessToken, period), 'engaged views'),
    jobId
      ? settle(fetchReach(accessToken, jobId, jobCreatedAt, period), 'impressions and CTR')
      : Promise.resolve<Result<never>>({ ok: false, reason: 'Impressions and CTR reporting could not be started for this channel.' }),
    settle(fetchCountries(accessToken, period), 'viewer countries'),
  ]);

  const perVideoMap: Record<string, PeriodStats> = {};
  if (shorts.ok) Object.assign(perVideoMap, shorts.data);
  if (longForm.ok) Object.assign(perVideoMap, longForm.data);
  for (const video of videos) {
    if (shorts.ok && shorts.data[video.id]) video.format = 'short';
    else if (longForm.ok && longForm.data[video.id]) video.format = 'video';
  }
  const perVideo: Result<Record<string, PeriodStats>> =
    shorts.ok || longForm.ok ? { ok: true, data: perVideoMap } : { ok: false, reason: (longForm as { reason: string }).reason };

  onStage('deep_dive');
  // The newest videos that have at least one reported day, so a "why did it stop" answer has data.
  const deepIds = videos
    .filter((v) => videoRange(v.publishedAt, period) !== null)
    .slice(0, limits.maxDeepDives)
    .map((v) => v.id);
  const dives = await mapLimit(deepIds, 4, async (id): Promise<VideoDeepDive> => {
    const video = videos.find((v) => v.id === id)!;
    const range = videoRange(video.publishedAt, period)!;
    const [daily, traffic, retention] = await Promise.all([
      settle(fetchVideoDaily(accessToken, range, id), 'views per day'),
      settle(fetchTraffic(accessToken, range, id), 'traffic sources'),
      settle(fetchRetention(accessToken, range, id), 'audience retention'),
    ]);
    return { daily, traffic, retention };
  });

  return {
    channel: {
      id: channel.id,
      title: channel.title,
      thumbnail: channel.thumbnail,
      url: channel.url,
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
    },
    channelLanguage: channel.defaultLanguage ?? null,
    period,
    videos,
    status,
    perVideo,
    engaged,
    reach,
    countries: countries.ok ? { ok: true, data: countries.data.map(({ country, views }) => ({ country, views })) } : countries,
    deepDives: Object.fromEntries(deepIds.map((id, i) => [id, dives[i]])),
    collectedAt: now.toISOString(),
  };
}
