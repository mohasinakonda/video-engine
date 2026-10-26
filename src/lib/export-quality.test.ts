import { describe, expect, it } from 'vitest';
import { estimateRenderSec, formatRenderTime, recommendQuality } from './export-quality';

const device = { cores: 8, memoryGB: 8 };
const SEVEN_MIN = 433;

describe('estimateRenderSec', () => {
  it('scales with pixels and frames', () => {
    // 120 fps at 1080p: 433 s × 30 fps = 12,990 frames → about 108 s.
    expect(estimateRenderSec(120, SEVEN_MIN, { resolution: '1080p', fps: 30 })).toBeCloseTo(108.25, 1);
    // 720p has 44% of the pixels and 24 fps has 80% of the frames.
    const light = estimateRenderSec(120, SEVEN_MIN, { resolution: '720p', fps: 24 });
    expect(light).toBeCloseTo(108.25 * (4 / 9) * 0.8, 1);
  });
});

describe('recommendQuality', () => {
  it('keeps Full HD 30 fps on a fast device', () => {
    expect(recommendQuality({ speed1080: 120, device, durationSec: SEVEN_MIN }).option).toEqual({ resolution: '1080p', fps: 30 });
  });

  it('steps down until the render takes at most 1.5× the video length', () => {
    // 15 fps at 1080p: 1080p30 = 2× and 1080p24 = 1.6× the length; 720p30 = 0.9×.
    expect(recommendQuality({ speed1080: 15, device, durationSec: SEVEN_MIN }).option).toEqual({ resolution: '720p', fps: 30 });
  });

  it('suggests the lightest option when nothing is fast enough', () => {
    expect(recommendQuality({ speed1080: 3, device, durationSec: SEVEN_MIN }).option).toEqual({ resolution: '720p', fps: 24 });
  });

  it('avoids 1080p with 4 GB of memory or less, however fast', () => {
    const r = recommendQuality({ speed1080: 200, device: { cores: 8, memoryGB: 4 }, durationSec: SEVEN_MIN });
    expect(r.option.resolution).toBe('720p');
  });

  it('falls back to the device info when no speed was measured', () => {
    expect(recommendQuality({ speed1080: null, device: { cores: 4, memoryGB: null }, durationSec: SEVEN_MIN }).option).toEqual({ resolution: '720p', fps: 24 });
    expect(recommendQuality({ speed1080: null, device, durationSec: SEVEN_MIN }).option).toEqual({ resolution: '1080p', fps: 30 });
  });
});

describe('formatRenderTime', () => {
  it('reads naturally', () => {
    expect(formatRenderTime(12)).toBe('10 sec');
    expect(formatRenderTime(370)).toBe('6 min');
    expect(formatRenderTime(4800)).toBe('1 h 20 min');
  });
});
