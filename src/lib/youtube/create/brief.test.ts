import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm-providers')>()),
  callLLM: vi.fn(),
}));
import { callLLM } from '@/lib/llm-providers';
import { normalizeDirection, interpretBrief } from './ai/brief-interpreter';
import { briefFromThesis, briefSchema, emptyBrief, missingForScript, qualitativeEvidence } from './brief';
import { STRUCTURES, structureFor } from './structures';
import type { Thesis } from './types';

const llm = vi.mocked(callLLM);
afterEach(() => llm.mockReset());

const thesis: Thesis = {
  version: 1,
  opportunityId: 'opp_90d_t4',
  topic: 'Deep-sea creature footage',
  recommendedAngle: 'What Lives Where Sunlight Never Reaches?',
  recommendedFormat: 'explainer',
  gapTypes: ['coverage', 'emerging'],
  momentum: 'recent',
  competition: 'medium',
  channelFit: 'high',
  productionDifficulty: 'low',
  confidence: 'medium',
  scores: { total: 74, channelFit: 85, competitorPerformance: 60, momentum: 90, contentGap: 90, competition: 50, productionFit: 90, phase1: 90 },
  signalsUsed: 7,
  window: '90d',
  researchedAt: '2026-10-19T00:00:00Z',
};

describe('brief from a Discover idea', () => {
  it('copies the idea and uses the format’s structure', () => {
    const b = briefFromThesis(thesis, 'English');
    expect(b).toMatchObject({ topic: 'Deep-sea creature footage', angle: 'What Lives Where Sunlight Never Reaches?', format: 'explainer', confidence: 'medium' });
    expect(b.structure.map((s) => s.id)).toEqual(STRUCTURES.explainer.map((s) => s.id));
    expect(briefSchema.safeParse(b).success).toBe(true);
  });

  it('keeps evidence qualitative: no numbers about other channels', () => {
    const evidence = qualitativeEvidence(thesis);
    expect(evidence.length).toBeGreaterThan(2);
    expect(evidence.some((e) => e.kind === 'diagnosis')).toBe(true);
    expect(evidence.every((e) => !/\d/.test(e.statement))).toBe(true);
  });

  it('starts manual briefs empty and says what a script needs', () => {
    const b = emptyBrief('Bangla alphabet for kids', 'Bangla');
    expect(b.source).toBe('manual');
    expect(missingForScript(b)).toEqual(['core promise', 'audience', 'at least one key point']);
    expect(structureFor(null).length).toBeGreaterThan(2);
    // A copy, so editing one brief's structure never changes the template.
    structureFor('list')[0].label = 'changed';
    expect(STRUCTURES.list[0].label).toBe('Hook');
  });
});

describe('BriefInterpreter', () => {
  const answer = (o: object) => llm.mockResolvedValue({ model: 'm/x', content: JSON.stringify(o) });

  it('fills empty fields and recovers title directions written as strings', async () => {
    answer({
      audience: 'Curious nature fans',
      corePromise: 'You’ll know how animals live without sunlight.',
      keyPoints: ['Light disappears with depth', 'Bioluminescence is everywhere'],
      keyQuestions: ['How do they see?'],
      titleDirections: ["How: 'How do they survive?' (mechanism: how)", { mechanism: 'question', direction: 'Ask what lives there' }, { mechanism: 'vibes', direction: 'x' }],
      thumbnailDirection: 'A glowing anglerfish in black water.',
    });
    const b = await interpretBrief(briefFromThesis(thesis, 'English'), { models: ['m/x'] });
    expect(b).toMatchObject({ audience: 'Curious nature fans', source: 'ai' });
    expect(b?.titleDirections).toEqual([
      { mechanism: 'how', direction: 'How do they survive?' },
      { mechanism: 'question', direction: 'Ask what lives there' },
    ]);
  });

  it('never overwrites what the user or Discover set', async () => {
    answer({ audience: 'AI audience', angle: 'AI angle', corePromise: 'AI promise', keyPoints: ['AI point'] });
    const base = { ...briefFromThesis(thesis, 'English'), audience: 'My audience', keyPoints: ['My point'] };
    const b = await interpretBrief(base, { models: ['m/x'] });
    expect(b).toMatchObject({ audience: 'My audience', angle: 'What Lives Where Sunlight Never Reaches?', keyPoints: ['My point'], corePromise: 'AI promise' });
  });

  it('drops hype and invented numbers, item by item', async () => {
    answer({
      corePromise: 'This will go viral',
      keyPoints: ['90% of the ocean is unexplored', 'Bioluminescence lights the dark', 'Guaranteed to amaze'],
    });
    const b = await interpretBrief(briefFromThesis(thesis, 'English'), { models: ['m/x'] });
    expect(b?.corePromise).toBe('');
    expect(b?.keyPoints).toEqual(['Bioluminescence lights the dark']);
  });

  it('allows numbers the creator gave', async () => {
    answer({ corePromise: 'Teach letters to 3-5 year olds', keyPoints: ['Start at age 3'] });
    const b = await interpretBrief(emptyBrief('Alphabet', 'English'), { notes: 'my viewers are 3-5 years old', models: ['m/x'] });
    expect(b?.corePromise).toBe('Teach letters to 3-5 year olds');
  });

  it('returns null when the model fails or gives nothing usable', async () => {
    llm.mockResolvedValue(null);
    expect(await interpretBrief(emptyBrief('x', 'English'), { models: ['m/x'] })).toBeNull();
    answer({ audience: 'Someone' });
    expect(await interpretBrief(emptyBrief('x', 'English'), { models: ['m/x'] })).toBeNull();
  });

  it('normalizes string directions', () => {
    expect(normalizeDirection('Strong claim: "The deep sea is weirder than space" (mechanism: strong_claim)')).toEqual({
      mechanism: 'strong_claim',
      direction: 'The deep sea is weirder than space',
    });
    expect(normalizeDirection({ mechanism: 'how', direction: 'x' })).toEqual({ mechanism: 'how', direction: 'x' });
  });
});
