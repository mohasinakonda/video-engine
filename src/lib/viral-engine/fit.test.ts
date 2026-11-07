import { describe, expect, it } from 'vitest';
import { fitFromVectors } from './fit';

// Unit vectors: cooking videos point one way, a gaming Short another.
const cooking = (wobble: number) => [1, wobble, 0];
const videos = [0.05, 0.1, 0.15, 0.2, 0.25].map((w, i) => ({ title: `Recipe ${i}`, views: 100 * (i + 1), vector: cooking(w) }));

describe('topic fit', () => {
  it('scores an on-topic Short close to the channel’s own typical similarity', () => {
    const fit = fitFromVectors('Quick noodles', cooking(0.12), videos)!;
    expect(fit.typical - fit.score).toBeLessThan(0.04);
    expect(fit.closest).toHaveLength(3);
  });

  it('scores an off-topic Short far below it', () => {
    const fit = fitFromVectors('Gaming highlights', [0, 0.2, 1], videos)!;
    expect(fit.typical - fit.score).toBeGreaterThan(0.5);
  });

  it('needs a few videos to compare with', () => {
    expect(fitFromVectors('x', [1, 0, 0], videos.slice(0, 3))).toBeNull();
  });
});
