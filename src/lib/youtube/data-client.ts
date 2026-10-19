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
}

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; customUrl?: string; thumbnails?: Record<string, { url?: string }> };
    statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The channels owned by the authorized Google identity (`mine=true`). Costs 1 quota unit. */
export async function fetchMyChannels(accessToken: string): Promise<ChannelIdentity[]> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    mine: 'true',
    fields:
      'items(id,snippet(title,customUrl,thumbnails/default/url,thumbnails/medium/url),statistics(subscriberCount,videoCount,hiddenSubscriberCount),contentDetails/relatedPlaylists/uploads)',
  });
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
    };
  });
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
    snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> };
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

/** Metadata for up to 50 videos per request (1 unit each). Format is filled in later from Analytics. */
export async function fetchVideoDetails(accessToken: string, ids: string[]): Promise<VideoMeta[]> {
  const videos: VideoMeta[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(i, i + 50).join(','),
      fields:
        'items(id,snippet(title,publishedAt,thumbnails/medium/url,thumbnails/high/url),contentDetails/duration,statistics(viewCount,likeCount,commentCount))',
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
      });
    }
  }
  // Keep the uploads order (newest first).
  const order = new Map(ids.map((id, index) => [id, index]));
  return videos.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
