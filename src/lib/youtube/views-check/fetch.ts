import { fetchCountries, fetchPerVideo, fetchRetention, fetchTraffic, query } from '../analytics-client';
import { getPeriods } from '../analysis/period';
import { YOUTUBE_DATA_API } from '../config';
import type { PublicConnection } from '../connection-service';
import { fetchMyChannels, fetchUploadIds, fetchVideoDetails } from '../data-client';
import { ChannelMismatchError, mapLimit, settle } from '../fetcher';
import { googleJson } from '../google-fetch';
import type { DateRange, PeriodStats, Result } from '../types';
import { videoRange } from './period';
import type { DayViews, Interactions, VideoDeepDive, VideoStatus, ViewsCheckDataset, ViewsCheckLimits } from './types';

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

interface FileDetailsResponse {
  items?: Array<{
    id: string;
    fileDetails?: { videoStreams?: Array<{ widthPixels?: number; heightPixels?: number; rotation?: string }> };
  }>;
}

/** A video's frame as it plays: width and height in pixels. */
export interface VideoShape {
  width: number;
  height: number;
}

/**
 * Frame size of up to 50 videos per request (1 quota unit each), from `fileDetails`, which only
 * the channel owner can read. A video YouTube hasn't measured yet (still processing) is missing.
 */
export async function fetchVideoShape(accessToken: string, ids: string[]): Promise<Record<string, VideoShape>> {
  const result: Record<string, VideoShape> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      part: 'fileDetails',
      id: ids.slice(i, i + 50).join(','),
      fields: 'items(id,fileDetails/videoStreams(widthPixels,heightPixels,rotation))',
    });
    const data = await googleJson<FileDetailsResponse>(`${YOUTUBE_DATA_API}/videos?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    for (const item of data.items || []) {
      const stream = item.fileDetails?.videoStreams?.[0];
      if (!stream?.widthPixels || !stream.heightPixels) continue;
      // A phone video saved sideways with a rotation flag plays turned a quarter.
      const turned = stream.rotation === 'clockwise' || stream.rotation === 'counterClockwise';
      result[item.id] = turned ? { width: stream.heightPixels, height: stream.widthPixels } : { width: stream.widthPixels, height: stream.heightPixels };
    }
  }
  return result;
}

/**
 * Short or long video, for a video YouTube hasn't labelled (no views yet, so no creatorContentType).
 * A Short is up to 3 minutes AND vertical or square; a 1-minute horizontal video is a long video.
 * null when it can't be told (length or frame size unknown).
 */
export function formatFromShape(durationSec: number | null, shape: VideoShape | undefined): 'short' | 'video' | null {
  if (durationSec !== null && durationSec > SHORT_MAX_SEC) return 'video';
  if (!shape) return null;
  if (shape.width > shape.height) return 'video';
  return durationSec === null ? null : 'short';
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
  // Reactions and % viewed per day, for the test rounds; a separate call so a refusal can't cost the views.
  const extra = await query(accessToken, range, {
    dimensions: 'day',
    metrics: 'likes,comments,shares,averageViewPercentage',
    filters: `video==${videoId}`,
    sort: 'day',
  }).catch(() => []);
  const byDay = new Map(extra.map((row) => [String(row.day), row]));
  return rows.map((row) => {
    const more = byDay.get(String(row.day));
    return {
      date: String(row.day),
      views: num(row.views),
      engagedViews: num(row.engagedViews),
      ...(more ? { likes: num(more.likes), comments: num(more.comments), shares: num(more.shares), avgViewPct: num(more.averageViewPercentage) } : {}),
    };
  });
}

/** Likes, comments and shares per video over a period (top 200 by views). */
export async function fetchInteractionsPerVideo(accessToken: string, range: DateRange): Promise<Record<string, Interactions>> {
  const rows = await query(accessToken, range, {
    dimensions: 'video',
    metrics: 'views,likes,comments,shares',
    sort: '-views',
    maxResults: '200',
  });
  return Object.fromEntries(rows.map((row) => [String(row.video), { likes: num(row.likes), comments: num(row.comments), shares: num(row.shares) }]));
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
/** Uploads read per run to find enough Shorts among long videos (3 pages of 50). */
const UPLOADS_READ_MAX = 150;
/** YouTube Shorts are at most 3 minutes. */
const SHORT_MAX_SEC = 180;

export async function fetchViewsCheckDataset(options: FetchOptions): Promise<ViewsCheckDataset> {
  const { accessToken, connection, limits, onStage } = options;
  const now = options.now ?? new Date();
  const { current: period } = getPeriods('90d', now);

  onStage('fetch_channel');
  const channel = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
  if (!channel) throw new ChannelMismatchError();
  // Shorts only. Uploads mix Shorts and long videos, so read more than we keep, then keep the
  // newest `maxVideos` Shorts (about 1 Data API unit per 50 uploads).
  const uploadIds = channel.uploadsPlaylistId
    ? await fetchUploadIds(accessToken, channel.uploadsPlaylistId, Math.min(UPLOADS_READ_MAX, limits.maxVideos * 3))
    : [];
  const uploads = await fetchVideoDetails(accessToken, uploadIds);

  onStage('fetch_analytics');
  const [shortStats, longStats, engaged, interactions, countries] = await Promise.all([
    settle(fetchPerVideo(accessToken, period, 'short'), 'Shorts performance'),
    // Only to tell long videos apart (YouTube's creatorContentType), never shown.
    settle(fetchPerVideo(accessToken, period, 'video'), 'video performance'),
    settle(fetchEngagedPerVideo(accessToken, period), 'engaged views'),
    settle(fetchInteractionsPerVideo(accessToken, period), 'likes, comments and shares'),
    settle(fetchCountries(accessToken, period), 'viewer countries'),
  ]);

  for (const video of uploads) {
    if (shortStats.ok && shortStats.data[video.id]) video.format = 'short';
    else if (longStats.ok && longStats.data[video.id]) video.format = 'video';
  }
  // A video with no views in the period has no creatorContentType. Length alone can't tell (a
  // 1-minute horizontal video is a long video), so check its frame: Shorts are vertical or square.
  // When the frame can't be read, leave it out rather than judge a long video as a Short.
  const unlabelled = uploads.filter((v) => v.format === null && (v.durationSec === null || v.durationSec <= SHORT_MAX_SEC)).map((v) => v.id);
  const shapes = unlabelled.length ? await settle(fetchVideoShape(accessToken, unlabelled), 'video frame size') : null;
  for (const video of uploads) {
    if (video.format === null) video.format = formatFromShape(video.durationSec, shapes?.ok ? shapes.data[video.id] : undefined);
  }
  const videos = uploads.filter((v) => v.format === 'short').slice(0, limits.maxVideos);
  for (const video of videos) video.format = 'short';
  const ids = videos.map((v) => v.id);

  const status = await settle(fetchVideoStatus(accessToken, ids), 'video availability');
  const perVideo: Result<Record<string, PeriodStats>> = shortStats.ok ? { ok: true, data: shortStats.data } : { ok: false, reason: shortStats.reason };
  // Impressions and CTR (Reporting API) describe thumbnail clicks on long videos; Shorts are swiped, not clicked.
  const reach: Result<never> = { ok: false, reason: 'Impressions and CTR are not used for Shorts.' };

  onStage('deep_dive');
  // The newest Shorts that have at least one reported day, so a "why did it stop" answer has data.
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
    channelCreatedAt: channel.createdAt ?? null,
    period,
    videos,
    status,
    perVideo,
    engaged,
    interactions,
    reach,
    countries: countries.ok ? { ok: true, data: countries.data.map(({ country, views }) => ({ country, views })) } : countries,
    deepDives: Object.fromEntries(deepIds.map((id, i) => [id, dives[i]])),
    collectedAt: now.toISOString(),
  };
}
