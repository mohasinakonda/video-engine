import { beforeEach, describe, expect, it, vi } from 'vitest';

const recorded: { bucket: string; amount: number }[] = [];
vi.mock('./quota-budget', () => ({
  pacificDate: () => '2026-10-27',
  consumeQuota: vi.fn(async (bucket: string, amount: number) => (recorded.push({ bucket, amount }), true)),
}));
vi.mock('./db', () => ({ getServiceClient: () => ({}) }));

import { costFor, meterRequest, withQuotaMeter } from './quota-meter';
import { FRESH_RESULT_MS, isFresh } from '@/components/discover/rerun-confirm';

const API = 'https://www.googleapis.com/youtube/v3';

beforeEach(() => {
  recorded.length = 0;
});

const NONE = { units: 0, searches: 0 };

describe('costFor', () => {
  it('bills search to its own bucket and every other Data API call 1 unit', () => {
    expect(costFor(`${API}/search?part=snippet&q=squid`)).toEqual({ units: 0, searches: 1 });
    expect(costFor(`${API}/videos?part=snippet&id=a,b`)).toEqual({ units: 1, searches: 0 });
    expect(costFor(`${API}/playlistItems?part=contentDetails`)).toEqual({ units: 1, searches: 0 });
  });

  it('skips calls billed elsewhere: API keys, Analytics, OAuth', () => {
    expect(costFor(`${API}/search?q=squid&key=AIzaUserKey`)).toEqual(NONE);
    expect(costFor('https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE')).toEqual(NONE);
    expect(costFor('https://oauth2.googleapis.com/token')).toEqual(NONE);
    expect(costFor('not a url')).toEqual(NONE);
  });
});

describe('withQuotaMeter', () => {
  it('adds up a request’s calls and writes them once, under its feature', async () => {
    const out = await withQuotaMeter('create/topic-search', async () => {
      meterRequest(`${API}/search?q=x`);
      await Promise.resolve();
      meterRequest(`${API}/videos?id=a`);
      meterRequest(`${API}/channels?id=b`);
      return 'done';
    });
    expect(out).toBe('done');
    expect(recorded).toEqual([
      { bucket: 'units:create/topic-search', amount: 2 },
      { bucket: 'searches:create/topic-search', amount: 1 },
    ]);
  });

  it('still records when the work fails, and writes nothing for no calls', async () => {
    await expect(
      withQuotaMeter('discover/research', async () => {
        meterRequest(`${API}/videos?id=a`);
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    await withQuotaMeter('audit/video', async () => undefined);
    expect(recorded).toEqual([{ bucket: 'units:discover/research', amount: 1 }]);
  });

  it('records calls made outside any metered request as "other"', async () => {
    meterRequest(`${API}/channels?mine=true`);
    await new Promise((r) => setTimeout(r, 0));
    expect(recorded).toEqual([{ bucket: 'units:other', amount: 1 }]);
  });
});

describe('isFresh', () => {
  it('treats results under 6 hours old as fresh', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(isFresh(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isFresh(new Date(now - FRESH_RESULT_MS - 1).toISOString(), now)).toBe(false);
    expect(isFresh(undefined, now)).toBe(false);
  });
});
