import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_CHARS, viralRequestSchema } from './request';

const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function body(overrides: Record<string, unknown> = {}) {
  return {
    file: { name: 'short.mp4', size: 1000, durationSec: 20 },
    hookFrames: [{ t: 0, image: jpeg }],
    sheets: [{ image: jpeg, times: [4, 5, 6] }],
    signals: {
      durationSec: 20,
      width: 1080,
      height: 1920,
      letterboxed: false,
      motionStep: 0.25,
      motion: [0, 0.1],
      cuts: [2],
      loudnessStep: 0.1,
      loudness: [-20, -30],
      clippingPct: 0,
      loopSimilarity: 0.4,
      speech: [{ start: 0.3, end: 2, text: 'hi' }],
      speechLanguage: 'en',
    },
    videoLink: null,
    metadata: { title: 'Noodles', hashtags: ['#food'] },
    ...overrides,
  };
}

describe('viral request', () => {
  it('accepts a normal request', () => {
    expect(viralRequestSchema.safeParse(body()).success).toBe(true);
  });

  it('accepts only JPEG data URLs, so no outbound links reach the model', () => {
    expect(viralRequestSchema.safeParse(body({ hookFrames: [{ t: 0, image: 'https://example.com/a.jpg' }] })).success).toBe(false);
    expect(viralRequestSchema.safeParse(body({ hookFrames: [{ t: 0, image: 'data:image/png;base64,AAAA' }] })).success).toBe(false);
  });

  it('rejects oversized images and too many cells per sheet', () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(MAX_IMAGE_CHARS)}`;
    expect(viralRequestSchema.safeParse(body({ hookFrames: [{ t: 0, image: big }] })).success).toBe(false);
    expect(viralRequestSchema.safeParse(body({ sheets: [{ image: jpeg, times: Array(10).fill(1) }] })).success).toBe(false);
  });

  it('rejects videos longer than a Short', () => {
    expect(viralRequestSchema.safeParse(body({ file: { name: 'a', size: 1, durationSec: 400 } })).success).toBe(false);
  });
});
