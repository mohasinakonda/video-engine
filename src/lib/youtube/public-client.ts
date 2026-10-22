import { YOUTUBE_DATA_API } from './config';
import { fetchChannelByHandle, fetchChannelsById, type ChannelIdentity } from './data-client';
import { googleJson } from './google-fetch';
import { QuotaBudgetError, SEARCH_BUCKET, consumeQuota } from './quota-budget';

/**
 * Public YouTube research (other channels' public data) with the user's own OAuth token.
 * No API key: youtube.readonly can read public data. Nothing fetched here is stored.
 */

export const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
// Handles may use letters from any script (Bangla included). Built with RegExp: the tsconfig target lacks the u flag.
const HANDLE_RE = new RegExp('^@?[\\p{L}\\p{M}\\p{N}._-]{3,30}$', 'u');
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

export type ChannelInput =
  | { kind: 'id'; id: string }
  | { kind: 'handle'; handle: string }
  | { kind: 'video'; id: string };

export type ParseResult = { ok: true; input: ChannelInput } | { ok: false; reason: string };

/**
 * What a user pasted to name a channel: a channel id, an @handle, a channel or handle URL,
 * or any video URL (watch, youtu.be, shorts, live). Pure: no network.
 */
export function parseChannelInput(raw: string): ParseResult {
  const text = raw.trim();
  if (!text || text.length > 200) return { ok: false, reason: 'Paste a YouTube channel link, @handle or video link.' };
  if (CHANNEL_ID_RE.test(text)) return { ok: true, input: { kind: 'id', id: text } };
  if (text.startsWith('@')) {
    return HANDLE_RE.test(text)
      ? { ok: true, input: { kind: 'handle', handle: text } }
      : { ok: false, reason: 'That @handle doesn’t look valid.' };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, reason: 'Paste a YouTube channel link, @handle or video link.' };
  }
  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] || '';
    return VIDEO_ID_RE.test(id) ? { ok: true, input: { kind: 'video', id } } : { ok: false, reason: 'That video link doesn’t look valid.' };
  }
  if (!YOUTUBE_HOSTS.has(host)) return { ok: false, reason: 'Only youtube.com and youtu.be links are supported.' };

  const [first = '', second = ''] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (first === 'watch') {
    const id = url.searchParams.get('v') || '';
    return VIDEO_ID_RE.test(id) ? { ok: true, input: { kind: 'video', id } } : { ok: false, reason: 'That video link doesn’t look valid.' };
  }
  if (first === 'shorts' || first === 'live') {
    return VIDEO_ID_RE.test(second) ? { ok: true, input: { kind: 'video', id: second } } : { ok: false, reason: 'That video link doesn’t look valid.' };
  }
  if (first === 'channel') {
    return CHANNEL_ID_RE.test(second) ? { ok: true, input: { kind: 'id', id: second } } : { ok: false, reason: 'That channel link doesn’t look valid.' };
  }
  if (first.startsWith('@')) {
    return HANDLE_RE.test(first) ? { ok: true, input: { kind: 'handle', handle: first } } : { ok: false, reason: 'That @handle doesn’t look valid.' };
  }
  if (first === 'c' || first === 'user') {
    return { ok: false, reason: 'Old /c/ and /user/ links can’t be looked up. Open the channel and copy its @handle link instead.' };
  }
  return { ok: false, reason: 'Paste a YouTube channel link, @handle or video link.' };
}

/** Resolves a parsed input to a public channel (1–2 units), or null when it doesn't exist. */
export async function resolveChannelInput(accessToken: string, input: ChannelInput): Promise<ChannelIdentity | null> {
  if (input.kind === 'handle') return fetchChannelByHandle(accessToken, input.handle);
  let channelId = input.kind === 'id' ? input.id : null;
  if (input.kind === 'video') {
    const params = new URLSearchParams({ part: 'snippet', id: input.id, fields: 'items/snippet/channelId' });
    const data = await googleJson<{ items?: Array<{ snippet?: { channelId?: string } }> }>(`${YOUTUBE_DATA_API}/videos?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    channelId = data.items?.[0]?.snippet?.channelId ?? null;
  }
  if (!channelId) return null;
  const [channel] = await fetchChannelsById(accessToken, [channelId]);
  return channel ?? null;
}

export interface SearchOptions {
  query: string;
  /** ISO timestamp; only videos published after it. */
  publishedAfter?: string;
  regionCode?: string | null;
  relevanceLanguage?: string | null;
  maxResults?: number;
  /** Admin's daily cap on search.list calls for the whole app. */
  dailyLimit: number;
  /** The caller already reserved this call from the budget (a run reserves all its calls up front). */
  prepaid?: boolean;
}

export interface SearchHit {
  videoId: string;
  channelId: string;
}

/**
 * One search.list call (type=video). Reserves one call from the shared daily budget first and
 * throws QuotaBudgetError when it's used up, so the shared 100/day bucket is never overrun.
 */
export async function searchVideos(accessToken: string, options: SearchOptions): Promise<SearchHit[]> {
  if (!options.prepaid && !(await consumeQuota(SEARCH_BUCKET, 1, options.dailyLimit))) {
    throw new QuotaBudgetError('global', 'Today’s YouTube search limit for our app is used up.');
  }
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: options.query,
    maxResults: String(Math.min(50, Math.max(1, options.maxResults ?? 50))),
    fields: 'items(id/videoId,snippet/channelId)',
  });
  if (options.publishedAfter) params.set('publishedAfter', options.publishedAfter);
  if (options.regionCode && /^[A-Z]{2}$/.test(options.regionCode)) params.set('regionCode', options.regionCode);
  if (options.relevanceLanguage && /^[a-z]{2,3}(-[A-Za-z]+)?$/.test(options.relevanceLanguage)) {
    params.set('relevanceLanguage', options.relevanceLanguage.split('-')[0]);
  }

  const data = await googleJson<{ items?: Array<{ id?: { videoId?: string }; snippet?: { channelId?: string } }> }>(
    `${YOUTUBE_DATA_API}/search?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, retries: 0 }
  );
  const hits: SearchHit[] = [];
  for (const item of data.items || []) {
    const videoId = item.id?.videoId;
    const channelId = item.snippet?.channelId;
    if (videoId && channelId && CHANNEL_ID_RE.test(channelId)) hits.push({ videoId, channelId });
  }
  return hits;
}
