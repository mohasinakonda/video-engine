import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ChannelDoctorSettings } from '../settings';

// ─── Mocks: session, settings, access, token, credits, watchlist, quota ──────
const state = {
  user: { id: 'user-1' } as { id: string } | null,
  settings: { ...DEFAULT_SETTINGS, discover: { ...DEFAULT_SETTINGS.discover, enabled: true } } as ChannelDoctorSettings,
  access: { tier: 'CREATOR', isAdmin: false, hasAccess: true, hasDiscoverAccess: true },
  watchlist: [] as { channelId: string; active: boolean }[],
  quotaUsed: 0,
};
const consume = vi.fn(async () => true);
const deduct = vi.fn(async () => true);

vi.mock('../route-auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireUser: async () => (state.user ? { user: state.user } : { response: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) }),
  };
});
vi.mock('../settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../settings')>()),
  getChannelDoctorSettings: async () => state.settings,
  getUserAccess: async () => state.access,
}));
vi.mock('../connection-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../connection-service')>()),
  getValidAccessToken: async () => ({
    accessToken: 'token',
    reportingJobId: null,
    connection: { channelId: 'UC' + 'm'.repeat(22), title: 'Mine', thumbnail: null, url: '', status: 'active', reportingStartedAt: null },
  }),
}));
vi.mock('@/lib/supabase-service', () => ({ deductCreditsRemote: () => deduct(), grantCreditsRemote: async () => true }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({}) }));
vi.mock('./watchlist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./watchlist')>()),
  listWatchlist: async () => state.watchlist,
  addToWatchlist: async () => ['x'],
}));
vi.mock('../quota-budget', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../quota-budget')>()),
  quotaUsed: async (bucket: string) => (bucket === 'search' ? state.quotaUsed : 0),
  consumeQuota: () => consume(),
}));
vi.mock('../public-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../public-client')>()),
  resolveChannelInput: async () => ({ id: 'UC' + 'm'.repeat(22) }),
}));

import { POST as research } from '@/app/api/youtube/discover/research/route';
import { POST as discovery } from '@/app/api/youtube/discover/discovery/route';
import { POST as addCompetitor } from '@/app/api/youtube/discover/competitors/route';

const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  state.user = { id: 'user-1' };
  state.access = { tier: 'CREATOR', isAdmin: false, hasAccess: true, hasDiscoverAccess: true };
  state.settings = { ...DEFAULT_SETTINGS, discover: { ...DEFAULT_SETTINGS.discover, enabled: true } };
  state.watchlist = [];
  state.quotaUsed = 0;
  consume.mockClear();
  deduct.mockClear();
});

describe('Discover API', () => {
  it('requires a session', async () => {
    state.user = null;
    expect((await research(post({ window: '90d' }))).status).toBe(401);
    expect((await discovery(post({ queries: ['x y'] }))).status).toBe(401);
  });

  it('enforces the plan, and hides Discover while it is switched off', async () => {
    state.access = { ...state.access, hasDiscoverAccess: false };
    const planned = await research(post({ window: '90d' }));
    expect(planned.status).toBe(403);
    expect((await planned.json()).code).toBe('plan');

    state.settings = { ...state.settings, discover: { ...state.settings.discover, enabled: false } };
    expect((await research(post({ window: '90d' }))).status).toBe(503);
  });

  it('validates input', async () => {
    expect((await research(post({ window: '7d' }))).status).toBe(400);
    expect((await discovery(post({ queries: [] }))).status).toBe(400);
  });

  it('refuses research with fewer than 2 competitors, before charging credits', async () => {
    state.watchlist = [{ channelId: 'UC' + 'a'.repeat(22), active: true }];
    const res = await research(post({ window: '90d' }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/at least 2 competitors/);
    expect(deduct).not.toHaveBeenCalled();
  });

  it('stops discovery when the shared search budget is used up, without calling YouTube or charging', async () => {
    state.quotaUsed = state.settings.discover.searchDailyGlobalLimit;
    const res = await discovery(post({ queries: ['deep sea fish'] }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/search limit/);
    expect(consume).not.toHaveBeenCalled();
    expect(deduct).not.toHaveBeenCalled();
  });

  it('won’t add your own channel as a competitor', async () => {
    const res = await addCompetitor(post({ input: '@mine' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own channel/);
  });
});
