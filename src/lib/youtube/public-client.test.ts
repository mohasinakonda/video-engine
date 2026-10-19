import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./quota-budget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quota-budget')>();
  return { ...actual, consumeQuota: vi.fn() };
});

import { embed } from '@/lib/llm-providers';
import { parseChannelInput, searchVideos } from './public-client';
import { QuotaBudgetError, consumeQuota, nextQuotaReset, pacificDate } from './quota-budget';

const CHANNEL = 'UC' + 'a'.repeat(22);
const consume = vi.mocked(consumeQuota);

afterEach(() => {
  vi.unstubAllGlobals();
  consume.mockReset();
});

describe('parseChannelInput', () => {
  const kindOf = (text: string) => {
    const r = parseChannelInput(text);
    return r.ok ? r.input : null;
  };

  it('accepts ids, handles and every channel / video URL form', () => {
    expect(kindOf(CHANNEL)).toEqual({ kind: 'id', id: CHANNEL });
    expect(kindOf(`https://www.youtube.com/channel/${CHANNEL}/videos`)).toEqual({ kind: 'id', id: CHANNEL });
    expect(kindOf('@TerraLoreStudios')).toEqual({ kind: 'handle', handle: '@TerraLoreStudios' });
    expect(kindOf('youtube.com/@terra.lore-studio/shorts')).toEqual({ kind: 'handle', handle: '@terra.lore-studio' });
    expect(kindOf('https://m.youtube.com/watch?v=jNQXAC9IVRw&t=10s')).toEqual({ kind: 'video', id: 'jNQXAC9IVRw' });
    expect(kindOf('https://youtu.be/jNQXAC9IVRw?si=x')).toEqual({ kind: 'video', id: 'jNQXAC9IVRw' });
    expect(kindOf('https://www.youtube.com/shorts/jNQXAC9IVRw')).toEqual({ kind: 'video', id: 'jNQXAC9IVRw' });
  });

  it('accepts handles written in Bangla', () => {
    expect(kindOf('https://www.youtube.com/@%E0%A6%B8%E0%A6%B9%E0%A6%9C%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE')).toEqual({
      kind: 'handle',
      handle: '@সহজশিক্ষা',
    });
  });

  it('rejects other sites, legacy links and junk with a helpful reason', () => {
    expect(parseChannelInput('https://evil.com/channel/' + CHANNEL).ok).toBe(false);
    expect(parseChannelInput('https://youtube.com.evil.com/@x').ok).toBe(false);
    const legacy = parseChannelInput('https://www.youtube.com/c/SomeName');
    expect(legacy.ok === false && legacy.reason).toMatch(/@handle/);
    expect(parseChannelInput('').ok).toBe(false);
    expect(parseChannelInput('x'.repeat(300)).ok).toBe(false);
    expect(parseChannelInput('https://www.youtube.com/watch?v=short').ok).toBe(false);
  });
});

describe('searchVideos budget', () => {
  it('reserves a search call before calling YouTube and never retries', async () => {
    consume.mockResolvedValue(true);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: { videoId: 'v1' }, snippet: { channelId: CHANNEL } }, { id: {}, snippet: {} }] }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const hits = await searchVideos('token', { query: 'car vacuum', dailyLimit: 80, regionCode: 'BD', relevanceLanguage: 'bn' });
    expect(consume).toHaveBeenCalledWith('search', 1, 80);
    expect(hits).toEqual([{ videoId: 'v1', channelId: CHANNEL }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('type')).toBe('video');
    expect(url.searchParams.get('regionCode')).toBe('BD');
    expect(url.searchParams.get('key')).toBeNull();
  });

  it('does not call YouTube when the daily budget is used up', async () => {
    consume.mockResolvedValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchVideos('token', { query: 'x', dailyLimit: 80 })).rejects.toBeInstanceOf(QuotaBudgetError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops invalid region and language codes', async () => {
    consume.mockResolvedValue(true);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await searchVideos('token', { query: 'x', dailyLimit: 80, regionCode: 'bd; drop', relevanceLanguage: '<script>' });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.has('regionCode')).toBe(false);
    expect(url.searchParams.has('relevanceLanguage')).toBe(false);
  });
});

describe('quota day', () => {
  it('uses the Pacific date', () => {
    // 05:00 UTC on 20 Oct is still 19 Oct in Los Angeles.
    expect(pacificDate(new Date('2026-10-20T05:00:00Z'))).toBe('2026-10-19');
  });
  it('resets at Pacific midnight, through daylight-saving changes', () => {
    expect(nextQuotaReset(new Date('2026-10-19T10:00:00Z'))).toBe('2026-10-20T07:00:00.000Z'); // PDT
    expect(nextQuotaReset(new Date('2026-12-01T10:00:00Z'))).toBe('2026-12-02T08:00:00.000Z'); // PST
  });
});

describe('embed', () => {
  beforeEach(() => {
    process.env.DEEPINFRA_API_KEY = 'test-key';
  });

  it('batches texts, keeps order and stays on one model', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(String(init.body));
      const data = input.map((_: string, i: number) => ({ index: i, embedding: [i + 1, 0] })).reverse();
      return new Response(JSON.stringify({ data }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await embed({ texts: ['a', 'b', 'c'], models: ['BAAI/bge-m3'], batchSize: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.vectors).toEqual([[1, 0], [2, 0], [1, 0]]);
    expect(result?.model).toBe('BAAI/bge-m3');
  });

  it('falls back to the next model when one fails, and returns null when all fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ index: 0, embedding: [1] }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await embed({ texts: ['a'], models: ['m/one', 'm/two'] }))?.model).toBe('m/two');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })));
    expect(await embed({ texts: ['a'], models: ['m/one'] })).toBeNull();
  });
});
