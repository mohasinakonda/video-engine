/**
 * Public data for an audit, read with the user's token (docs/audit-plan.md §2). Held in memory
 * for one request; nothing here is stored. No search: about 5 quota units per video audit.
 */
import { YOUTUBE_DATA_API } from '../config';
import { fetchUploadIds, fetchVideoDetails, parseIsoDuration } from '../data-client';
import { GoogleApiError, googleJson } from '../google-fetch';
import type { MarketVideo } from '../discover/types';

/** One video with everything the audit reads from it. */
export interface AuditVideo {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  durationSec: number | null;
  thumbnailUrl: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  /** A live stream or upcoming premiere: no final length or views yet. */
  liveOrUpcoming: boolean;
}

interface VideoItem {
  id: string;
  snippet?: {
    channelId?: string;
    channelTitle?: string;
    title?: string;
    description?: string;
    tags?: string[];
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

const num = (v: string | undefined) => (v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

/** The video, or null when YouTube doesn't return it (private, deleted or a bad id). 1 unit. */
export async function fetchAuditVideo(accessToken: string, videoId: string): Promise<AuditVideo | null> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: videoId,
    fields:
      'items(id,snippet(channelId,channelTitle,title,description,tags,publishedAt,liveBroadcastContent,thumbnails/high/url,thumbnails/medium/url),contentDetails/duration,statistics(viewCount,likeCount,commentCount))',
  });
  const data = await googleJson<{ items?: VideoItem[] }>(`${YOUTUBE_DATA_API}/videos?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const item = data.items?.[0];
  if (!item?.snippet?.channelId) return null;
  const s = item.snippet;
  return {
    id: item.id,
    channelId: s.channelId!,
    channelTitle: s.channelTitle ?? '',
    title: s.title ?? '',
    description: (s.description ?? '').slice(0, 5000),
    tags: (s.tags ?? []).slice(0, 100),
    publishedAt: s.publishedAt ?? '',
    durationSec: parseIsoDuration(item.contentDetails?.duration),
    thumbnailUrl: s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? null,
    views: num(item.statistics?.viewCount),
    likes: num(item.statistics?.likeCount),
    comments: num(item.statistics?.commentCount),
    liveOrUpcoming: s.liveBroadcastContent === 'live' || s.liveBroadcastContent === 'upcoming',
  };
}

/** The channel's recent public uploads, for its usual. About 2 units per 50 videos. */
export async function fetchChannelVideos(accessToken: string, channelId: string, max = 50): Promise<MarketVideo[]> {
  let ids: string[];
  try {
    ids = await fetchUploadIds(accessToken, `UU${channelId.slice(2)}`, max);
  } catch (err) {
    if (err instanceof GoogleApiError && err.kind === 'not_found') return [];
    throw err;
  }
  const videos = await fetchVideoDetails(accessToken, ids, { public: true });
  return videos
    .filter((v) => !v.liveOrUpcoming && v.durationSec !== 0)
    .map((v) => ({
      id: v.id,
      channelId: v.channelId || channelId,
      title: v.title,
      publishedAt: v.publishedAt,
      durationSec: v.durationSec,
      views: v.lifetimeViews,
      likes: v.likes,
      comments: v.comments,
      thumbnailUrl: v.thumbnailUrl,
    }));
}

/**
 * The most relevant top-level comments, text only: no author names or ids are read. 1 unit.
 * Comments can't be read with `youtube.readonly`, and asking users for a write-capable scope
 * isn't worth it, so this uses a server-side API key (public data only). `available` is false
 * without a key; `disabled` when the channel turned comments off.
 */
export async function fetchCommentTexts(videoId: string, max: number): Promise<{ texts: string[]; available: boolean; disabled: boolean }> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || max <= 0) return { texts: [], available: false, disabled: false };
  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    order: 'relevance',
    textFormat: 'plainText',
    maxResults: String(Math.min(100, max)),
    fields: 'items/snippet/topLevelComment/snippet(textDisplay)',
    key,
  });
  try {
    const data = await googleJson<{ items?: { snippet?: { topLevelComment?: { snippet?: { textDisplay?: string } } } }[] }>(`${YOUTUBE_DATA_API}/commentThreads?${params}`);
    const texts = (data.items ?? [])
      .map((i) => (i.snippet?.topLevelComment?.snippet?.textDisplay ?? '').trim().slice(0, 500))
      .filter(Boolean);
    return { texts, available: true, disabled: false };
  } catch (err) {
    if (err instanceof GoogleApiError && err.kind === 'forbidden' && err.reason === 'commentsDisabled') return { texts: [], available: true, disabled: true };
    throw err;
  }
}
