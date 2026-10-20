import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATE_SETTINGS } from '../settings';
import { bump, measureCost, remaining, runCost } from './bundle';

const s = DEFAULT_CREATE_SETTINGS;
const project = (usage = {}, unlockedAt: string | null = '2026-10-20') => ({ unlockedAt, usage });

describe('video price', () => {
  it('includes each kind of run up to its allowance', () => {
    expect(remaining(project(), s, 'script')).toBe(2);
    expect(runCost(project({ script: 1 }), s, 'script')).toBe(0);
    expect(runCost(project({ script: 2 }), s, 'script')).toBe(s.scriptCreditCost);
    expect(runCost(project({ section: 20 }), s, 'section')).toBe(Math.ceil(s.scriptCreditCost / 2));
  });

  it('charges every step on a project started before (not unlocked)', () => {
    expect(remaining(project({}, null), s, 'brief')).toBe(0);
    expect(runCost(project({}, null), s, 'packaging')).toBe(s.packagingCreditCost);
    expect(measureCost(project({}, null), s)).toBe(s.performanceCreditCost);
    expect(measureCost(project(), s)).toBe(0);
  });

  it('counts runs', () => {
    expect(bump(project({ brief: 1 }), 'brief')).toEqual({ brief: 2 });
    expect(bump(project(), 'topicSearch')).toEqual({ topicSearch: 1 });
  });
});
