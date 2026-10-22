import { afterEach, describe, expect, it, vi } from 'vitest';
import { assessCandidate, rankSearchChannels, shortsShare } from './discovery';
import { hasMixedScriptWord, mainLanguage, queryText, suggestQueries } from './queries';
import { cosine, normalizeTitle } from './similarity';
import { addCompetitorsSchema as addSchemaForTest, updateSchema } from './watchlist';
import type { CandidateSignals } from './types';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: vi.fn(),
}));
import { callLLM } from '@/lib/llm-providers';

const ch = (n: number) => 'UC' + String(n).padStart(22, '0');
const hit = (n: number) => ({ videoId: `v${n}`, channelId: ch(n) });

afterEach(() => vi.mocked(callLLM).mockReset());

describe('rankSearchChannels', () => {
  it('dedupes across phrases and ranks by phrases matched, then by hits', () => {
    const ranked = rankSearchChannels(
      [
        [hit(1), hit(2), hit(2), hit(3)],
        [hit(2), hit(4)],
        [hit(4), hit(5)],
      ],
      new Set(),
      10
    );
    expect(ranked.map((r) => r.channelId)).toEqual([ch(2), ch(4), ch(1), ch(3), ch(5)]);
    expect(ranked[0]).toEqual({ channelId: ch(2), queriesMatched: 2, hits: 3 });
  });

  it('excludes your channel and saved competitors, and caps the list', () => {
    const ranked = rankSearchChannels([[hit(1), hit(2), hit(3), hit(4)]], new Set([ch(1), ch(3)]), 1);
    expect(ranked.map((r) => r.channelId)).toEqual([ch(2)]);
  });

  it('handles empty searches', () => {
    expect(rankSearchChannels([[], []], new Set(), 10)).toEqual([]);
  });
});

describe('shortsShare', () => {
  it('counts videos of 3 minutes or less and ignores unknown durations', () => {
    expect(shortsShare([{ durationSec: 30 }, { durationSec: 180 }, { durationSec: 600 }, { durationSec: null }])).toBeCloseTo(2 / 3);
    expect(shortsShare([{ durationSec: null }])).toBeNull();
  });
});

describe('assessCandidate', () => {
  const base: CandidateSignals = {
    matchingTitles: 9,
    titlesChecked: 15,
    queriesMatched: 2,
    queriesRun: 3,
    uploadsLast90Days: 12,
    shortsShare: 0.1,
    yourShortsShare: 0.2,
  };

  it('rates a channel on your topics with a similar format as a high-relevance direct competitor', () => {
    const a = assessCandidate(base, true);
    expect(a).toMatchObject({ relevance: 'high', suggestedGroup: 'direct', confidence: 'high' });
    expect(a.reasons[0]).toBe('9 of their 15 recent titles are close to topics on your channel');
    expect(a.reasons[2]).toBe('Posts mostly long videos, like your channel');
  });

  it('calls a topical channel with a different format mix adjacent', () => {
    const a = assessCandidate({ ...base, shortsShare: 0.9 }, true);
    expect(a.suggestedGroup).toBe('adjacent');
    expect(a.reasons[2]).toBe('Posts mostly Shorts; your channel posts mostly long videos');
  });

  it('marks little topic overlap as low relevance, and as a format competitor only with a similar format mix', () => {
    const a = assessCandidate({ ...base, matchingTitles: 1, queriesMatched: 1 }, true);
    expect(a.relevance).toBe('low');
    expect(a.suggestedGroup).toBe('format');
    expect(assessCandidate({ ...base, matchingTitles: 1, queriesMatched: 1, shortsShare: 0.9 }, true).suggestedGroup).toBe('adjacent');
  });

  it('lowers confidence for small samples and for the backup embedding model', () => {
    expect(assessCandidate({ ...base, titlesChecked: 4, matchingTitles: 3 }, true).confidence).toBe('low');
    expect(assessCandidate(base, false).confidence).toBe('medium');
  });
});

describe('titles and similarity', () => {
  it('normalizes hashtags, years, emoji and links but keeps Bangla', () => {
    expect(normalizeTitle('Best Car Vacuum 2026 🔥 #shorts https://x.co/a')).toBe('best car vacuum');
    expect(normalizeTitle('সেরা গাড়ির ভ্যাকুয়াম | রিভিউ')).toBe('সেরা গাড়ির ভ্যাকুয়াম রিভিউ');
  });
  it('computes cosine safely', () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([0, 0], [1, 0])).toBe(0);
  });
});

describe('input validation', () => {
  it('limits search phrases', () => {
    expect(queryText.safeParse('a').success).toBe(false);
    expect(queryText.safeParse('x'.repeat(81)).success).toBe(false);
    expect(queryText.parse('  car   vacuum  ')).toBe('car vacuum');
  });
  it('validates watchlist updates', () => {
    expect(updateSchema.safeParse({}).success).toBe(false);
    expect(updateSchema.safeParse({ group: 'enemy' }).success).toBe(false);
    expect(updateSchema.safeParse({ label: 'x'.repeat(61) }).success).toBe(false);
    expect(updateSchema.parse({ label: '  ' })).toEqual({ label: null });
  });
  it('only accepts real channel ids when saving discovery picks', () => {
    expect(addSchemaForTest.safeParse({ channels: [{ channelId: ch(1), group: 'direct' }] }).success).toBe(true);
    expect(addSchemaForTest.safeParse({ channels: [{ channelId: 'UC123', group: 'direct' }] }).success).toBe(false);
    expect(addSchemaForTest.safeParse({ channels: [] }).success).toBe(false);
  });
});

describe('suggestQueries', () => {
  const input = { channelTitle: 'TerraLore Studios', titles: ['Ancient Rome explained'], count: 3, models: ['m/x'] };

  it('keeps valid, distinct phrases and drops ones naming the channel', async () => {
    vi.mocked(callLLM).mockResolvedValue({
      model: 'm/x',
      content: JSON.stringify({ queries: ['ancient rome history', 'Ancient Rome History', 'terralore studios videos', 'x', 'roman empire documentary'] }),
    });
    expect(await suggestQueries(input)).toEqual(['ancient rome history', 'roman empire documentary']);
  });

  it('drops phrases with words mixing Bangla and Latin letters', async () => {
    vi.mocked(callLLM).mockResolvedValue({ model: 'm/x', content: JSON.stringify({ queries: ['বald eagle death', 'bald eagle death'] }) });
    expect(await suggestQueries(input)).toEqual(['bald eagle death']);
    expect(hasMixedScriptWord('সেরা car vacuum')).toBe(false);
  });

  it('tells the model the main language of the titles', () => {
    expect(mainLanguage(['সেরা গাড়ি', 'রিভিউ ২০২৬', 'Car vlog'])).toBe('Bangla');
    expect(mainLanguage(['Ancient Rome', 'সেরা'])).toBe('English');
  });

  it('returns nothing when the model fails or answers badly', async () => {
    vi.mocked(callLLM).mockResolvedValue(null);
    expect(await suggestQueries(input)).toEqual([]);
    vi.mocked(callLLM).mockResolvedValue({ model: 'm/x', content: '{"phrases": 3}' });
    expect(await suggestQueries(input)).toEqual([]);
  });
});
