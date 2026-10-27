import type { FoundChannel, FoundVideo } from '../create/topic-fetch';

/**
 * Discover's "Search a topic": one YouTube search, its videos grouped by channel so the creator
 * can follow the ones they compete with. Held in memory for the request; nothing is stored.
 */

export interface ChannelHit {
  channelId: string;
  title: string;
  thumbnail: string | null;
  /** Null when the channel hides it. */
  subscribers: number | null;
  /** How many of the search's videos are this channel's. */
  videosInResults: number;
  /** Its most viewed video in the results. */
  topVideo: { id: string; title: string; views: number | null; thumbnailUrl: string | null };
  following: boolean;
}

// Letters and digits in any script (Bangla included); everything else is a separator.
const NOT_QUERY_CHAR = new RegExp('[^\\p{L}\\p{M}\\p{N}\\s]+', 'gu');

/** A search phrase as sent to YouTube: any language, at most `maxWords` words. */
export function cleanSearchQuery(query: string, maxWords = 8): string {
  return query.replace(NOT_QUERY_CHAR, ' ').trim().split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
}

const BANGLA = /[ঀ-৿]/;
export const searchLanguage = (query: string): 'English' | 'Bangla' => (BANGLA.test(query) ? 'Bangla' : 'English');

/**
 * The channels behind a search's videos, most present first (then most viewed), without the
 * creator's own channel or live and upcoming streams.
 */
export function channelsFromResults(input: { videos: FoundVideo[]; channels: FoundChannel[]; ownChannelId: string | null; followed: Iterable<string> }): ChannelHit[] {
  const info = new Map(input.channels.map((c) => [c.id, c]));
  const followed = new Set(input.followed);
  const byChannel = new Map<string, FoundVideo[]>();
  for (const v of input.videos) {
    if (v.liveOrUpcoming || v.channelId === input.ownChannelId) continue;
    byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v]);
  }
  const hits: (ChannelHit & { totalViews: number })[] = [];
  byChannel.forEach((videos, channelId) => {
    const channel = info.get(channelId);
    if (!channel) return; // YouTube no longer returns it
    const top = [...videos].sort((a, b) => (b.views ?? -1) - (a.views ?? -1))[0];
    hits.push({
      channelId,
      title: channel.title,
      thumbnail: channel.thumbnail ?? null,
      subscribers: channel.subscribers,
      videosInResults: videos.length,
      topVideo: { id: top.id, title: top.title, views: top.views, thumbnailUrl: top.thumbnailUrl },
      following: followed.has(channelId),
      totalViews: videos.reduce((s, v) => s + (v.views ?? 0), 0),
    });
  });
  return hits
    .sort((a, b) => b.videosInResults - a.videosInResults || b.totalViews - a.totalViews)
    .map(({ totalViews: _, ...hit }) => hit);
}
