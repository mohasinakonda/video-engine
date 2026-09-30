import type { CompetitorVideo } from '@/types';

/**
 * Searches YouTube for competitor benchmarks.
 * Supports:
 *  1. Google Cloud YouTube Data API v3 (if apiKey is supplied or in env)
 *  2. Zero-config server-side YouTube parser (`ytInitialData`) with high-res thumbnails and real view counts
 */
export async function searchYouTubeMarket(query: string, apiKey?: string): Promise<CompetitorVideo[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. If official Google Cloud YouTube API Key provided
  if (apiKey && apiKey.trim()) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(cleanQuery)}&type=video&maxResults=5&order=viewCount&key=${apiKey.trim()}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        const list = items
          .map((it: any) => ({
            id: it.id?.videoId || '',
            title: it.snippet?.title || '',
            channel: it.snippet?.channelTitle || '',
            views: 'Top Ranked',
            thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || '',
            videoUrl: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
          }))
          .filter((v: any) => v.id);
        if (list.length > 0) return list;
      }
    } catch (err) {
      console.warn('Google YouTube API search failed, falling back to server parser:', err);
    }
  }

  // 2. Zero-config server-side YouTube parser
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const text = await res.text();
      const match = text.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const items =
          data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
            ?.itemSectionRenderer?.contents || [];

        const videos: CompetitorVideo[] = items
          .filter((i: any) => i.videoRenderer && i.videoRenderer.videoId)
          .slice(0, 5)
          .map((i: any) => {
            const vr = i.videoRenderer;
            const thumbs = vr.thumbnail?.thumbnails || [];
            return {
              id: vr.videoId,
              title: vr.title?.runs?.[0]?.text || 'YouTube Video',
              channel: vr.ownerText?.runs?.[0]?.text || '',
              views: vr.shortViewCountText?.simpleText || vr.viewCountText?.simpleText || 'Popular',
              thumbnail: thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
              videoUrl: `https://www.youtube.com/watch?v=${vr.videoId}`,
            };
          });

        if (videos.length > 0) return videos;
      }
    }
  } catch (err) {
    console.warn('YouTube zero-config search failed:', err);
  }

  return [];
}
