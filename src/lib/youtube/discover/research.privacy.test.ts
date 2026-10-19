import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import type { ChannelIdentity } from '../data-client';
import type { VideoMeta } from '../types';

const dbCalls = vi.fn();
vi.mock('../db', () => ({
  getServiceClient: () => {
    dbCalls();
    throw new Error('research must not touch the database');
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => {
    dbCalls();
    throw new Error('research must not touch the database');
  },
}));

// Synthetic test channels (clearly fake ids), never real data.
const NOW = new Date('2026-10-19T00:00:00Z');
const channel = (n: number): ChannelIdentity => ({
  id: 'UC' + String(n).repeat(22),
  title: `Test Channel ${n}`,
  thumbnail: null,
  customUrl: null,
  url: '',
  subscriberCount: 1000,
  videoCount: 30,
  uploadsPlaylistId: `UU${n}`,
});
const SECRET_TITLE = 'SECRET-TITLE-MARKER';
const videosFor = (n: number): VideoMeta[] =>
  Array.from({ length: 20 }, (_, i) => ({
    id: `v${n}_${i}`,
    title: i === 3 ? `${SECRET_TITLE} deep sea fish` : `Deep sea creature ${i} explained`,
    publishedAt: new Date(NOW.getTime() - (8 + i * 4) * 86_400_000).toISOString(),
    durationSec: 600,
    thumbnailUrl: null,
    format: null,
    lifetimeViews: i === 3 ? 50_000 : 1000 + i * 10,
    likes: null,
    comments: null,
    channelId: 'UC' + String(n).repeat(22),
  }));

vi.mock('../data-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-client')>()),
  fetchMyChannels: async () => [channel(1)],
  fetchChannelsById: async (_t: string, ids: string[]) => [channel(2), channel(3)].filter((c) => ids.includes(c.id)),
  fetchUploadIds: async (_t: string, playlist: string) => [playlist],
  fetchVideoDetails: async (_t: string, ids: string[]) => videosFor(Number(ids[0].slice(2))),
}));
vi.mock('../fetcher', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../fetcher')>()),
  fetchChannelDataset: async () => {
    throw new Error('analytics unavailable in test');
  },
}));
vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: async () => null,
  // Every title gets the same vector, so they form topics deterministically.
  embed: async ({ texts, models }: { texts: string[]; models: string[] }) => ({ vectors: texts.map(() => [1, 0, 0]), model: models[0] }),
}));

import { runResearch } from './research';

describe('research privacy', () => {
  it('runs without the database and keeps titles and tokens out of logs', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const result = await runResearch({
      userId: 'user-1',
      accessToken: 'ya29.secret-access-token',
      connection: { channelId: channel(1).id, title: 'Test', thumbnail: null, url: '', status: 'active', reportingStartedAt: null },
      reportingJobId: null,
      settings: DEFAULT_SETTINGS,
      window: '90d',
      competitorIds: [channel(2).id, channel(3).id],
      onStage: () => {},
      now: NOW,
    });

    expect(dbCalls).not.toHaveBeenCalled();
    const logged = spies.flatMap((s) => s.mock.calls.flat().map(String)).join(' ');
    expect(logged).not.toContain(SECRET_TITLE);
    expect(logged).not.toContain('secret-access-token');
    expect(JSON.stringify(result)).not.toContain('secret-access-token');

    // The run still produced research: outliers found, Channel Doctor missing is stated.
    expect(result.outliers.length).toBeGreaterThan(0);
    expect(result.phase1.available).toBe(false);
    expect(result.limitations.join(' ')).toMatch(/Channel Doctor data/);
    spies.forEach((s) => s.mockRestore());
  });
});
