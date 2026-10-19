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
    updateProject: async (_userId: string, project: VideoProject, changes: { status?: VideoProject['status']; title?: string }) => {
      if (changes.status && !canTransition(project.status, changes.status, project.archivedFrom)) throw new actual.TransitionError(project.status, changes.status);
      const row = rows.get(project.id)!;
      if (changes.status) {
        row.archivedFrom = changes.status === 'ARCHIVED' ? row.status : null;
        row.status = changes.status;
      }
      if (changes.title) row.title = changes.title;
      return row;
    },
    deleteProject: async (_u: string, id: string) => rows.delete(id),
  };
});

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
