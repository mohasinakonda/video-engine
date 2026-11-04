import { describe, expect, it } from 'vitest';
import { levelOf } from './levels';

describe('levelOf', () => {
  it('grades a number where higher is worse', () => {
    expect([0.49, 0.5, 0.6, 0.7].map((v) => levelOf('swipeAway', v))).toEqual(['ok', 'warning', 'error', 'critical']);
  });

  it('grades a number where higher is better', () => {
    expect([54, 49, 39, 29].map((v) => levelOf('avgViewPct', v))).toEqual(['ok', 'warning', 'error', 'critical']);
    expect(levelOf('shortsFeedShare', 0.41)).toBe('warning');
  });

  it('gives no level without a number', () => {
    expect(levelOf('swipeAway', null)).toBeNull();
    expect(levelOf('swipeAway', Number.NaN)).toBeNull();
  });
});
