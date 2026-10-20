import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ChannelDoctorSettings } from '../settings';
import type { MarketVideo } from '../discover/types';
import type { AuditVideo } from './fetch';
import { resolveTarget } from './resolve';
import { auditVideo, chaptersOf, hasValidChapters, hashtagsIn, visibleDescription } from './video-audit';

const NOW = new Date('2026-10-20T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const CHANNEL = 'UC' + 'c'.repeat(22);

const peer = (i: number, over: Partial<MarketVideo> = {}): MarketVideo => ({
  id: `peer${String(i).padStart(7, '0')}`,
  channelId: CHANNEL,
  title: `How to fix thing ${i}`,
  publishedAt: daysAgo(20 + i * 5),
  durationSec: 600,
  views: 1000,
  likes: 40,
  comments: 5,
  thumbnailUrl: null,
  ...over,
});

const video = (over: Partial<AuditVideo> = {}): AuditVideo => ({
  id: 'targetVid01',
  channelId: CHANNEL,
  channelTitle: 'Theirs',
  title: 'How I fixed my old laptop',
  description: 'I bring a 2015 laptop back to life.\n\n0:00 Intro\n1:20 Opening it\n5:00 Result',
  tags: [],
  publishedAt: daysAgo(30),
  durationSec: 600,
  thumbnailUrl: null,
  views: 1000,
  likes: 40,
  comments: 5,
  liveOrUpcoming: false,
  ...over,
});

const channel = (n = 12, over: Partial<MarketVideo> = {}) => Array.from({ length: n }, (_, i) => peer(i, over));

describe('resolveTarget', () => {
  it('reads videos, channel ids and handles', () => {
    expect(resolveTarget('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'video', videoId: 'dQw4w9WgXcQ' });
    expect(resolveTarget(`https://www.youtube.com/channel/${CHANNEL}/videos`)).toEqual({ kind: 'channel', channelId: CHANNEL });
    expect(resolveTarget('youtube.com/@TerraLore')).toEqual({ kind: 'handle', handle: '@TerraLore' });
    expect(resolveTarget('@বাংলা_চ্যানেল')).toEqual({ kind: 'handle', handle: '@বাংলা_চ্যানেল' });
    expect(resolveTarget('https://evil.com/@x')).toBeNull();
    expect(resolveTarget('hello')).toBeNull();
  });
});

describe('metadata helpers', () => {
  it('finds chapters, hashtags and the visible description', () => {
    expect(chaptersOf('0:00 Intro\n1:20 - Opening\n(12:05) End\nnot a chapter')).toHaveLength(3);
    expect(hasValidChapters('0:00 Intro\n1:20 Opening\n5:00 Result')).toBe(true);
    expect(hasValidChapters('1:00 Intro\n1:20 Opening\n5:00 Result')).toBe(false);
    expect(hashtagsIn('Great #tech video #বাংলা and a#notone')).toBe(2);
    expect(visibleDescription('Line one\nLine two\nLine three')).toBe('Line one Line two');
  });
});

describe('auditVideo', () => {
  const kinds = (r: ReturnType<typeof auditVideo>, area: string) => r.findings.filter((f) => f.area === area).map((f) => `${f.kind}:${f.statement}`);

  it('compares views with the channel’s own usual, excluding the video itself', () => {
    const r = auditVideo(video({ views: 5000 }), [...channel(), { ...peer(99), id: 'targetVid01', views: 5000 }], NOW);
    expect(r.performance).toMatchObject({ label: 'standout', ratio: 5, baselineViews: 1000, baselineSample: 12 });
    expect(r.findings[0].kind).not.toBe('note');
  });

  it('labels weak videos and says when it can’t compare', () => {
    expect(auditVideo(video({ views: 300 }), channel(), NOW).performance.label).toBe('well_below');
    expect(auditVideo(video({ views: 700 }), channel(), NOW).performance.label).toBe('below');
    const young = auditVideo(video({ publishedAt: daysAgo(3) }), channel(), NOW);
    expect(young.performance.label).toBe('not_comparable');
    expect(young.limitations[0]).toContain('less than a week old');
    const small = auditVideo(video(), channel(3), NOW);
    expect(small.limitations[0]).toContain('too few');
    expect(auditVideo(video({ views: null }), channel(), NOW).limitations[0]).toContain('hides its view count');
  });

  it('compares likes and comments only with enough views', () => {
    const liked = auditVideo(video({ views: 1000, likes: 100, comments: 20 }), channel(), NOW);
    expect(kinds(liked, 'performance').some((k) => k.startsWith('strength:Viewers liked'))).toBe(true);
    expect(kinds(liked, 'viewers').some((k) => k.startsWith('strength:'))).toBe(true);
    const few = auditVideo(video({ views: 200, likes: 100 }), channel(), NOW);
    expect(kinds(few, 'performance').some((k) => k.includes('liked'))).toBe(false);
  });

  it('flags long, shouty or hype titles and reads the channel’s standout pattern', () => {
    const r = auditVideo(video({ title: 'THIS LAPTOP TRICK is the secret nobody tells you about old computers and batteries' }), channel(), NOW);
    const t = kinds(r, 'title').join('\n');
    expect(t).toContain('cut off');
    expect(t).toContain('all-caps');

    // 3 standout "why" videos on the channel; a weak "how" title is told so.
    const standouts = [0, 1, 2].map((i) => peer(50 + i, { title: `Why thing ${i} breaks`, views: 9000 }));
    const weak = auditVideo(video({ views: 300 }), [...channel(), ...standouts], NOW);
    expect(kinds(weak, 'title').join('\n')).toContain('weakness:Most of the channel’s standouts use');
  });

  it('checks the description, chapters and hashtags', () => {
    expect(kinds(auditVideo(video({ description: '' }), channel(), NOW), 'metadata')[0]).toContain('no description');
    expect(kinds(auditVideo(video({ description: 'https://shop.example\nmore' }), channel(), NOW), 'metadata')[0]).toContain('link or hashtags');
    expect(kinds(auditVideo(video(), channel(), NOW), 'metadata')).toContain('strength:It has chapters, which help viewers jump to what they want and show up in search.');
    const tags = Array.from({ length: 61 }, (_, i) => `#t${i}`).join(' ');
    expect(kinds(auditVideo(video({ description: `About it. ${tags}` }), channel(), NOW), 'metadata').join()).toContain('ignores all of them');
  });

  it('notes a length far from the channel’s usual', () => {
    expect(kinds(auditVideo(video({ durationSec: 1800 }), channel(), NOW), 'format')[0]).toContain('Much longer');
  });
});

// ─── Route ───────────────────────────────────────────────────────────────────
const state = {
  settings: { ...DEFAULT_SETTINGS, discover: { ...DEFAULT_SETTINGS.discover, enabled: true }, audit: { ...DEFAULT_SETTINGS.audit, enabled: true } } as ChannelDoctorSettings,
  access: { tier: 'CREATOR', isAdmin: false, hasAccess: true, hasDiscoverAccess: true, hasCreateAccess: false, hasAuditAccess: true },
  video: null as AuditVideo | null,
  underCap: true,
  credits: { charged: 0, refunded: 0 },
};

vi.mock('../route-auth', () => ({ requireUser: async () => ({ user: { id: 'user-1' } }) }));
vi.mock('../settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../settings')>()),
  getChannelDoctorSettings: async () => state.settings,
  getUserAccess: async () => state.access,
}));
vi.mock('../connection-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../connection-service')>()),
  getValidAccessToken: async () => ({ accessToken: 't', reportingJobId: null, connection: { channelId: 'UC' + 'm'.repeat(22), title: 'Mine' } }),
}));
vi.mock('@/lib/supabase-service', () => ({
  deductCreditsRemote: async (_u: string, n: number) => ((state.credits.charged += n), true),
  grantCreditsRemote: async (_u: string, n: number) => ((state.credits.refunded += n), true),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({}) }));
vi.mock('../quota-budget', async (importOriginal) => ({ ...(await importOriginal<typeof import('../quota-budget')>()), consumeQuota: async () => state.underCap }));
vi.mock('../run-guard', () => ({ acquireRun: () => ({ ok: true, release: () => undefined }) }));
vi.mock('./fetch', () => ({
  fetchAuditVideo: async () => state.video,
  fetchChannelVideos: async () => channel(),
  fetchCommentTexts: async () => ({ texts: [], available: false, disabled: false }),
}));

import { POST as auditRoute } from '@/app/api/youtube/audit/video/route';

const post = (link: string) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ link }) });
const events = async (res: Response) => (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe('video audit route', () => {
  beforeEach(() => {
    state.access = { ...state.access, hasAuditAccess: true };
    state.video = video({ views: 5000 });
    state.underCap = true;
    state.credits = { charged: 0, refunded: 0 };
  });

  it('refuses bad links and channel links before charging', async () => {
    expect((await auditRoute(post('hello'))).status).toBe(400);
    expect((await (await auditRoute(post('https://youtube.com/@someone'))).json()).code).toBe('not_video');
    expect(state.credits.charged).toBe(0);
  });

  it('is gated by plan and switch, and by the daily cap', async () => {
    state.access = { ...state.access, hasAuditAccess: false };
    // Switched on, but not in this plan.
    expect((await auditRoute(post('https://youtu.be/dQw4w9WgXcQ'))).status).toBe(403);
    // Switched off for users.
    state.settings = { ...state.settings, audit: { ...state.settings.audit, enabled: false } };
    expect((await auditRoute(post('https://youtu.be/dQw4w9WgXcQ'))).status).toBe(503);
    state.settings = { ...state.settings, audit: { ...state.settings.audit, enabled: true } };
    state.access = { ...state.access, hasAuditAccess: true };
    state.underCap = false;
    expect((await auditRoute(post('https://youtu.be/dQw4w9WgXcQ'))).status).toBe(429);
    expect(state.credits.charged).toBe(0);
  });

  it('audits a public video and refunds when YouTube doesn’t return it', async () => {
    const ok = await events(await auditRoute(post('https://youtu.be/dQw4w9WgXcQ')));
    const result = ok.at(-1);
    expect(result.type).toBe('result');
    expect(result.data).toMatchObject({ isOwn: false, performance: { label: 'standout' }, video: { id: 'targetVid01' } });
    expect(state.credits.charged).toBe(5);

    state.video = null;
    const failed = await events(await auditRoute(post('https://youtu.be/dQw4w9WgXcQ')));
    expect(failed.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(state.credits.refunded).toBe(5);
  });
});
