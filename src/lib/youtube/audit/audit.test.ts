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
  madeForKids: false,
  wasStreamed: false,
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

    // 4 standout "why" videos on the channel; a weak "how" title is told so.
    const standouts = [0, 1, 2, 3].map((i) => peer(50 + i, { title: `Why thing ${i} breaks`, views: 9000 }));
    const weak = auditVideo(video({ views: 300 }), [...channel(), ...standouts], NOW);
    expect(kinds(weak, 'pattern').join('\n')).toContain('weakness:Skips what works on this channel: “Why…” in the title');
    // Polish like title length ranks below what explains the result.
    expect(r.findings.find((f) => f.statement.includes('cut off'))?.impact).toBe('low');
  });

  it('reads what wins on the channel, made for kids, LIVE labels, description links and tags', () => {
    const live = [0, 1, 2, 3].map((i) => peer(60 + i, { title: `🔴LIVE | ABC song ${i}`, views: 30000, durationSec: 1600, tags: ['abc song', 'kids songs'] } as Partial<MarketVideo>));
    const r = auditVideo(
      video({ title: '🔴LIVE | ABC Alphabet Song', durationSec: 1600, views: 40000, madeForKids: true, description: 'Lyrics:\nA B C\nhttps://www.youtube.com/playlist?list=PL1', tags: ['abc song'] }),
      [...channel(), ...live],
      NOW
    );
    expect(r.patterns?.patterns[0]).toMatchObject({ thisHas: true, withCount: 4, withoutCount: 12 });
    expect(r.patterns?.chart.some((p) => p.isThis)).toBe(true);
    const all = r.findings.map((f) => `${f.area}:${f.kind}:${f.statement}`).join('\n');
    expect(all).toContain('pattern:strength:Follows what works on this channel: “LIVE” or 🔴 in the title, title split with | or [ ], a compilation, 15–40 minutes');
    expect(all).toContain('audience:note:Set as made for kids');
    expect(all).toContain('title:note:The title says LIVE, but it was uploaded as a regular video');
    expect(all).toContain('metadata:strength:The description links 1 playlist');
    expect(r.description).toMatchObject({ lyrics: true, playlists: 1 });
    expect(r.tags).toMatchObject({ shared: ['abc song'], missing: ['kids songs'] });
    // A real stream may say LIVE.
    expect(auditVideo(video({ title: 'LIVE Q&A', wasStreamed: true }), channel(), NOW).findings.some((f) => f.statement.includes('says LIVE'))).toBe(false);
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
  fetchAuditVideo: async (_t: string, id: string) => (state.video ? { ...state.video, id, channelId: id === 'mineVideo01' ? 'UC' + 'm'.repeat(22) : state.video.channelId } : null),
  fetchChannelVideos: async () => channel(),
  fetchCommentTexts: async () => ({ texts: [], available: false, disabled: false }),
}));

vi.mock('../analysis/thumbnails', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../analysis/thumbnails')>()),
  describeThumbnail: async () => null,
}));
vi.mock('./ai/comments', async (importOriginal) => ({ ...(await importOriginal<typeof import('./ai/comments')>()), viewerThemes: async () => ({ read: 0, themes: [] }) }));
vi.mock('./ai/lessons', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai/lessons')>()),
  writeLessons: async () => ({ verdict: 'A standout.', lessons: [], aiUsed: false }),
}));

const channelState = { found: true };
vi.mock('../data-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data-client')>()),
  fetchChannelsById: async (_t: string, ids: string[]) =>
    channelState.found ? ids.map((id) => ({ id, title: 'Theirs', thumbnail: null, customUrl: null, url: '', subscriberCount: 10, videoCount: 12, uploadsPlaylistId: null })) : [],
  fetchChannelByHandle: async () => null,
}));

import { POST as auditRoute } from '@/app/api/youtube/audit/video/route';
import { POST as channelRoute } from '@/app/api/youtube/audit/channel/route';
import { POST as compareRoute } from '@/app/api/youtube/audit/compare/route';

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
    expect(result.data).toMatchObject({ isOwn: false, performance: { label: 'standout' }, video: { id: 'dQw4w9WgXcQ' }, verdict: 'A standout.' });
    expect(result.data.limitations.join(' ')).toContain('comment reading isn’t set up');
    expect(state.credits.charged).toBe(5);

    state.video = null;
    const failed = await events(await auditRoute(post('https://youtu.be/dQw4w9WgXcQ')));
    expect(failed.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(state.credits.refunded).toBe(5);
  });
});

describe('channel audit route', () => {
  const postChannel = (channel: string) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ channel }) });

  beforeEach(() => {
    state.access = { ...state.access, hasAuditAccess: true };
    state.underCap = true;
    state.credits = { charged: 0, refunded: 0 };
    channelState.found = true;
  });

  it('refuses video links and junk before charging', async () => {
    expect((await channelRoute(postChannel('https://youtu.be/dQw4w9WgXcQ'))).status).toBe(400);
    expect((await channelRoute(postChannel('hello'))).status).toBe(400);
    expect(state.credits.charged).toBe(0);
  });

  it('audits a channel at the channel price, and refunds an unknown one', async () => {
    const ok = await events(await channelRoute(postChannel(`https://youtube.com/channel/${CHANNEL}`)));
    const result = ok.at(-1);
    expect(result.type).toBe('result');
    expect(result.data).toMatchObject({ isOwn: false, channel: { id: CHANNEL }, stats: { videosRead: 12 }, verdict: 'A standout.' });
    expect(state.credits.charged).toBe(10);

    channelState.found = false;
    const failed = await events(await channelRoute(postChannel(`https://youtube.com/channel/${CHANNEL}`)));
    expect(failed.at(-1)).toMatchObject({ type: 'error', refunded: true });
  });
});

describe('compare route', () => {
  const postCompare = (yours: string, theirs: string) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ yours, theirs }) });

  beforeEach(() => {
    state.access = { ...state.access, hasAuditAccess: true };
    state.video = video({ views: 5000 });
    state.underCap = true;
    state.credits = { charged: 0, refunded: 0 };
  });

  it('needs two different video links', async () => {
    expect((await compareRoute(postCompare('https://youtu.be/mineVideo01', 'https://youtube.com/@x'))).status).toBe(400);
    expect((await (await compareRoute(postCompare('https://youtu.be/mineVideo01', 'mineVideo01'))).json()).code).toBe('same_video');
    expect(state.credits.charged).toBe(0);
  });

  it('compares your video with theirs at twice the video price', async () => {
    const out = await events(await compareRoute(postCompare('https://youtu.be/mineVideo01', 'https://youtu.be/otherVideo1')));
    const result = out.at(-1);
    expect(result.type).toBe('result');
    expect(result.data.yours.isOwn).toBe(true);
    expect(result.data.rows.length).toBeGreaterThan(5);
    expect(state.credits.charged).toBe(10);
  });

  it('refunds when the first video isn’t yours', async () => {
    const out = await events(await compareRoute(postCompare('https://youtu.be/otherVideo2', 'https://youtu.be/otherVideo1')));
    expect(out.at(-1)).toMatchObject({ type: 'error', refunded: true });
    expect(out.at(-1).error).toContain('needs to be one of yours');
  });
});
