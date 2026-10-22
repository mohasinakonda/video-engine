import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ChannelDoctorSettings } from '../settings';
import type { FoundChannel, FoundVideo } from './topic-fetch';
import { buildLandscape, sizeOf, titleSimilarity, usualRatio } from './topic-landscape';

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
};
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
    if (state.failSearch) throw new Error('boom');
    return ['a'];
  },
  videoDetails: async () => [vid()],
  channelInfo: async () => channels,
  recentUploads: async () => [],
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

  it('refuses other users’ projects and refunds a failed search', async () => {
    expect((await topicSearch(post(), ctx('theirs'))).status).toBe(404);
    state.failSearch = true;
    const out = await events(await topicSearch(post(), ctx('mine')));
    expect(out.at(-1)).toMatchObject({ type: 'error', refunded: true });
  });
});
