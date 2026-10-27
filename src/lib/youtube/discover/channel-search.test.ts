import { describe, expect, it } from 'vitest';
import type { FoundChannel, FoundVideo } from '../create/topic-fetch';
import { channelsFromResults, cleanSearchQuery, searchLanguage } from './channel-search';

const video = (id: string, channelId: string, views: number | null, over: Partial<FoundVideo> = {}): FoundVideo => ({
  id,
  channelId,
  title: `Video ${id}`,
  publishedAt: '2026-10-01T00:00:00Z',
  durationSec: 600,
  views,
  thumbnailUrl: null,
  liveOrUpcoming: false,
  ...over,
});
const channel = (id: string, subscribers: number | null = 1000): FoundChannel => ({ id, title: `Channel ${id}`, subscribers, thumbnail: null });

describe('channelsFromResults', () => {
  it('groups videos by channel, most present first, then most viewed', () => {
    const hits = channelsFromResults({
      videos: [video('a1', 'A', 100), video('b1', 'B', 5000), video('a2', 'A', 900), video('c1', 'C', 9000)],
      channels: [channel('A'), channel('B'), channel('C')],
      ownChannelId: null,
      followed: [],
    });
    expect(hits.map((h) => h.channelId)).toEqual(['A', 'C', 'B']);
    expect(hits[0].videosInResults).toBe(2);
    expect(hits[0].topVideo.id).toBe('a2');
  });

  it('leaves out the creator’s own channel, live streams and channels YouTube no longer returns', () => {
    const hits = channelsFromResults({
      videos: [video('m1', 'MINE', 10), video('l1', 'L', 10, { liveOrUpcoming: true }), video('g1', 'GONE', 10), video('k1', 'K', 10)],
      channels: [channel('MINE'), channel('L'), channel('K')],
      ownChannelId: 'MINE',
      followed: [],
    });
    expect(hits.map((h) => h.channelId)).toEqual(['K']);
  });

  it('marks channels the creator already follows', () => {
    const hits = channelsFromResults({ videos: [video('a1', 'A', 1), video('b1', 'B', 1)], channels: [channel('A'), channel('B')], ownChannelId: null, followed: ['B'] });
    expect(hits.find((h) => h.channelId === 'B')?.following).toBe(true);
    expect(hits.find((h) => h.channelId === 'A')?.following).toBe(false);
  });
});

describe('searchLanguage', () => {
  it('searches in Bangla when the topic is written in Bangla', () => {
    expect(searchLanguage('ঘরোয়া রান্না')).toBe('Bangla');
    expect(searchLanguage('budget travel')).toBe('English');
  });
});

describe('cleanSearchQuery', () => {
  it('keeps letters in any language (Bangla was erased before)', () => {
    expect(cleanSearchQuery('বিশাল স্কুইড: সমুদ্রের রহস্য!')).toBe('বিশাল স্কুইড সমুদ্রের রহস্য');
    expect(cleanSearchQuery('Why orcas (really) attack?', 3)).toBe('Why orcas really');
  });
});
