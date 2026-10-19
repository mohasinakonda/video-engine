import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoProject } from './types';

// ─── In-memory projects store, scoped by user like RLS ───────────────────────
const state = {
  user: { id: 'user-a' } as { id: string } | null,
  access: { tier: 'CREATOR', isAdmin: false, hasAccess: true, hasDiscoverAccess: true, hasCreateAccess: true },
  createEnabled: true,
};
const rows = new Map<string, VideoProject & { userId: string }>();
const OTHER_USERS_PROJECT = '22222222-2222-4222-8222-222222222222';
const MY_PROJECT = '11111111-1111-4111-8111-111111111111';

vi.mock('../route-auth', async () => {
  const { NextResponse } = await import('next/server');
  return { requireUser: async () => (state.user ? { user: state.user } : { response: NextResponse.json({}, { status: 401 }) }) };
});
vi.mock('../settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../settings')>();
  return {
    ...actual,
    getChannelDoctorSettings: async () => ({ ...actual.DEFAULT_SETTINGS, create: { ...actual.DEFAULT_CREATE_SETTINGS, enabled: state.createEnabled, maxProjectsPerUser: 2 } }),
    getUserAccess: async () => state.access,
  };
});
vi.mock('./projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./projects')>();
  const { canTransition } = await import('./project-state');
  const mine = (userId: string) => Array.from(rows.values()).filter((r) => r.userId === userId);
  return {
    ...actual,
    listProjects: async (userId: string) => mine(userId),
    getProject: async (userId: string, id: string) => mine(userId).find((r) => r.id === id) ?? null,
    createProject: async (userId: string, input: { origin: 'manual' | 'opportunity'; title: string; thesis: unknown }, max: number) => {
      if (mine(userId).length >= max) throw new actual.ProjectLimitError(max);
      const id = `33333333-3333-4333-8333-${String(rows.size).padStart(12, '0')}`;
      const row = { id, userId, origin: input.origin, status: 'DRAFT', archivedFrom: null, lastError: null, title: input.title, thesis: input.thesis, brief: null, script: null, packaging: null, createdAt: '', updatedAt: '' } as VideoProject & { userId: string };
      rows.set(id, row);
      return row;
    },
    updateProject: async (_userId: string, project: VideoProject, changes: { status?: VideoProject['status']; title?: string; brief?: unknown; script?: unknown; packaging?: unknown }) => {
      if (changes.status && changes.status !== project.status && !canTransition(project.status, changes.status, project.archivedFrom)) throw new actual.TransitionError(project.status, changes.status);
      const row = rows.get(project.id)!;
      if (changes.status) {
        row.archivedFrom = changes.status === 'ARCHIVED' ? row.status : null;
        row.status = changes.status;
      }
      if (changes.title) row.title = changes.title;
      if (changes.brief !== undefined) row.brief = changes.brief;
      if (changes.script !== undefined) row.script = changes.script;
      if (changes.packaging !== undefined) row.packaging = changes.packaging;
      return row;
    },
    deleteProject: async (_u: string, id: string) => rows.delete(id),
  };
});

const ai = { result: null as unknown };
const credits = { charged: 0, refunded: 0 };
vi.mock('./ai/brief-interpreter', () => ({ interpretBrief: async () => ai.result }));
const packager = { result: null as unknown, previous: undefined as unknown };
vi.mock('./ai/packager', () => ({
  generatePackaging: async (_b: unknown, _s: unknown, o: { previous?: unknown }) => ((packager.previous = o.previous), packager.result),
}));
const writer = { script: null as unknown, calls: [] as string[] };
vi.mock('./ai/script-writer', () => ({
  writeScript: async () => (writer.calls.push('full'), writer.script),
  rewriteSection: async (_b: unknown, _s: unknown, id: string) => (writer.calls.push(id), writer.script),
}));
vi.mock('@/lib/supabase-service', () => ({
  deductCreditsRemote: async (_u: string, amount: number) => ((credits.charged += amount), true),
  grantCreditsRemote: async (_u: string, amount: number) => ((credits.refunded += amount), true),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({}) }));

import { emptyBrief } from './brief';
import { emptyScript } from './script';
import { blankThumbnail, emptyPackaging } from './packaging';
import { POST as packageRoute, PUT as savePackaging } from '@/app/api/create/projects/[id]/packaging/route';
import { POST as writeScriptRoute, PUT as saveScript } from '@/app/api/create/projects/[id]/script/route';
import { POST as draftBrief, PUT as saveBrief } from '@/app/api/create/projects/[id]/brief/route';
import { GET as list, POST as create } from '@/app/api/create/projects/route';
import { DELETE as remove, GET as read, PATCH as rename } from '@/app/api/create/projects/[id]/route';
import { POST as setStatus } from '@/app/api/create/projects/[id]/status/route';

const req = (body?: unknown) => new Request('http://localhost/api', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: { id } });
const seed = (id: string, userId: string, status: VideoProject['status'], archivedFrom: VideoProject['status'] | null = null) =>
  rows.set(id, { id, userId, origin: 'manual', status, archivedFrom, lastError: null, title: 't', thesis: null, brief: null, script: null, packaging: null, createdAt: '', updatedAt: '' });

beforeEach(() => {
  rows.clear();
  state.user = { id: 'user-a' };
  state.access = { ...state.access, hasCreateAccess: true };
  state.createEnabled = true;
  seed(MY_PROJECT, 'user-a', 'PACKAGED');
  seed(OTHER_USERS_PROJECT, 'user-b', 'PACKAGED');
});

describe('Create projects API', () => {
  it('requires a session and Create access', async () => {
    state.user = null;
    expect((await list()).status).toBe(401);
    state.user = { id: 'user-a' };
    state.access = { ...state.access, hasCreateAccess: false };
    expect((await list()).status).toBe(403);
    state.createEnabled = false;
    expect((await list()).status).toBe(503);
  });

  it('only ever shows the signed-in user’s projects', async () => {
    const data = await (await list()).json();
    expect(data.projects.map((p: VideoProject) => p.id)).toEqual([MY_PROJECT]);
    expect((await read(req(), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
    expect((await rename(req({ title: 'x' }), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
    expect((await remove(req(), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
    expect((await setStatus(req({ action: 'archive' }), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
    expect(rows.get(OTHER_USERS_PROJECT)?.status).toBe('PACKAGED');
    expect((await read(req(), ctx('not-a-uuid'))).status).toBe(404);
  });

  it('creates a manual project and enforces the project limit', async () => {
    rows.delete(OTHER_USERS_PROJECT);
    const res = await create(req({ origin: 'manual', title: 'My idea' }));
    expect(res.status).toBe(201);
    expect((await res.json()).project).toMatchObject({ origin: 'manual', status: 'DRAFT', title: 'My idea' });
    const full = await create(req({ origin: 'manual', title: 'One too many' }));
    expect(full.status).toBe(409);
    expect((await full.json()).code).toBe('limit');
    expect((await create(req({ origin: 'manual', title: '' }))).status).toBe(400);
  });

  it('applies only valid status actions', async () => {
    const start = await setStatus(req({ action: 'start_production' }), ctx(MY_PROJECT));
    expect((await start.json()).project.status).toBe('IN_PRODUCTION');
    expect((await setStatus(req({ action: 'back_to_packaging' }), ctx(MY_PROJECT))).status).toBe(200);

    seed(MY_PROJECT, 'user-a', 'DRAFT');
    const invalid = await setStatus(req({ action: 'start_production' }), ctx(MY_PROJECT));
    expect(invalid.status).toBe(409);
    expect((await invalid.json()).code).toBe('transition');

    seed(MY_PROJECT, 'user-a', 'PUBLISHED');
    expect((await setStatus(req({ action: 'back_to_packaging' }), ctx(MY_PROJECT))).status).toBe(409);
  });

  it('archives and restores to the previous status', async () => {
    await setStatus(req({ action: 'archive' }), ctx(MY_PROJECT));
    expect(rows.get(MY_PROJECT)).toMatchObject({ status: 'ARCHIVED', archivedFrom: 'PACKAGED' });
    const restored = await setStatus(req({ action: 'unarchive' }), ctx(MY_PROJECT));
    expect((await restored.json()).project.status).toBe('PACKAGED');
  });
});

/** Reads an NDJSON stream into its events. */
async function events(res: Response) {
  return (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('brief API', () => {
  const put = (body: unknown) => new Request('http://localhost/api', { method: 'PUT', body: JSON.stringify(body) });

  it('saves a valid brief and marks the brief step done', async () => {
    seed(MY_PROJECT, 'user-a', 'DRAFT');
    const res = await saveBrief(put(emptyBrief('Deep sea', 'English')), ctx(MY_PROJECT));
    expect(res.status).toBe(200);
    expect(rows.get(MY_PROJECT)).toMatchObject({ status: 'BRIEF_READY' });
  });

  it('rejects invalid briefs, other users’ projects and published projects', async () => {
    seed(MY_PROJECT, 'user-a', 'DRAFT');
    expect((await saveBrief(put({ ...emptyBrief('x', 'English'), topic: '' }), ctx(MY_PROJECT))).status).toBe(400);
    expect((await saveBrief(put(emptyBrief('x', 'English')), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
    seed(MY_PROJECT, 'user-a', 'PUBLISHED');
    expect((await saveBrief(put(emptyBrief('x', 'English')), ctx(MY_PROJECT))).status).toBe(409);
  });

  it('charges for an AI draft, saves it, and refunds when the AI gives nothing usable', async () => {
    seed(MY_PROJECT, 'user-a', 'DRAFT');
    credits.charged = 0;
    credits.refunded = 0;
    ai.result = emptyBrief('Deep sea', 'English');
    const ok = await events(await draftBrief(req({}), ctx(MY_PROJECT)));
    expect(ok.at(-1).type).toBe('result');
    expect(rows.get(MY_PROJECT)?.status).toBe('BRIEF_READY');
    expect(credits.charged).toBe(2);

    seed(MY_PROJECT, 'user-a', 'DRAFT');
    ai.result = null;
    const failed = await events(await draftBrief(req({}), ctx(MY_PROJECT)));
    expect(failed.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(credits.refunded).toBe(2);
    expect(rows.get(MY_PROJECT)?.status).toBe('DRAFT');
  });
});

describe('script API', () => {
  const ready = { ...emptyBrief('Deep sea', 'English'), corePromise: 'Meet the animals', audience: 'Curious adults', keyPoints: ['Pressure'], updatedAt: '2026-10-20T10:00:00.000Z' };
  const put = (body: unknown) => new Request('http://localhost/api', { method: 'PUT', body: JSON.stringify(body) });
  const withBrief = (status: VideoProject['status'], brief: unknown = ready, script: unknown = null) => {
    seed(MY_PROJECT, 'user-a', status);
    Object.assign(rows.get(MY_PROJECT)!, { brief, script });
  };

  beforeEach(() => {
    credits.charged = 0;
    credits.refunded = 0;
    writer.calls = [];
  });

  it('refuses before charging when the brief is missing or incomplete', async () => {
    withBrief('DRAFT', null);
    expect((await writeScriptRoute(req({}), ctx(MY_PROJECT))).status).toBe(409);
    withBrief('BRIEF_READY', { ...ready, corePromise: '' });
    const res = await writeScriptRoute(req({}), ctx(MY_PROJECT));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('brief_incomplete');
    expect(credits.charged).toBe(0);
    expect((await writeScriptRoute(req({}), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
  });

  it('writes a full script, saves it and refunds when nothing usable comes back', async () => {
    withBrief('BRIEF_READY');
    writer.script = emptyScript(ready, 8);
    const ok = await events(await writeScriptRoute(req({ targetMinutes: 8 }), ctx(MY_PROJECT)));
    expect(ok.at(-1).type).toBe('result');
    expect(rows.get(MY_PROJECT)?.status).toBe('SCRIPT_READY');
    expect(credits.charged).toBe(5);

    withBrief('BRIEF_READY');
    writer.script = null;
    const failed = await events(await writeScriptRoute(req({}), ctx(MY_PROJECT)));
    expect(failed.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(rows.get(MY_PROJECT)?.status).toBe('BRIEF_READY');
  });

  it('rewrites one part at half price, only for an existing part', async () => {
    const script = emptyScript(ready, 8);
    withBrief('SCRIPT_READY', ready, script);
    expect((await writeScriptRoute(req({ sectionId: 'nope' }), ctx(MY_PROJECT))).status).toBe(409);
    writer.script = script;
    const ok = await events(await writeScriptRoute(req({ sectionId: script.sections[0].id }), ctx(MY_PROJECT)));
    expect(ok.at(-1).type).toBe('result');
    expect(writer.calls).toEqual([script.sections[0].id]);
    expect(credits.charged).toBe(3);
  });

  it('saves edits free, marks them reviewed against the current brief, and refuses invalid or locked ones', async () => {
    const old = { ...emptyScript(ready, 8), briefUpdatedAt: '2026-01-01T00:00:00.000Z' };
    withBrief('BRIEF_READY', ready, old);
    const res = await saveScript(put(old), ctx(MY_PROJECT));
    expect(res.status).toBe(200);
    expect(rows.get(MY_PROJECT)).toMatchObject({ status: 'SCRIPT_READY', script: { briefUpdatedAt: ready.updatedAt } });
    expect(credits.charged).toBe(0);

    expect((await saveScript(put({ ...old, sections: [] }), ctx(MY_PROJECT))).status).toBe(400);
    withBrief('PUBLISHED', ready, old);
    expect((await saveScript(put(old), ctx(MY_PROJECT))).status).toBe(409);
    withBrief('DRAFT', null);
    expect((await saveScript(put(old), ctx(MY_PROJECT))).status).toBe(409);
  });
});

describe('packaging API', () => {
  const ready = { ...emptyBrief('Deep sea', 'English'), corePromise: 'Meet the animals', audience: 'Curious adults', keyPoints: ['Pressure'] };
  const script = { ...emptyScript(ready, 8), updatedAt: '2026-10-20T12:00:00.000Z' };
  const put = (body: unknown) => new Request('http://localhost/api', { method: 'PUT', body: JSON.stringify(body) });
  const pack = (chosen: boolean) => ({
    ...emptyPackaging('English', '2026-01-01T00:00:00.000Z'),
    titles: [{ title: 'Why do deep sea animals glow?', mechanism: 'why', audience: '', risk: 'low', rationale: '', source: 'ai' }],
    thumbnails: [{ ...blankThumbnail(), mainSubject: 'An anglerfish' }],
    selectedTitle: chosen ? 0 : null,
    selectedThumbnail: chosen ? 0 : null,
  });
  const at = (status: VideoProject['status'], withScript = true, packaging: unknown = null) => {
    seed(MY_PROJECT, 'user-a', status);
    Object.assign(rows.get(MY_PROJECT)!, { brief: ready, script: withScript ? script : null, packaging });
  };

  beforeEach(() => {
    credits.charged = 0;
    credits.refunded = 0;
  });

  it('refuses before charging until the script is saved, and after publishing', async () => {
    at('BRIEF_READY');
    expect((await packageRoute(req({}), ctx(MY_PROJECT))).status).toBe(409);
    at('SCRIPT_READY', false);
    expect((await packageRoute(req({}), ctx(MY_PROJECT))).status).toBe(409);
    at('PUBLISHED');
    expect((await packageRoute(req({}), ctx(MY_PROJECT))).status).toBe(409);
    expect((await packageRoute(req({}), ctx(OTHER_USERS_PROJECT))).status).toBe(404);
    expect(credits.charged).toBe(0);
  });

  it('generates ideas without finishing the step, passes the previous choice, and refunds on failure', async () => {
    const previous = pack(true);
    at('SCRIPT_READY', true, previous);
    packager.result = pack(false);
    const ok = await events(await packageRoute(req({}), ctx(MY_PROJECT)));
    expect(ok.at(-1).type).toBe('result');
    expect(rows.get(MY_PROJECT)?.status).toBe('SCRIPT_READY');
    expect(packager.previous).toEqual(previous);
    expect(credits.charged).toBe(5);

    packager.result = null;
    const failed = await events(await packageRoute(req({}), ctx(MY_PROJECT)));
    expect(failed.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(credits.refunded).toBe(5);
  });

  it('marks PACKAGED when a title and thumbnail are chosen, and un-finishes when the choice is cleared', async () => {
    at('SCRIPT_READY');
    expect((await savePackaging(put(pack(false)), ctx(MY_PROJECT))).status).toBe(200);
    expect(rows.get(MY_PROJECT)?.status).toBe('SCRIPT_READY');
    expect((await savePackaging(put(pack(true)), ctx(MY_PROJECT))).status).toBe(200);
    expect(rows.get(MY_PROJECT)).toMatchObject({ status: 'PACKAGED', packaging: { scriptUpdatedAt: script.updatedAt } });
    expect((await savePackaging(put(pack(false)), ctx(MY_PROJECT))).status).toBe(200);
    expect(rows.get(MY_PROJECT)?.status).toBe('SCRIPT_READY');
    expect(credits.charged).toBe(0);
  });

  it('rejects invalid packaging and locked projects', async () => {
    at('SCRIPT_READY');
    expect((await savePackaging(put({ ...pack(true), selectedTitle: 4 }), ctx(MY_PROJECT))).status).toBe(400);
    at('BRIEF_READY');
    expect((await savePackaging(put(pack(true)), ctx(MY_PROJECT))).status).toBe(409);
    at('PUBLISHED');
    expect((await savePackaging(put(pack(true)), ctx(MY_PROJECT))).status).toBe(409);
  });
});
