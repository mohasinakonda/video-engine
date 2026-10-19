import type { CompetitorVideo } from '@/types';
import { YOUTUBE_DATA_API } from '@/lib/youtube/config';
import { NotConnectedError, ReauthRequiredError, getValidAccessToken } from '@/lib/youtube/connection-service';
import { googleJson } from '@/lib/youtube/google-fetch';
import { SEARCH_BUCKET, consumeQuota } from '@/lib/youtube/quota-budget';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';

/**
 * Competitor benchmarks for the YouTube Launch Kit, through the official YouTube Data API only
 * (no page scraping, which YouTube's Terms of Service forbid):
 *  1. the user's own API key, if they saved one (their Google project's quota), else
 *  2. their connected YouTube channel's token, counted against the app's shared daily search budget.
 * Returns no videos, with a reason, when neither is available.
 */

export type MarketSearchStatus = 'ok' | 'no_access' | 'budget' | 'failed';

export interface MarketSearchResult {
  videos: CompetitorVideo[];
  status: MarketSearchStatus;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export async function searchYouTubeMarket(query: string, options: { apiKey?: string | null; userId?: string | null }): Promise<MarketSearchResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { videos: [], status: 'ok' };

  let auth: { key: string } | { token: string } | null = options.apiKey?.trim() ? { key: options.apiKey.trim() } : null;
  if (!auth && options.userId) {
    try {
      const { accessToken } = await getValidAccessToken(options.userId);
      auth = { token: accessToken };
    } catch (err) {
      if (!(err instanceof NotConnectedError || err instanceof ReauthRequiredError)) {
        console.warn('[youtube-search] token unavailable:', (err as Error)?.message);
      }
    }
    if (auth) {
      const { discover } = await getChannelDoctorSettings();
      if (!(await consumeQuota(SEARCH_BUCKET, 1, discover.searchDailyGlobalLimit))) return { videos: [], status: 'budget' };
    }
  }
  if (!auth) return { videos: [], status: 'no_access' };

  const request = <T,>(path: string, params: URLSearchParams) => {
    if ('key' in auth!) params.set('key', auth!.key);
    return googleJson<T>(`${YOUTUBE_DATA_API}/${path}?${params}`, {
      headers: 'token' in auth! ? { Authorization: `Bearer ${auth!.token}` } : undefined,
      timeoutMs: 8000,
      retries: 0,
    });
  };

  try {
    const search = await request<{ items?: Array<{ id?: { videoId?: string } }> }>(
      'search',
      new URLSearchParams({ part: 'snippet', q: cleanQuery, type: 'video', maxResults: '5', order: 'viewCount', fields: 'items/id/videoId' })
    );
    const ids = (search.items || []).map((i) => i.id?.videoId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return { videos: [], status: 'ok' };

    // One more unit for real titles, channels and view counts.
    const details = await request<{
      items?: Array<{ id: string; snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> }; statistics?: { viewCount?: string } }>;
    }>('videos', new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), fields: 'items(id,snippet(title,channelTitle,thumbnails/high/url,thumbnails/medium/url),statistics/viewCount)' }));

    const videos = (details.items || []).map((v) => {
      const views = Number(v.statistics?.viewCount);
      return {
        id: v.id,
        title: v.snippet?.title || '',
        channel: v.snippet?.channelTitle || '',
        views: Number.isFinite(views) ? `${compact.format(views)} views` : 'Views hidden',
        thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
      };
    });
    return { videos, status: 'ok' };
  } catch (err) {
    console.warn('[youtube-search] search failed:', (err as Error)?.message);
    return { videos: [], status: 'failed' };
  }
}
