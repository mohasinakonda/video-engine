import { describe, expect, it } from 'vitest';
import { emptyBrief } from './brief';
import {
  allowedNumbers,
  briefFacts,
  isGrounded,
  emptyScript,
  estimateSeconds,
  hasUnbackedNumber,
  isStale,
  reconcileClaims,
  repeatedSections,
  researchChecklist,
  scriptSchema,
  scriptToText,
  sectionCost,
  sectionIds,
  sectionIssues,
  targetWords,
  withoutFiller,
} from './script';

const brief = { ...emptyBrief('Deep sea creatures', 'English'), corePromise: 'Meet 5 animals that live below 4000 metres', keyPoints: ['Pressure is extreme'], updatedAt: '2026-10-20T10:00:00.000Z' };

describe('length', () => {
  it('estimates speaking time per language', () => {
    const words = Array(150).fill('word').join(' ');
    expect(estimateSeconds(words, 'English')).toBe(60);
    expect(estimateSeconds(words, 'Bangla')).toBeGreaterThan(60);
  });

  it('gives the hook and close half a share of the target', () => {
    const t = targetWords([{ id: 'hook' }, { id: 'part1' }, { id: 'cta' }], 2, 'English');
    expect(t.get('part1')).toBe(150);
    expect(t.get('hook')).toBe(75);
  });

  it('makes section ids unique when a beat repeats', () => {
    expect(sectionIds([{ id: 'part', label: 'a', purpose: '' }, { id: 'part', label: 'b', purpose: '' }])).toEqual(['part', 'part~1']);
  });
});

describe('numbers and claims', () => {
  const allowed = allowedNumbers(brief);

  it('allows brief numbers and small counts, flags invented statistics', () => {
    expect(hasUnbackedNumber('There are 5 of them, deeper than 4000 metres.', allowed)).toBe(false);
    expect(hasUnbackedNumber('Here are 3 reasons.', allowed)).toBe(false);
    expect(hasUnbackedNumber('90% of the ocean is unexplored.', allowed)).toBe(true);
    expect(hasUnbackedNumber('It was found in 1977.', allowed)).toBe(true);
    expect(hasUnbackedNumber('৯০ শতাংশ সমুদ্র অজানা।', allowed)).toBe(true);
  });

  it('keeps evidence the brief backs and turns the rest into research', () => {
    const facts = briefFacts(brief);
    expect(isGrounded('Pressure is extreme down there', facts)).toBe(true);
    expect(isGrounded('Luciferin reacts with oxygen', facts)).toBe(false);
    const claims = reconcileClaims('', [{ text: 'Pressure is extreme', kind: 'evidence' }, { text: 'Luciferin reacts with oxygen', kind: 'evidence' }, { text: 'Light is a language', kind: 'creative' }], allowed, facts);
    expect(claims.map((c) => c.kind)).toEqual(['evidence', 'needs_research', 'creative']);
    expect(isGrounded('প্রাণীরা আলো তৈরি করে', ['প্রাণী নিজের আলো তৈরি করে'])).toBe(true);
  });

  it('turns unbacked evidence into research and adds uncovered sentences', () => {
    const claims = reconcileClaims('The ocean is deep. 90% of it is unexplored. Pressure is huge.', [{ text: 'It was discovered in 1977', kind: 'evidence' }], allowed);
    expect(claims).toContainEqual({ text: 'It was discovered in 1977', kind: 'needs_research' });
    expect(claims).toContainEqual({ text: '90% of it is unexplored.', kind: 'needs_research' });
    expect(claims).toHaveLength(2);
  });

  it('does not add a sentence a research claim already covers', () => {
    const claims = reconcileClaims('About 90% of the ocean is unexplored.', [{ text: '90% of the ocean is unexplored', kind: 'needs_research' }], allowed);
    expect(claims).toHaveLength(1);
  });
});

describe('checks', () => {
  const long = (seed: string) => Array.from({ length: 40 }, (_, i) => `${seed}${i}`).join(' ');

  it('finds parts that repeat another part', () => {
    const text = long('w');
    expect(repeatedSections([{ id: 'a', narration: text }, { id: 'b', narration: text }, { id: 'c', narration: long('x') }])).toEqual(new Set(['a', 'b']));
  });

  it('reports empty, filler and overlong parts', () => {
    const script = emptyScript(brief, 2);
    script.sections[0].narration = 'Hey guys, in today’s video we look at fish.';
    script.sections[1].narration = Array(1000).fill('word').join(' ');
    const issues = sectionIssues(script);
    expect(issues.get(script.sections[0].id)).toContain('filler');
    expect(issues.get(script.sections[1].id)).toContain('too_long');
    expect(issues.get(script.sections[2].id)).toContain('empty');
    script.sections[2].narration = 'Too short.';
    expect(sectionIssues(script).get(script.sections[2].id)).toEqual(['too_short']);
  });

  it('removes filler sentences only', () => {
    expect(withoutFiller('Without further ado, here it is. Fish glow in the dark.')).toBe('Fish glow in the dark.');
    expect(withoutFiller('আজকের ভিডিওতে আমরা দেখবো। মাছ অন্ধকারে জ্বলে।')).toBe('মাছ অন্ধকারে জ্বলে।');
  });
});

describe('script', () => {
  it('builds an empty, valid script from the brief structure', () => {
    const script = emptyScript(brief, 8);
    expect(scriptSchema.safeParse(script).success).toBe(true);
    expect(script.sections.map((s) => s.heading)).toEqual(brief.structure.map((b) => b.label));
    expect(script.briefUpdatedAt).toBe(brief.updatedAt);
  });

  it('is stale when the brief was saved after it', () => {
    const script = emptyScript(brief, 8);
    expect(isStale(script, brief)).toBe(false);
    expect(isStale(script, { ...brief, updatedAt: '2026-10-21T00:00:00.000Z' })).toBe(true);
  });

  it('exports text with the research checklist', () => {
    const script = emptyScript(brief, 8);
    script.sections[0].narration = 'Hello.';
    script.sections[0].claims = [{ text: 'Check the depth record', kind: 'needs_research' }];
    expect(researchChecklist(script)).toHaveLength(1);
    const text = scriptToText(script, 'Deep sea');
    expect(text).toContain(`## ${script.sections[0].heading}\nHello.`);
    expect(text).toContain('- [ ] Check the depth record');
  });

  it('prices one part at half a script, rounded up', () => {
    expect(sectionCost(5)).toBe(3);
    expect(sectionCost(0)).toBe(0);
  });
});
