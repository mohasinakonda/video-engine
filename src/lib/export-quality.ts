/**
 * export-quality.ts — picks a render quality this device can handle and estimates render times,
 * from a short measured test render (see measureRenderSpeed in export-engine.ts).
 */

import type { ExportFps, ExportResolution } from '@/types';

export interface QualityOption {
  resolution: ExportResolution;
  fps: ExportFps;
}

export interface DeviceInfo {
  /** Logical CPU cores, or null when the browser doesn't say. */
  cores: number | null;
  /** Approximate RAM in GB (Chromium only, capped at 8), or null. */
  memoryGB: number | null;
}

/** Best quality first; 4K is offered but never recommended. */
export const RECOMMENDABLE: QualityOption[] = [
  { resolution: '1080p', fps: 30 },
  { resolution: '1080p', fps: 24 },
  { resolution: '720p', fps: 30 },
  { resolution: '720p', fps: 24 },
];

/** A render may take this many times the video's length before a lighter option is suggested. */
const ACCEPTABLE_RENDER_RATIO = 1.5;

const PIXELS_VS_1080P: Record<ExportResolution, number> = { '720p': (720 / 1080) ** 2, '1080p': 1, '4k': 4 };

export function readDeviceInfo(): DeviceInfo {
  if (typeof navigator === 'undefined') return { cores: null, memoryGB: null };
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    cores: typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : null,
    memoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
  };
}

/**
 * Seconds to render `durationSec` of video with `option`, given the measured 1080p speed in
 * frames per second. Work grows with the pixel count and the number of frames.
 */
export function estimateRenderSec(speed1080: number, durationSec: number, option: QualityOption): number {
  const framesPerSec = speed1080 / PIXELS_VS_1080P[option.resolution];
  return (durationSec * option.fps) / Math.max(0.01, framesPerSec);
}

export function recommendQuality(input: { speed1080: number | null; device: DeviceInfo; durationSec: number }): {
  option: QualityOption;
  reason: string;
} {
  const { speed1080, device, durationSec } = input;
  const lowMemory = device.memoryGB !== null && device.memoryGB <= 4;
  const lightest = RECOMMENDABLE[RECOMMENDABLE.length - 1];

  if (speed1080 === null) {
    const lowEnd = lowMemory || (device.cores !== null && device.cores <= 4);
    return lowEnd
      ? { option: lightest, reason: 'Your device looks low-powered, so a lighter render is suggested.' }
      : { option: RECOMMENDABLE[0], reason: 'Full HD suits most devices.' };
  }

  const candidates = lowMemory ? RECOMMENDABLE.filter((o) => o.resolution !== '1080p') : RECOMMENDABLE;
  const fits = candidates.find((o) => estimateRenderSec(speed1080, durationSec, o) <= durationSec * ACCEPTABLE_RENDER_RATIO);
  if (fits === RECOMMENDABLE[0]) return { option: fits, reason: 'Your device renders Full HD comfortably.' };
  if (fits) {
    return {
      option: fits,
      reason: lowMemory ? 'Your device has limited memory, so 720p is suggested.' : 'This keeps the render time reasonable on your device.',
    };
  }
  return { option: lightest, reason: 'Your device is slow at rendering video, so the lightest setting is suggested.' };
}

/** "45 sec", "6 min", "1 h 20 min". */
export function formatRenderTime(sec: number): string {
  if (sec < 60) return `${Math.max(5, Math.round(sec / 5) * 5)} sec`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
