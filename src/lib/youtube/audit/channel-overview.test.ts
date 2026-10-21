import { describe, expect, it } from 'vitest';
import { buildChannelOverview, parseKeywords, topicLabel, uploadsByMonth, type ChannelProfile } from './channel-overview';
import type { AuditChannelVideo } from './fetch';

const profile: ChannelProfile = {
  createdAt: '2020-01-01T00:00:00Z',
  handle: '@test',
  country: 'US',
  language: 'en',
  description: '',
  keywords: [],
  topics: [],
  totalViews: 100000,
  subscribers: 1000,
  videoCount: 4,
};

const video = (id: string, over: Partial<AuditChannelVideo>): AuditChannelVideo => ({
  id,
  channelId: 'UC1',
  title: id,
  publishedAt: '2026-09-01T12:00:00Z',
  durationSec: 600,
  views: 1000,
  likes: 50,
  comments: 5,
  thumbnailUrl: null,
  tags: [],
  categoryId: '15',
  ...over,
});

describe('channel overview helpers', () => {
  it('reads topic labels from Wikipedia urls', () => {
    expect(topicLabel('https://en.wikipedia.org/wiki/Lifestyle_(sociology)')).toBe('Lifestyle');
    expect(topicLabel('https://en.wikipedia.org/wiki/Animal')).toBe('Animal');
  });

  it('splits keywords, keeping quoted phrases together', () => {
    expect(parseKeywords('ocean "deep sea" whales ocean')).toEqual(['ocean', 'deep sea', 'whales']);
  });

  it('counts uploads per month with empty months', () => {
    const months = uploadsByMonth(['2026-08-10T00:00:00Z', '2026-06-01T00:00:00Z', '2026-06-20T00:00:00Z'], new Date('2026-09-15T00:00:00Z'));
    expect(months).toEqual([
      { month: '2026-06', count: 2 },
      { month: '2026-07', count: 0 },
      { month: '2026-08', count: 1 },
      { month: '2026-09', count: 0 },
    ]);
  });
});

describe('buildChannelOverview', () => {
  const recent = [
    video('a', { views: 4000, likes: 200, tags: ['Ocean', 'whales'] }),
    video('b', { views: 1000, likes: 40, tags: ['ocean'] }),
    video('c', { views: 500, durationSec: 40, categoryId: '27' }),
    video('d', { views: 50, likes: 49 }),
  ];

  it('gives the first upload only when the whole history was read', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const full = buildChannelOverview(profile, { dates: ['2026-09-01T00:00:00Z', '2021-03-05T00:00:00Z'], complete: true }, recent, now);
    expect(full.firstUploadAt).toBe('2021-03-05T00:00:00Z');
    expect(full.oldestReadAt).toBeNull();
    const partial = buildChannelOverview(profile, { dates: ['2026-09-01T00:00:00Z', '2021-03-05T00:00:00Z'], complete: false }, recent, now);
    expect(partial.firstUploadAt).toBeNull();
    expect(partial.oldestReadAt).toBe('2021-03-05T00:00:00Z');
  });

  it('summarises niche, length, engagement and tags', () => {
    const o = buildChannelOverview(profile, { dates: [], complete: true }, recent, new Date('2026-10-01T00:00:00Z'));
    expect(o.categories[0]).toEqual({ name: 'Pets & Animals', share: 0.75 });
    expect(o.lengthMix.map((g) => [g.label, g.count])).toEqual([
      ['Shorts', 1],
      ['8–15 min', 3],
    ]);
    expect(o.engagement.medianViews).toBe(750);
    expect(o.engagement.viewsPerSubscriber).toBe(0.75);
    // The 50-view video is left out of the rates.
    expect(o.engagement.likesPer1kViews).toBe(50);
    expect(o.mostLiked[0].id).toBe('a');
    expect(o.topTags).toEqual([{ tag: 'Ocean', count: 2 }]);
  });
});

describe('detectReportLanguage', () => {
  it('follows a Bangla language code', async () => {
    const { detectReportLanguage } = await import('./language');
    expect(detectReportLanguage(['Ocean facts'], ['bn-BD'])).toBe('Bangla');
  });
  it('reads the script of the titles', async () => {
    const { detectReportLanguage } = await import('./language');
    expect(detectReportLanguage(['সমুদ্রের রহস্য | Ocean'])).toBe('Bangla');
    expect(detectReportLanguage(['Why the ocean is scary', 'Deep sea'], [null, 'en'])).toBe('English');
  });
});
