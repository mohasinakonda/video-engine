import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptToken, encryptToken } from './crypto';
import { buildAuthUrl, hasRequiredScopes, statesMatch } from './oauth';
import { aggregateReach, parseCsv } from './reporting-client';
import { DEFAULT_DISCOVER_SETTINGS, settingsUpdateSchema } from './settings';
import { isAllowedThumbnailUrl } from './analysis/thumbnails';
import { safeReturnPath } from './config';
import { toPublicConnection } from './connection-service';

beforeEach(() => {
  process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id.apps.googleusercontent.com';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/youtube/oauth/callback';
});

describe('token encryption', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptToken('ya29.token');
    expect(decryptToken(a)).toBe('ya29.token');
    expect(encryptToken('ya29.token')).not.toBe(a);
    expect(a).not.toContain('ya29');
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptToken('ya29.token');
    expect(() => decryptToken(enc.slice(0, -4) + 'AAAA')).toThrow();
  });

  it('refuses to run without a valid key', () => {
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = 'short';
    expect(() => encryptToken('x')).toThrow(/32 bytes/);
  });
});

describe('OAuth', () => {
  it('compares state safely', () => {
    expect(statesMatch('abc', 'abc')).toBe(true);
    expect(statesMatch('abc', 'abd')).toBe(false);
    expect(statesMatch(undefined, 'abc')).toBe(false);
  });

  it('requires both scopes', () => {
    const data = 'https://www.googleapis.com/auth/youtube.readonly';
    const analytics = 'https://www.googleapis.com/auth/yt-analytics.readonly';
    expect(hasRequiredScopes(`${data} ${analytics}`)).toBe(true);
    expect(hasRequiredScopes(data)).toBe(false);
  });

  it('builds an offline, PKCE consent URL with only read scopes', () => {
    const url = new URL(buildAuthUrl('state123', 'challenge456'));
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('state123');
    expect(url.searchParams.get('scope')?.split(' ').every((s) => s.endsWith('.readonly'))).toBe(true);
  });

  it('only allows same-site return paths', () => {
    expect(safeReturnPath('/youtube-doctor')).toBe('/youtube-doctor');
    expect(safeReturnPath('//evil.com')).toBe('/youtube-doctor');
    expect(safeReturnPath('https://evil.com')).toBe('/youtube-doctor');
  });
});

describe('connection responses', () => {
  it('never include tokens', () => {
    const row = {
      user_id: 'u',
      channel_id: 'UC1',
      channel_title: 'Ch',
      channel_thumbnail: null,
      access_token_enc: 'v1:secret',
      refresh_token_enc: 'v1:secret2',
      token_expires_at: null,
      scopes: [],
      status: 'active' as const,
      reporting_job_id: 'job',
      reporting_job_created_at: null,
      updated_at: '',
    };
    const json = JSON.stringify(toPublicConnection(row));
    expect(json).not.toContain('secret');
    expect(json).not.toContain('token');
  });
});

describe('reach report', () => {
  it('parses CSV and computes CTR as total clicks / total impressions', () => {
    const rows = parseCsv(
      'date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr\n' +
        '20261001,UC1,a,1000,0.10\n' +
        '20261002,UC1,a,3000,0.02\n' +
        '20261001,UC1,b,0,0\n'
    );
    const result = aggregateReach(rows);
    expect(result.byVideo.a.impressions).toBe(4000);
    expect(result.byVideo.a.ctr).toBeCloseTo((100 + 60) / 4000); // not the average of 10% and 2%
    expect(result.byVideo.b).toBeUndefined();
  });

  it('accepts CTR given as a percentage', () => {
    const result = aggregateReach([{ video_id: 'a', video_thumbnail_impressions: '1000', video_thumbnail_impressions_ctr: '5' }]);
    expect(result.ctr).toBeCloseTo(0.05);
  });
});

describe('admin settings validation', () => {
  const valid = {
    enabled: true,
    allowedPlans: ['STARTER'],
    diagnosisCreditCost: 10,
    videoAnalysisCreditCost: 3,
    textModels: ['deepseek-ai/DeepSeek-V4-Flash-0731'],
    visionModels: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
    maxVideos: 100,
    maxRetentionVideos: 8,
    maxThumbnails: 12,
    hourlyLimitPerUser: 10,
    discover: DEFAULT_DISCOVER_SETTINGS,
  };
  it('accepts valid settings', () => expect(settingsUpdateSchema.safeParse(valid).success).toBe(true));
  it('rejects unknown plans, bad model ids and negative costs', () => {
    expect(settingsUpdateSchema.safeParse({ ...valid, allowedPlans: ['GOLD'] }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, textModels: ['not a model'] }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, diagnosisCreditCost: -1 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, visionModels: [] }).success).toBe(false);
  });
  it('requires Discover score weights that add up to 100', () => {
    const weights = { ...DEFAULT_DISCOVER_SETTINGS.weights, phase1: 6 };
    expect(settingsUpdateSchema.safeParse({ ...valid, discover: { ...DEFAULT_DISCOVER_SETTINGS, weights } }).success).toBe(false);
  });
  it('caps Discover limits and rejects bad embedding ids', () => {
    const d = DEFAULT_DISCOVER_SETTINGS;
    expect(settingsUpdateSchema.safeParse({ ...valid, discover: { ...d, maxCompetitors: 0 } }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, discover: { ...d, searchCallsPerDiscovery: 9 } }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, discover: { ...d, embeddingModels: ['bge'] } }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, discover: { ...d, researchCreditCost: -1 } }).success).toBe(false);
  });
});

describe('thumbnail URLs', () => {
  it('only sends YouTube image URLs to the model', () => {
    expect(isAllowedThumbnailUrl('https://i.ytimg.com/vi/x/hqdefault.jpg')).toBe(true);
    expect(isAllowedThumbnailUrl('http://i.ytimg.com/vi/x/hqdefault.jpg')).toBe(false);
    expect(isAllowedThumbnailUrl('https://evil.com/x.jpg')).toBe(false);
    expect(isAllowedThumbnailUrl(null)).toBe(false);
  });
});

describe('API routes', () => {
  it('reject requests without a session', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    const diagnosis = await import('@/app/api/youtube/diagnosis/route');
    const connection = await import('@/app/api/youtube/connection/route');
    const config = await import('@/app/api/youtube/config/route');

    const res = await diagnosis.POST(new Request('http://x/api/youtube/diagnosis', { method: 'POST', body: '{"range":"28d"}' }));
    expect(res.status).toBe(401);
    expect((await connection.GET()).status).toBe(401);
    expect((await connection.DELETE()).status).toBe(401);
    expect((await config.GET()).status).toBe(401);
    vi.doUnmock('@/lib/supabase/server');
  });
});
