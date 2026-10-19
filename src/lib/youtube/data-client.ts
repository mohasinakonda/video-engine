import { YOUTUBE_DATA_API } from './config';
import { googleJson } from './google-fetch';
import type { VideoMeta } from './types';

export interface ChannelIdentity {
  id: string;
  title: string;
  thumbnail: string | null;
  customUrl: string | null;
  url: string;
  subscriberCount: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
  /** Set by the channel owner; null when not set. */
  country?: string | null;
  defaultLanguage?: string | null;
}

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      thumbnails?: Record<string, { url?: string }>;
      country?: string;
      defaultLanguage?: string;
    };
    statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const CHANNEL_FIELDS =
  'items(id,snippet(title,customUrl,country,defaultLanguage,thumbnails/default/url,thumbnails/medium/url),statistics(subscriberCount,videoCount,hiddenSubscriberCount),contentDetails/relatedPlaylists/uploads)';

/** channels.list with the given selector (mine / id / forHandle). Costs 1 quota unit. */
async function fetchChannels(accessToken: string, selector: Record<string, string>): Promise<ChannelIdentity[]> {
  const params = new URLSearchParams({ part: 'snippet,statistics,contentDetails', ...selector, fields: CHANNEL_FIELDS });
  const data = await googleJson<ChannelsResponse>(`${YOUTUBE_DATA_API}/channels?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return (data.items || []).map((item) => {
    const customUrl = item.snippet?.customUrl || null;
    return {
      id: item.id,
      title: item.snippet?.title || 'Untitled channel',
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
      customUrl,
      url: customUrl ? `https://www.youtube.com/${customUrl}` : `https://www.youtube.com/channel/${item.id}`,
      // A hidden subscriber count is "not available", not zero.
      subscriberCount: item.statistics?.hiddenSubscriberCount ? null : toNumber(item.statistics?.subscriberCount),
      videoCount: toNumber(item.statistics?.videoCount),
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || null,
      country: item.snippet?.country || null,
      defaultLanguage: item.snippet?.defaultLanguage || null,
    };
  });
}

/** The channels owned by the authorized Google identity (`mine=true`). Costs 1 quota unit. */
export function fetchMyChannels(accessToken: string): Promise<ChannelIdentity[]> {
  return fetchChannels(accessToken, { mine: 'true' });
}

/** Public channels by id, 50 per request (1 unit each). Unknown or deleted ids are simply missing. */
export async function fetchChannelsById(accessToken: string, ids: string[]): Promise<ChannelIdentity[]> {
  const unique = Array.from(new Set(ids));
  const channels: ChannelIdentity[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    channels.push(...(await fetchChannels(accessToken, { id: unique.slice(i, i + 50).join(',') })));
  }
  return channels;
}

/** A public channel by @handle (1 unit), or null when no channel has it. */
export async function fetchChannelByHandle(accessToken: string, handle: string): Promise<ChannelIdentity | null> {
  const [channel] = await fetchChannels(accessToken, { forHandle: handle.startsWith('@') ? handle : `@${handle}` });
  return channel ?? null;
}

interface PlaylistItemsResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
  nextPageToken?: string;
}

/**
 * Video ids from the channel's uploads playlist, newest first, up to `max`.
 * Uses playlistItems.list (1 unit per 50) instead of search.list (100 units).
 */
export async function fetchUploadIds(accessToken: string, uploadsPlaylistId: string, max: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      fields: 'items/contentDetails/videoId,nextPageToken',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await googleJson<PlaylistItemsResponse>(`${YOUTUBE_DATA_API}/playlistItems?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    for (const item of page.items || []) {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    }
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

interface VideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
      channelId?: string;
      categoryId?: string;
      description?: string;
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

/** ISO 8601 duration (PT1H2M3S) to seconds; null when unparseable. */
export function parseIsoDuration(value: string | undefined): number | null {
  const match = value?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, d, h, m, s] = match.map((part) => Number(part || 0));
  return d * 86400 + h * 3600 + m * 60 + s;
}

/**
 * Metadata for up to 50 videos per request (1 unit each). Format is filled in later from Analytics.
 * `public: true` also returns channel, category and the start of the description, for research
 * of other channels.
 */
export async function fetchVideoDetails(accessToken: string, ids: string[], options: { public?: boolean } = {}): Promise<VideoMeta[]> {
  const videos: VideoMeta[] = [];
  const snippetFields = options.public
    ? 'title,publishedAt,channelId,categoryId,description,thumbnails/medium/url,thumbnails/high/url'
    : 'title,publishedAt,thumbnails/medium/url,thumbnails/high/url';
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(i, i + 50).join(','),
      fields: `items(id,snippet(${snippetFields}),contentDetails/duration,statistics(viewCount,likeCount,commentCount))`,
    });
    const data = await googleJson<VideosResponse>(`${YOUTUBE_DATA_API}/videos?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    for (const item of data.items || []) {
      videos.push({
        id: item.id,
        title: item.snippet?.title || '',
        publishedAt: item.snippet?.publishedAt || '',
        durationSec: parseIsoDuration(item.contentDetails?.duration),
        thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || null,
        format: null,
        lifetimeViews: toNumber(item.statistics?.viewCount),
        likes: toNumber(item.statistics?.likeCount),
        comments: toNumber(item.statistics?.commentCount),
        ...(options.public && {
          channelId: item.snippet?.channelId,
          categoryId: item.snippet?.categoryId ?? null,
          description: (item.snippet?.description || '').slice(0, 300),
        }),
      });
    }
  }
  // Keep the uploads order (newest first).
  const order = new Map(ids.map((id, index) => [id, index]));
  return videos.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** The channel that owns a video, or null if YouTube doesn't return it (1 unit). */
export async function fetchVideoChannelId(accessToken: string, videoId: string): Promise<string | null> {
  const params = new URLSearchParams({ part: 'snippet', id: videoId, fields: 'items/snippet/channelId' });
  const data = await googleJson<{ items?: Array<{ snippet?: { channelId?: string } }> }>(
    `${YOUTUBE_DATA_API}/videos?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data.items?.[0]?.snippet?.channelId ?? null;
}
