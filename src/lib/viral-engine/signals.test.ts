import { describe, expect, it } from 'vitest';
import { audioLevels, detectCuts, findRuns, frameChange, frameDifference, isLetterboxed, speechRuns, toGray } from './signals';
import { findDrops, normalizeRetention, usualCurve } from './retention';

describe('frame maths', () => {
  it('measures difference from 0 (same) to 1 (opposite)', () => {
    const black = new Uint8Array(100);
    const white = new Uint8Array(100).fill(255);
    expect(frameDifference(black, black)).toBe(0);
    expect(frameDifference(black, white)).toBe(1);
  });

  it('counts a small area changing colour, even at the same brightness', () => {
    // 10 pixels on black; one turns from red to blue (similar brightness, different colour).
    const a = new Uint8ClampedArray(40);
    const b = new Uint8ClampedArray(40);
    a.set([200, 0, 0, 255], 0);
    b.set([0, 0, 200, 255], 0);
    expect(frameChange(a, b)).toBeCloseTo(0.1);
    expect(frameChange(a, a)).toBe(0);
  });

  it('converts RGBA to grey', () => {
    expect(Array.from(toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])))).toEqual([255, 0]);
  });

  it('finds cuts and merges ones closer than the minimum gap', () => {
    const motion = [0, 0.01, 0.7, 0.6, 0.01, 0.01, 0.01, 0.8, 0.01];
    expect(detectCuts(motion, 0.25)).toEqual([0.5, 1.75]);
  });

  it('finds a fade spread over a second, but not a steady pan', () => {
    const fade = [0, 0.01, 0.01, 0.01, 0.01, 0.3, 0.35, 0.35, 0.3, 0.01, 0.01, 0.01, 0.01];
    expect(detectCuts(fade, 0.25)).toEqual([1.75]);
    const pan = Array(16).fill(0.3);
    expect(detectCuts(pan, 0.25)).toEqual([]);
  });

  it('detects black bars on most frames', () => {
    const w = 10;
    const h = 20;
    const frame = new Uint8Array(w * h).fill(120);
    frame.fill(0, 0, w * 2);
    frame.fill(0, w * (h - 2));
    expect(isLetterboxed([frame, frame], w, h)).toBe(true);
    expect(isLetterboxed([new Uint8Array(w * h).fill(120)], w, h)).toBe(false);
  });
});

describe('audio levels', () => {
  it('reports silence as -90 dBFS and loud audio near 0', () => {
    const rate = 1000;
    const samples = new Float32Array(rate * 2);
    for (let i = rate; i < rate * 2; i++) samples[i] = i % 2 ? 0.5 : -0.5;
    const { loudness, clippingPct } = audioLevels(samples, rate, 0.5);
    expect(loudness.slice(0, 2)).toEqual([-90, -90]);
    expect(loudness[2]).toBeCloseTo(-6, 0);
    expect(clippingPct).toBe(0);
  });

  it('counts clipped samples', () => {
    const samples = new Float32Array(100).fill(1);
    expect(audioLevels(samples, 100, 0.1).clippingPct).toBe(100);
  });
});

describe('speech runs', () => {
  it('joins words with short gaps and splits at real pauses', () => {
    const words = [
      { word: 'Hi', start: 0.2, end: 0.4 },
      { word: 'there', start: 0.5, end: 0.8 },
      { word: 'later', start: 3, end: 3.4 },
    ];
    expect(speechRuns(words, [])).toEqual([
      { start: 0.2, end: 0.8, text: 'Hi there' },
      { start: 3, end: 3.4, text: 'later' },
    ]);
  });

  it('falls back to segments', () => {
    expect(speechRuns([], [{ start: 1, end: 2, text: ' Hello ' }])).toEqual([{ start: 1, end: 2, text: 'Hello' }]);
  });
});

describe('findRuns', () => {
  it('returns stretches at least minSec long', () => {
    const runs = findRuns(10, 0.5, (t) => t > 2 && t < 6, 2);
    expect(runs).toEqual([{ start: 2, end: 6 }]);
    expect(findRuns(10, 0.5, (t) => t > 2 && t < 3, 2)).toEqual([]);
  });
});

describe('retention', () => {
  const raw = Array.from({ length: 100 }, (_, i) => ({ ratio: (i + 1) / 100, watchRatio: 1.2 - i * 0.006 }));

  it('normalises to percent of starting viewers per second', () => {
    const curve = normalizeRetention(raw, 20);
    expect(curve[0]).toEqual({ sec: 0, pct: 100 });
    expect(curve).toHaveLength(21);
    expect(curve[20].pct).toBeLessThan(100);
  });

  it('needs at least 3 Shorts for a usual curve', () => {
    const c = normalizeRetention(raw, 10);
    expect(usualCurve([c, c])).toBeNull();
    expect(usualCurve([c, c, c])?.length).toBe(11);
  });

  it('finds a steep drop in the middle but not the normal early fall', () => {
    const curve = [100, 85, 80, 79, 78, 77, 70, 62, 55, 54, 53].map((pct, sec) => ({ sec, pct }));
    const drops = findDrops(curve, null);
    expect(drops).toEqual([{ start: 5, end: 8, fromPct: 77, toPct: 55 }]);
  });

  it('flags an early fall only when it is much worse than the usual Short', () => {
    const curve = [100, 60, 55, 54].map((pct, sec) => ({ sec, pct }));
    const usual = [100, 90, 85, 84].map((pct, sec) => ({ sec, pct }));
    expect(findDrops(curve, usual)[0]).toMatchObject({ start: 0, end: 1 });
    expect(findDrops(curve, null)).toEqual([]);
  });
});
