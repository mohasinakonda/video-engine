/**
 * Pure signal maths for the Viral Engine. No browser or network APIs, so it is unit-tested and
 * shared by the extractor (browser) and the rules.
 */
import { RULES } from './rules-config';
import type { SpeechRun } from './types';

/** RGBA pixels → one byte of luminance per pixel. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    out[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return out;
}

/** Mean absolute difference of two equal-size greyscale images, 0 (same) – 1 (opposite). */
export function frameDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length / 255;
}

export const frameSimilarity = (a: Uint8Array, b: Uint8Array) => 1 - frameDifference(a, b);

/** A pixel counts as changed when any colour channel moves by more than this (0–255). */
export const PIXEL_CHANGE = 24;

/**
 * Share of pixels whose colour changed, 0–1, from two equal-size RGBA images. Unlike a mean
 * brightness difference, a small area that changes (an animated map on a dark background) or a
 * change of hue at the same brightness (red → blue) still counts.
 */
export function frameChange(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > PIXEL_CHANGE || Math.abs(a[i + 1] - b[i + 1]) > PIXEL_CHANGE || Math.abs(a[i + 2] - b[i + 2]) > PIXEL_CHANGE) changed++;
  }
  return changed / (a.length / 4);
}

/**
 * Seconds where the shot changes: hard cuts (one big jump) and fades or dissolves (a burst of
 * change spread over about a second, calmer on both sides — a steady pan is not a fade).
 * Changes closer than the minimum gap are merged.
 */
export function detectCuts(motion: number[], step: number): number[] {
  const found: number[] = [];
  for (let i = 1; i < motion.length; i++) {
    if (motion[i] >= RULES.cutMotion) found.push(round(i * step, 2));
  }

  const w = Math.max(2, Math.round(RULES.fadeWindowSec / step));
  const mean = (from: number, to: number) => {
    const slice = motion.slice(Math.max(1, from), Math.min(motion.length, to));
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  };
  // Every window that looks like a fade; overlapping ones are one fade, centred on the strongest.
  let group: { i: number; sum: number } | null = null;
  const flush = () => {
    if (group) found.push(round((group.i + w / 2) * step, 2));
    group = null;
  };
  for (let i = 1; i + w <= motion.length; i++) {
    const window = motion.slice(i, i + w);
    const sum = window.reduce((a, b) => a + b, 0);
    const inside = sum / w;
    const calmSides = mean(i - w, i) < inside / 2 && mean(i + w, i + 2 * w) < inside / 2;
    const isFade = sum >= RULES.fadeMotion && Math.max(...window) < RULES.cutMotion && calmSides;
    if (!isFade) continue;
    const current = group as { i: number; sum: number } | null;
    if (current && i - current.i < w) {
      if (sum > current.sum) group = { i, sum };
    } else {
      flush();
      group = { i, sum };
    }
  }
  flush();

  const cuts: number[] = [];
  for (const t of found.sort((a, b) => a - b)) {
    const last = cuts[cuts.length - 1];
    if (last === undefined || t - last >= RULES.cutMinGapSec) cuts.push(t);
  }
  return cuts;
}

/**
 * True when most sampled frames have dark, flat bands at the top and bottom (a horizontal video
 * placed in a vertical frame).
 */
export function isLetterboxed(frames: Uint8Array[], width: number, height: number): boolean {
  if (frames.length === 0) return false;
  const band = Math.max(1, Math.floor(height * 0.1));
  const isFlatDark = (frame: Uint8Array, fromRow: number) => {
    let sum = 0;
    let max = 0;
    for (let y = fromRow; y < fromRow + band; y++) {
      for (let x = 0; x < width; x++) {
        const v = frame[y * width + x];
        sum += v;
        if (v > max) max = v;
      }
    }
    return sum / (band * width) < 14 && max < 40;
  };
  const boxed = frames.filter((f) => isFlatDark(f, 0) && isFlatDark(f, height - band)).length;
  return boxed / frames.length >= 0.8;
}

/** Loudness per `step` seconds in dBFS (−90 for silence) and the share of clipped samples. */
export function audioLevels(samples: Float32Array, sampleRate: number, step: number): { loudness: number[]; clippingPct: number } {
  const size = Math.max(1, Math.round(sampleRate * step));
  const loudness: number[] = [];
  let clipped = 0;
  for (let start = 0; start < samples.length; start += size) {
    const end = Math.min(samples.length, start + size);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const s = samples[i];
      sum += s * s;
      if (Math.abs(s) >= 0.99) clipped++;
    }
    const rms = Math.sqrt(sum / (end - start));
    loudness.push(rms > 0 ? Math.max(-90, round(20 * Math.log10(rms), 1)) : -90);
  }
  return { loudness, clippingPct: samples.length ? round((clipped / samples.length) * 100, 2) : 0 };
}

interface TimedWord {
  word: string;
  start: number;
  end: number;
}

/**
 * When someone is talking. Words closer than `gapSec` join one run, so the gaps are real pauses.
 * Falls back to Whisper's segments when there are no word timestamps.
 */
export function speechRuns(words: TimedWord[], segments: { start: number; end: number; text: string }[], gapSec = 0.4): SpeechRun[] {
  const source = words.length
    ? words.map((w) => ({ start: w.start, end: w.end, text: w.word.trim() }))
    : segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }));
  const runs: SpeechRun[] = [];
  for (const item of [...source].sort((a, b) => a.start - b.start)) {
    if (!item.text || item.end <= item.start) continue;
    const last = runs[runs.length - 1];
    if (last && item.start - last.end <= gapSec) {
      last.end = Math.max(last.end, item.end);
      last.text = `${last.text} ${item.text}`;
    } else {
      runs.push({ start: item.start, end: item.end, text: item.text });
    }
  }
  return runs.map((r) => ({ start: round(r.start, 2), end: round(r.end, 2), text: r.text }));
}

/** The value of a fixed-step series at second `t` (the sample that covers it). */
export function sampleAt(series: number[], step: number, t: number): number | null {
  if (series.length === 0) return null;
  const i = Math.min(series.length - 1, Math.max(0, Math.floor(t / step)));
  return series[i];
}

/**
 * Maximal stretches of a fixed grid where `test` holds, at least `minSec` long.
 * The grid runs from 0 to `durationSec` in `step` increments.
 */
export function findRuns(durationSec: number, step: number, test: (t: number) => boolean, minSec: number): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let start: number | null = null;
  const steps = Math.ceil(durationSec / step);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(durationSec, i * step);
    const ok = i < steps && test(t + step / 2);
    if (ok && start === null) start = t;
    if (!ok && start !== null) {
      if (t - start >= minSec - 1e-9) runs.push({ start: round(start, 2), end: round(t, 2) });
      start = null;
    }
  }
  return runs;
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** "0:07" */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatTime(start)}–${formatTime(Math.ceil(end))}`;
}
