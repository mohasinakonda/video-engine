import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ChannelDoctorSettings } from './settings';

const CHANNEL = 'UC' + 'm'.repeat(22);
const state = {
  settings: { ...DEFAULT_SETTINGS, trialFreeDiagnoses: 1 } as ChannelDoctorSettings,
  access: { tier: 'TRIAL', isAdmin: false, hasAccess: false, hasDiscoverAccess: false, hasCreateAccess: false, hasAuditAccess: false },
  claim: 'claim-1' as string | null,
  claimedFor: null as { userId: string; channelId: string; limit: number } | null,
  released: [] as string[],
  fail: false,
  credits: { charged: 0, refunded: 0 },
};

vi.mock('./route-auth', () => ({ requireUser: async () => ({ user: { id: 'user-1' } }) }));
vi.mock('./settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./settings')>()),
  getChannelDoctorSettings: async () => state.settings,
  getUserAccess: async () => state.access,
}));
vi.mock('./connection-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./connection-service')>()),
  getValidAccessToken: async () => ({ accessToken: 't', reportingJobId: null, connection: { channelId: CHANNEL, title: 'Mine' } }),
}));
vi.mock('./free-diagnosis', () => ({
  claimFreeDiagnosis: async (userId: string, channelId: string, limit: number) => ((state.claimedFor = { userId, channelId, limit }), state.claim),
  releaseFreeDiagnosis: async (id: string) => void state.released.push(id),
}));
vi.mock('@/lib/supabase-service', () => ({
  deductCreditsRemote: async (_u: string, n: number) => ((state.credits.charged += n), true),
  grantCreditsRemote: async (_u: string, n: number) => ((state.credits.refunded += n), true),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({}) }));
vi.mock('./run-guard', () => ({ acquireRun: () => ({ ok: true, release: () => undefined }) }));
vi.mock('./diagnosis', () => ({
  runDiagnosis: async () => {
    if (state.fail) throw new Error('boom');
    return { ok: true };
  },
}));

import { POST as diagnose } from '@/app/api/youtube/diagnosis/route';

const req = () => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ range: '28d' }) });
const events = async (res: Response) =>
  (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

beforeEach(() => {
  state.settings = { ...DEFAULT_SETTINGS, trialFreeDiagnoses: 1 };
  state.access = { ...state.access, tier: 'TRIAL', hasAccess: false };
  state.claim = 'claim-1';
  state.claimedFor = null;
  state.released = [];
  state.fail = false;
  state.credits = { charged: 0, refunded: 0 };
});

describe('free diagnosis on Trial', () => {
  it('runs free for a Trial user, claimed for their channel', async () => {
    const res = await diagnose(req());
    expect(res.status).toBe(200);
    expect((await events(res)).at(-1)).toMatchObject({ type: 'result' });
    expect(state.claimedFor).toEqual({ userId: 'user-1', channelId: CHANNEL, limit: 1 });
    expect(state.credits.charged).toBe(0);
  });

  it('refuses once the free diagnosis is used (by this user or on this channel)', async () => {
    state.claim = null;
    const res = await diagnose(req());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'plan' });
  });

  it('gives the free diagnosis back when the run fails', async () => {
    state.fail = true;
    const out = await events(await diagnose(req()));
    expect(out.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(state.released).toEqual(['claim-1']);
  });

  it('is off when the admin sets it to 0', async () => {
    state.settings = { ...state.settings, trialFreeDiagnoses: 0 };
    expect((await diagnose(req())).status).toBe(403);
    expect(state.claimedFor).toBeNull();
  });

  it('charges paid plans as usual, without touching free claims', async () => {
    state.access = { ...state.access, tier: 'STARTER', hasAccess: true };
    const res = await diagnose(req());
    await events(res);
    expect(state.credits.charged).toBe(state.settings.diagnosisCreditCost);
    expect(state.claimedFor).toBeNull();
  });
});
