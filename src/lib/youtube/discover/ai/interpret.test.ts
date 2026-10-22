import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: vi.fn(),
  embed: vi.fn(),
}));
import { callLLM, embed } from '@/lib/llm-providers';
import type { Opportunity } from '../types';
import { fallbackAngle, interpretOpportunities, numbersIn, onlyKnownNumbers, withConfidenceNote, type InterpretInput } from './interpret';
import { longestSharedRun, tooCloseTo, wordOverlap } from './originality';

const llm = vi.mocked(callLLM);
const reply = (opportunities: object[]) => ({ model: 'm/x', content: JSON.stringify({ opportunities }) });

function opportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    version: 1, id: 'opp_1', topicId: 't1', topic: 'Portable carpet cleaners', recommendedAngle: null, angleSource: null, whyNow: null,
    audience: null, problem: null, recommendedFormat: 'comparison', gapTypes: ['coverage'], momentum: 'recent', competition: 'medium',
    channelFit: 'high', productionDifficulty: 'medium', signalsUsed: 7, confidence: 'high', confidenceReasons: [],
    scores: { total: 80, channelFit: 80, competitorPerformance: 80, momentum: 90, contentGap: 90, competition: 50, productionFit: 60, phase1: null },
    evidence: [{ id: 'ev_t1_1', statement: '4 competitor videos on this topic beat their channels’ usual views (median 3.2×).', source: 'calculated', period: 'Last 90 days' }],
    competitorSignals: [{ videoId: 'v1', channelId: 'C', title: 'Best Portable Carpet Cleaner 2026', ratio: 3.2, views: 1, baselineViews: 1, sampleSize: 12 }],
    angleRationale: null, yourVideoIds: [], yourVideos: [], window: '90d', generatedAt: '2026-10-19T00:00:00Z', ...over,
  };
}

const input = (over: Partial<InterpretInput> = {}): InterpretInput => ({
  channelTitle: 'Car Care Lab', language: 'English', yourTopics: [], diagnosis: null, opportunities: [opportunity()],
  competitorTitles: new Map([['t1', ['Best Portable Carpet Cleaner 2026', 'Bissell vs Hoover: which is better?']]]),
  competitorVectors: new Map(), textModels: ['m/x'], embeddingModels: ['e/x'], ...over,
});

beforeEach(() => vi.mocked(embed).mockResolvedValue(null));
afterEach(() => {
  llm.mockReset();
  vi.mocked(embed).mockReset();
});

describe('originality guard', () => {
  it('rejects the PRD’s exact copy and light rewording', () => {
    const titles = ['Best Portable Carpet Cleaner 2026'];
    expect(tooCloseTo('Best Portable Carpet Cleaner 2026', titles)).toBe(titles[0]);
    expect(tooCloseTo('The best portable carpet cleaner', titles)).toBe(titles[0]);
  });
  it('accepts a genuinely different angle', () => {
    expect(tooCloseTo('Which Portable Extractor Actually Removes Deep Car Dirt?', ['Best Portable Carpet Cleaner 2026'])).toBeNull();
  });
  it('catches long copied phrases and near-identical meaning', () => {
    expect(longestSharedRun('I tried every robot vacuum in my house for a month', 'every robot vacuum in my house for a year')).toBe(8); // "every … for a"
    expect(tooCloseTo('Something else entirely', ['x'], () => 0.95)).toBe('x');
    expect(wordOverlap('', 'x')).toBe(0);
  });
});

describe('number check', () => {
  it('allows only numbers from the facts, including Bangla digits and 4 vs 4.0', () => {
    const allowed = new Set(['4', '3.2']);
    expect(onlyKnownNumbers('4 competitors saw 3.2× views', allowed)).toBe(true);
    expect(onlyKnownNumbers('৪টি ভিডিও ৩.২ গুণ', allowed)).toBe(true);
    expect(onlyKnownNumbers('Expect 50,000 views', allowed)).toBe(false);
    expect(numbersIn('4.0× and 12')).toEqual(['4', '12']);
  });
  it('states low confidence up front', () => {
    expect(withConfidenceNote('One video did well.', 'low', 'English')).toBe('Early signal: one video did well.');
    expect(withConfidenceNote('Early signal: x', 'low', 'English')).toBe('Early signal: x');
    expect(withConfidenceNote('Strong demand.', 'high', 'English')).toBe('Strong demand.');
  });
});

describe('interpretOpportunities', () => {
  it('uses valid AI text', async () => {
    llm.mockResolvedValue(reply([{ id: 'opp_1', recommendedAngle: 'Which portable extractor actually removes deep car dirt?', whyNow: '4 competitor videos beat their usual views.', audience: 'Car owners with pets' }]));
    const { opportunities, aiUsed } = await interpretOpportunities(input());
    expect(aiUsed).toBe(true);
    expect(opportunities[0]).toMatchObject({ angleSource: 'ai', recommendedAngle: 'Which portable extractor actually removes deep car dirt?', audience: 'Car owners with pets' });
    // Scores and confidence are never touched by the model.
    expect(opportunities[0].scores.total).toBe(80);
  });

  it('retries a copied angle once, then falls back', async () => {
    llm.mockResolvedValue(reply([{ id: 'opp_1', recommendedAngle: 'Best Portable Carpet Cleaner 2026', whyNow: '4 videos did well.' }]));
    const { opportunities } = await interpretOpportunities(input());
    expect(llm).toHaveBeenCalledTimes(2);
    expect(String(llm.mock.calls[1][0].messages[1].content)).toMatch(/too close/);
    expect(opportunities[0]).toMatchObject({ angleSource: 'fallback', recommendedAngle: fallbackAngle(opportunity(), 'English') });
  });

  it('accepts a different angle from the retry', async () => {
    llm
      .mockResolvedValueOnce(reply([{ id: 'opp_1', recommendedAngle: 'Best Portable Carpet Cleaner 2026', whyNow: 'x' }]))
      .mockResolvedValueOnce(reply([{ id: 'opp_1', recommendedAngle: 'I cleaned a dog-hair disaster with four extractors', whyNow: 'x' }]));
    const { opportunities } = await interpretOpportunities(input());
    expect(opportunities[0]).toMatchObject({ angleSource: 'ai', recommendedAngle: 'I cleaned a dog-hair disaster with four extractors' });
  });

  it('drops invented numbers and hype, keeps the rest', async () => {
    llm.mockResolvedValue(
      reply([{ id: 'opp_1', recommendedAngle: 'Which extractor survives a muddy dog?', whyNow: 'This could get 500,000 views.', audience: 'Guaranteed viral audience' }])
    );
    const [o] = (await interpretOpportunities(input())).opportunities;
    expect(o.angleSource).toBe('ai');
    expect(o.whyNow).toBeNull();
    expect(o.audience).toBeNull();
  });

  it('ignores invented opportunities, malformed items and extra fields', async () => {
    llm.mockResolvedValue(
      reply([
        { id: 'opp_9', recommendedAngle: 'Invented idea for nothing', whyNow: 'x' },
        { id: 'opp_1', recommendedAngle: 'short' },
        { id: 'opp_1', recommendedAngle: 'Which extractor survives a muddy dog?', whyNow: 'x', score: 100 },
      ])
    );
    const { opportunities } = await interpretOpportunities(input());
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).not.toHaveProperty('score');
    expect(opportunities[0].scores.total).toBe(80);
  });

  it('falls back completely when the model fails', async () => {
    llm.mockResolvedValue(null);
    const { opportunities, aiUsed } = await interpretOpportunities(input({ language: 'Bangla' }));
    expect(aiUsed).toBe(false);
    expect(opportunities[0].recommendedAngle).toMatch(/নিয়ে আপনার নিজের দৃষ্টিভঙ্গি/);
    expect(opportunities[0].whyNow).toBeNull();
  });
});
