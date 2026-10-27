import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ChannelDoctorSettings } from '../settings';
import type { FoundChannel, FoundVideo } from './topic-fetch';
import { buildLandscape, pickTopicMatches, sizeOf, titleSimilarity, topicCoverage, usualRatio } from './topic-landscape';

const NOW = new Date('2026-10-20T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let n = 0;
const vid = (over: Partial<FoundVideo> = {}): FoundVideo => ({
  id: `vid${String(++n).padStart(8, '0')}`, channelId: 'UCbig', title: 'Deep sea creatures explained', publishedAt: daysAgo(200), durationSec: 600, views: 100_000, thumbnailUrl: null, liveOrUpcoming: false, ...over,
});
const channels: FoundChannel[] = [
  { id: 'UCbig', title: 'Big', subscribers: 2_000_000 },
  { id: 'UCsmall', title: 'Small', subscribers: 20_000 },
  { id: 'UChidden', title: 'Hidden', subscribers: null },
];

describe('titleSimilarity', () => {
  it('compares titles by words, tolerating edits and Bangla', () => {
    expect(titleSimilarity('Why Deep Sea Creatures Glow', 'Why deep-sea creatures GLOW (explained)')).toBe(1);
    expect(titleSimilarity('Why Deep Sea Creatures Glow', 'My morning routine')).toBe(0);
    expect(titleSimilarity('কেন গভীর সমুদ্রের প্রাণীরা আলো জ্বালায়?', 'গভীর সমুদ্রের প্রাণীরা কেন আলো জ্বালায়')).toBe(1);
  });
});

describe('topic matches in followed channels', () => {
  it('scores how much of the topic a title covers, one way only', () => {
    expect(topicCoverage('giant squid', 'The Giant Squid: Ocean’s Biggest Mystery')).toBe(1);
    // A one-word title isn't a full match just because it is short.
    expect(topicCoverage('giant squid attack', 'Squid!')).toBeCloseTo(1 / 3);
    // Five-letter stems match Bangla word endings (স্কুইড / স্কুইডের).
    expect(topicCoverage('বিশাল স্কুইড', 'বিশাল স্কুইডের রহস্য')).toBe(1);
  });

  it('keeps on-topic uploads, best match then most viewed, without live or duplicate videos', () => {
    const a = vid({ title: 'Giant squid caught on camera', views: 10 });
    const b = vid({ title: 'The giant squid explained', views: 500 });
    const live = vid({ title: 'Giant squid live', liveOrUpcoming: true });
    const off = vid({ title: 'Octopus facts' });
    const picked = pickTopicMatches('giant squid', [a, off, b, live, a]);
    expect(picked.map((v) => v.id)).toEqual([b.id, a.id]);
  });

  it('marks a landscape built from followed channels and explains it', () => {
    const l = buildLandscape({ topic: 't', plannedLines: [], videos: [vid()], channels, usual: new Map(), now: NOW, source: { kind: 'competitors', channelsChecked: 7 } });
    expect(l.source).toBe('competitors');
    expect(l.limitations[0]).toContain('7 channels you follow');
    expect(buildLandscape({ topic: 't', plannedLines: [], videos: [vid()], channels, usual: new Map(), now: NOW }).source).toBe('youtube');
  });
});

describe('topic landscape', () => {
  it('reads each video fairly: per day (from a week), per subscriber, × its usual', () => {
    const fresh = vid({ publishedAt: daysAgo(2), views: 70_000 });
    const l = buildLandscape({ topic: 't', plannedLines: [], videos: [fresh, vid({ channelId: 'UCsmall', views: 200_000 })], channels, usual: new Map([[fresh.id, 3.2]]), now: NOW });
    expect(l.videos[0]).toMatchObject({ viewsPerDay: 10_000, isNew: true, usualRatio: 3.2, size: 'big', perSubscriber: 0 });
    expect(l.videos[1]).toMatchObject({ perSubscriber: 10, size: 'small', isNew: false });
  });

  it('keeps YouTube’s relevance order as a rank, skipping live videos', () => {
    const l = buildLandscape({ topic: 't', plannedLines: [], videos: [vid(), vid({ liveOrUpcoming: true }), vid()], channels, usual: new Map(), now: NOW });
    expect(l.videos.map((v) => v.rank)).toEqual([0, 1]);
  });

  it('summarises how crowded it is, who wins, and the language gap', () => {
    const recent = Array.from({ length: 10 }, () => vid({ publishedAt: daysAgo(20) }));
    const l = buildLandscape({ topic: 't', plannedLines: [], videos: [...recent, vid({ channelId: 'UCsmall', views: 300_000 }), vid({ channelId: 'UCsmall', durationSec: 40, views: 500_000 })], channels, usual: new Map(), now: NOW });
    expect(l.summary).toMatchObject({ found: 12, last90: 10, crowd: 'crowded', smallWins: 2, smallWinsLong: 1, bangla: 0 });
    expect(l.signals.join('\n')).toContain('1 long video from channels under 100K');
    expect(l.signals.join('\n')).toContain('plus 1 Short');
    expect(l.signals.join('\n')).toContain('None of these videos are in Bangla');
  });

  it('flags results too close to the plan, and handles an empty search', () => {
    const close = vid({ title: 'How Deep-Sea Fish Make Their Own Light!' });
    const l = buildLandscape({ topic: 't', plannedLines: ['Why deep sea fish make their own light', 'x'], videos: [close], channels, usual: new Map(), now: NOW });
    expect(l.similar).toEqual([{ id: close.id, title: close.title, to: 'Why deep sea fish make their own light' }]);
    expect(buildLandscape({ topic: 't', plannedLines: [], videos: [], channels, usual: new Map(), now: NOW }).signals[0]).toContain('no videos');
  });

  it('sizes channels and compares with their own uploads', () => {
    expect([null, 5_000, 50_000, 500_000, 5_000_000].map(sizeOf)).toEqual(['unknown', 'tiny', 'small', 'mid', 'big']);
    const uploads = Array.from({ length: 12 }, () => vid({ views: 1_000, publishedAt: daysAgo(30) }));
    expect(usualRatio(vid({ views: 5_000 }), uploads, NOW)).toBe(5);
  });
});

// ─── Route ───────────────────────────────────────────────────────────────────
const state = {
  settings: { ...DEFAULT_SETTINGS, create: { ...DEFAULT_SETTINGS.create, enabled: true } } as ChannelDoctorSettings,
  used: 0,
  globalOk: true,
  consumed: [] as string[],
  auth: null as unknown,
  credits: { charged: 0, refunded: 0 },
  failSearch: false,
  searches: 0,
  followed: [] as string[],
  uploads: {} as Record<string, FoundVideo[]>,
};
vi.mock('../discover/watchlist', async (o) => ({
  ...(await o<typeof import('../discover/watchlist')>()),
  listWatchlist: async () => state.followed.map((channelId) => ({ channelId, label: null, group: 'direct', active: true, addedAt: '' })),
}));
vi.mock('../route-auth', () => ({ requireUser: async () => ({ user: { id: 'user-a' } }) }));
vi.mock('../settings', async (o) => ({
  ...(await o<typeof import('../settings')>()),
  getChannelDoctorSettings: async () => state.settings,
  getUserAccess: async () => ({ tier: 'CREATOR', isAdmin: false, hasAccess: true, hasDiscoverAccess: true, hasCreateAccess: true, hasAuditAccess: false }),
}));
vi.mock('../connection-service', async (o) => ({
  ...(await o<typeof import('../connection-service')>()),
  getValidAccessToken: async () => ({ accessToken: 'tok', reportingJobId: null, connection: { channelId: 'UC' + 'm'.repeat(22) } }),
}));
vi.mock('../quota-budget', async (o) => ({
  ...(await o<typeof import('../quota-budget')>()),
  quotaUsed: async () => state.used,
  consumeQuota: async (bucket: string) => (state.consumed.push(bucket), bucket === 'search' ? state.globalOk : true),
}));
vi.mock('../run-guard', () => ({ acquireRun: () => ({ ok: true, release: () => undefined }) }));
vi.mock('@/lib/supabase-service', () => ({
  deductCreditsRemote: async (_u: string, x: number) => ((state.credits.charged += x), true),
  grantCreditsRemote: async (_u: string, x: number) => ((state.credits.refunded += x), true),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({}) }));
vi.mock('./route-helpers', async (o) => {
  const actual = await o<typeof import('./route-helpers')>();
  return { ...actual, ownedProject: async (_u: string, id: string) => (id === 'mine' ? { id, title: 'Deep sea light', brief: null, thesis: null } : (await import('next/server')).NextResponse.json({}, { status: 404 })) };
});
const saved = { usage: null as unknown };
vi.mock('./projects', async (o) => ({
  ...(await o<typeof import('./projects')>()),
  updateProject: async (_u: string, project: object, changes: { usage?: unknown }) => ((saved.usage = changes.usage), { ...project, ...changes }),
}));
vi.mock('./topic-fetch', () => ({
  searchTopic: async (auth: unknown) => {
    state.auth = auth;
    state.searches++;
    if (state.failSearch) throw new Error('boom');
    return ['a'];
  },
  videoDetails: async () => [vid()],
  channelInfo: async () => channels,
  recentUploads: async (_auth: unknown, channelId: string) => state.uploads[channelId] ?? [],
}));

import { POST as topicSearch } from '@/app/api/create/projects/[id]/topic-search/route';

const post = (body: object = {}) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: { id } });
const events = async (res: Response) => (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe('topic search route', () => {
  beforeEach(() => {
    state.used = 0;
    state.globalOk = true;
    state.consumed = [];
    state.credits = { charged: 0, refunded: 0 };
    state.failSearch = false;
    state.searches = 0;
    state.followed = [];
    state.uploads = {};
    state.settings = { ...DEFAULT_SETTINGS, create: { ...DEFAULT_SETTINGS.create, enabled: true } };
  });

  it('searches with the connected channel, from the shared budget, at the admin price', async () => {
    const out = await events(await topicSearch(post(), ctx('mine')));
    expect(out.at(-1).type).toBe('result');
    expect(out.at(-1).data.landscape.summary.found).toBe(1);
    expect(state.auth).toEqual({ token: 'tok' });
    expect(state.consumed).toEqual(['search', 'topic-search:user:user-a']);
    expect(state.credits.charged).toBe(3);
    // The search is counted against the video's allowance.
    expect(saved.usage).toEqual({ topicSearch: 1 });
  });

  it('uses the user’s own key without touching the shared budget', async () => {
    const key = 'AIza' + 'x'.repeat(35);
    await events(await topicSearch(post({ youtubeApiKey: key }), ctx('mine')));
    expect(state.auth).toEqual({ key });
    expect(state.consumed).toEqual(['topic-search:user:user-a']);
  });

  it('stops before charging at the daily limit, an empty budget, or when switched off', async () => {
    state.used = 3;
    expect((await topicSearch(post(), ctx('mine'))).status).toBe(429);
    state.used = 0;
    state.globalOk = false;
    expect((await (await topicSearch(post(), ctx('mine'))).json()).error).toContain('search budget');
    state.settings = { ...state.settings, create: { ...state.settings.create, topicSearchesPerUserDay: 0 } };
    expect((await topicSearch(post(), ctx('mine'))).status).toBe(429);
    expect(state.credits.charged).toBe(0);
  });

  it('answers from followed channels without a YouTube search when they have enough on the topic', async () => {
    state.followed = ['UCone', 'UCtwo', 'UCthree'];
    // The project's topic is "Deep sea light".
    state.uploads = {
      UCone: [vid({ channelId: 'UCone', title: 'Deep sea light explained' }), vid({ channelId: 'UCone', title: 'Deep sea light shows' }), vid({ channelId: 'UCone', title: 'Cooking pasta' })],
      UCtwo: [vid({ channelId: 'UCtwo', title: 'The deep sea makes its own light' }), vid({ channelId: 'UCtwo', title: 'Light in the deep sea' })],
      UCthree: [vid({ channelId: 'UCthree', title: 'Deep sea light: the full story' }), vid({ channelId: 'UCthree', title: 'Why the deep sea has light' })],
    };
    const out = await events(await topicSearch(post(), ctx('mine')));
    const result = out.at(-1);
    expect(result.type).toBe('result');
    expect(result.data.landscape.source).toBe('competitors');
    expect(result.data.landscape.summary.found).toBe(6);
    expect(result.data.followed).toEqual(['UCone', 'UCtwo', 'UCthree']);
    expect(state.searches).toBe(0);
    expect(state.consumed).toEqual([]);
  });

  it('falls back to one YouTube search when followed channels have too few videos on it', async () => {
    state.followed = ['UCone', 'UCtwo', 'UCthree'];
    state.uploads = { UCone: [vid({ channelId: 'UCone', title: 'Deep sea light explained' })] };
    const out = await events(await topicSearch(post(), ctx('mine')));
    expect(out.at(-1).data.landscape.source).toBe('youtube');
    expect(state.searches).toBe(1);
    expect(state.consumed).toEqual(['search', 'topic-search:user:user-a']);
  });

  it('can be told to search all of YouTube', async () => {
    state.followed = ['UCone', 'UCtwo', 'UCthree'];
    await events(await topicSearch(post({ scope: 'youtube' }), ctx('mine')));
    expect(state.searches).toBe(1);
  });

  it('refuses other users’ projects and refunds a failed search', async () => {
    expect((await topicSearch(post(), ctx('theirs'))).status).toBe(404);
    state.failSearch = true;
    const out = await events(await topicSearch(post(), ctx('mine')));
    expect(out.at(-1)).toMatchObject({ type: 'error', refunded: true });
  });
});
