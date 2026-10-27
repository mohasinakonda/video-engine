/**
 * Reading YouTube for a topic search (who made videos on this topic), with either the user's
 * own API key (their quota) or their connected channel's token (the app's shared search budget).
 * Official API only. Everything is held in memory for one request; nothing is stored.
 */
import { YOUTUBE_DATA_API } from '../config';
import { parseIsoDuration } from '../data-client';
import { GoogleApiError, googleJson } from '../google-fetch';

export type YouTubeAuth = { key: string } | { token: string };

function request<T>(auth: YouTubeAuth, path: string, params: URLSearchParams): Promise<T> {
  if ('key' in auth) params.set('key', auth.key);
  return googleJson<T>(`${YOUTUBE_DATA_API}/${path}?${params}`, { headers: 'token' in auth ? { Authorization: `Bearer ${auth.token}` } : undefined });
}

export interface FoundVideo {
  id: string;
  channelId: string;
  title: string;
  publishedAt: string;
  durationSec: number | null;
  views: number | null;
  thumbnailUrl: string | null;
  liveOrUpcoming: boolean;
}

const num = (v: string | undefined) => (v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

/** One search.list call (1 of the project's daily search calls): the most relevant videos for the topic. */
export async function searchTopic(auth: YouTubeAuth, topic: string, language: 'English' | 'Bangla', max = 50): Promise<string[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: topic,
    type: 'video',
    maxResults: String(Math.min(50, max)),
    order: 'relevance',
    relevanceLanguage: language === 'Bangla' ? 'bn' : 'en',
    fields: 'items/id/videoId',
  });
  const data = await request<{ items?: { id?: { videoId?: string } }[] }>(auth, 'search', params);
  return Array.from(new Set((data.items ?? []).map((i) => i.id?.videoId).filter((id): id is string => !!id)));
}

/** Details for up to 50 videos (1 unit). */
export async function videoDetails(auth: YouTubeAuth, ids: string[]): Promise<FoundVideo[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: ids.slice(0, 50).join(','),
    fields: 'items(id,snippet(channelId,title,publishedAt,liveBroadcastContent,thumbnails/medium/url),contentDetails/duration,statistics/viewCount)',
  });
  const data = await request<{
    items?: { id: string; snippet?: { channelId?: string; title?: string; publishedAt?: string; liveBroadcastContent?: string; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { duration?: string }; statistics?: { viewCount?: string } }[];
  }>(auth, 'videos', params);
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data.items ?? [])
    .filter((v) => v.snippet?.channelId)
    .map((v) => ({
      id: v.id,
      channelId: v.snippet!.channelId!,
      title: v.snippet?.title ?? '',
      publishedAt: v.snippet?.publishedAt ?? '',
      durationSec: parseIsoDuration(v.contentDetails?.duration),
      views: num(v.statistics?.viewCount),
      thumbnailUrl: v.snippet?.thumbnails?.medium?.url ?? null,
      liveOrUpcoming: v.snippet?.liveBroadcastContent === 'live' || v.snippet?.liveBroadcastContent === 'upcoming',
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export interface FoundChannel {
  id: string;
  title: string;
  /** Null when the channel hides it. */
  subscribers: number | null;
  /** Avatar URL; missing on older results. */
  thumbnail?: string | null;
}

/** Names and subscriber counts for up to 50 channels (1 unit). */
export async function channelInfo(auth: YouTubeAuth, ids: string[]): Promise<FoundChannel[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ part: 'snippet,statistics', id: ids.slice(0, 50).join(','), fields: 'items(id,snippet(title,thumbnails/default/url),statistics(subscriberCount,hiddenSubscriberCount))' });
  const data = await request<{
    items?: { id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }[];
  }>(auth, 'channels', params);
  return (data.items ?? []).map((c) => ({
    id: c.id,
    title: c.snippet?.title ?? '',
    subscribers: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount),
    thumbnail: c.snippet?.thumbnails?.default?.url ?? null,
  }));
}

/** A channel's recent uploads (about 2 units), for its usual views. Empty if it has none. */
export async function recentUploads(auth: YouTubeAuth, channelId: string, max = 30): Promise<FoundVideo[]> {
  try {
    const params = new URLSearchParams({ part: 'contentDetails', playlistId: `UU${channelId.slice(2)}`, maxResults: String(Math.min(50, max)), fields: 'items/contentDetails/videoId' });
    const page = await request<{ items?: { contentDetails?: { videoId?: string } }[] }>(auth, 'playlistItems', params);
    return videoDetails(auth, (page.items ?? []).map((i) => i.contentDetails?.videoId).filter((id): id is string => !!id));
  } catch (err) {
    if (err instanceof GoogleApiError && err.kind === 'not_found') return [];
    throw err;
  }
}
