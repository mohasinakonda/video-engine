import { describe, expect, it } from 'vitest';
import { levelOf, swipeTier } from './levels';

describe('levelOf', () => {
  it('grades a number where higher is worse', () => {
    expect([0.3, 0.35, 0.45, 0.6].map((v) => levelOf('swipeAway', v))).toEqual(['ok', 'warning', 'error', 'critical']);
  });

  it('names the swipe-away tier', () => {
    expect([0.18, 0.2, 0.28, 0.38, 0.44, 0.45, null].map(swipeTier)).toEqual(['Viral level', 'Viral level', 'Good', 'Average', 'Average', 'Poor', null]);
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
