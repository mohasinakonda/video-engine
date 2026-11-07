'use client';

/**
 * Reads a Short in the browser: frames, motion, sound and speech. The video file never leaves the
 * user's computer; only still frames and measured numbers are sent for analysis.
 */
import { decodeToMono, encodeMonoWav } from '@/lib/audio-encoder';
import { transcribeAudioWithWhisper } from '@/lib/audio-transcriber';
import { HOOK_TIMES, SHEET_CELLS, SHEET_COLS, SHEET_ROWS } from './request';
import { RULES } from './rules-config';
import { audioLevels, detectCuts, frameChange, isLetterboxed, round, speechRuns, toGray } from './signals';
import type { MeasuredSignals } from './types';

export type ExtractStep = 'read' | 'frames' | 'audio' | 'speech';

export interface ExtractProgress {
  step: ExtractStep;
  /** 0–1 within the step. */
  progress: number;
}

export interface Thumb {
  t: number;
  url: string;
}

export interface Extraction {
  hookFrames: { t: number; image: string }[];
  sheets: { image: string; times: number[] }[];
  signals: MeasuredSignals;
  /** Small frames for the timeline, kept in this tab only. */
  thumbs: Thumb[];
}

export class ExtractError extends Error {}

const SAMPLE_RATE = 16_000;
const LOUDNESS_STEP = 0.1;
/** Tiny greyscale frames for motion maths. */
const GRAY_W = 48;
/** Opening frames sent at this width (higher detail: the hook matters most). */
const HOOK_W = 540;
/** Contact-sheet cell width. */
const CELL_W = 300;
const THUMB_W = 54;
/** Body frames start after the opening, which the hook frames already cover. */
const BODY_FROM_SEC = 3.25;

interface Options {
  maxDurationSec: number;
  maxBodyFrames: number;
  /** Spoken language for transcription. */
  language: 'en' | 'bn';
  onProgress: (p: ExtractProgress) => void;
  signal?: AbortSignal;
}

export async function extractShort(file: File, options: Options): Promise<Extraction> {
  const { onProgress } = options;
  onProgress({ step: 'read', progress: 0 });
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await waitFor(video, 'loadeddata', 20_000, 'This file can’t be played in your browser. Try an MP4 (H.264) file.');
    const dur = video.duration;
    if (!Number.isFinite(dur) || dur <= 0) throw new ExtractError('Could not read the length of this video. Try exporting it again as MP4.');
    if (dur > Math.min(options.maxDurationSec, RULES.maxDurationSec) + 0.5) {
      throw new ExtractError(`This video is ${Math.round(dur)} seconds long. Shorts up to ${options.maxDurationSec} seconds can be checked.`);
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new ExtractError('This file has no video picture we can read.');

    const frames = await readFrames(video, dur, width, height, options);
    if (options.signal?.aborted) throw new ExtractError('Cancelled.');

    onProgress({ step: 'audio', progress: 0 });
    let samples: Float32Array | null = null;
    try {
      samples = await decodeToMono(file, SAMPLE_RATE);
    } catch {
      samples = null; // no audio track, or a codec the browser can't decode
    }
    const levels = samples ? audioLevels(samples, SAMPLE_RATE, LOUDNESS_STEP) : { loudness: Array(Math.ceil(dur / LOUDNESS_STEP)).fill(-90), clippingPct: 0 };
    onProgress({ step: 'audio', progress: 1 });

    onProgress({ step: 'speech', progress: 0 });
    let speech: MeasuredSignals['speech'] = [];
    if (samples && levels.loudness.some((db) => db > RULES.silenceDb)) {
      const result = await transcribeAudioWithWhisper(encodeMonoWav(samples, SAMPLE_RATE), { language: options.language });
      speech = speechRuns(result.words, result.segments).filter((r) => r.start < dur);
    }
    onProgress({ step: 'speech', progress: 1 });

    return {
      hookFrames: frames.hookFrames,
      sheets: frames.sheets,
      thumbs: frames.thumbs,
      signals: {
        durationSec: round(dur, 2),
        width,
        height,
        letterboxed: frames.letterboxed,
        motionStep: frames.motionStep,
        motion: frames.motion,
        cuts: detectCuts(frames.motion, frames.motionStep),
        loudnessStep: LOUDNESS_STEP,
        loudness: levels.loudness,
        clippingPct: levels.clippingPct,
        loopSimilarity: frames.loopSimilarity,
        speech,
        speechLanguage: options.language,
      },
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Only the small timeline frames, for a report restored after a reload (sessionStorage can't hold
 * images). Local and free: nothing is sent anywhere.
 */
export async function extractThumbs(file: File, onProgress?: (progress: number) => void): Promise<Thumb[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await waitFor(video, 'loadeddata', 20_000, 'This file can’t be played in your browser.');
    const dur = video.duration;
    const thumb = canvas(THUMB_W, Math.round((THUMB_W * video.videoHeight) / video.videoWidth));
    const times = range(0, dur, Math.max(1, dur / 120));
    const thumbs: Thumb[] = [];
    for (let i = 0; i < times.length; i++) {
      await seek(video, times[i]);
      thumb.ctx.drawImage(video, 0, 0, thumb.el.width, thumb.el.height);
      thumbs.push({ t: times[i], url: thumb.el.toDataURL('image/jpeg', 0.6) });
      onProgress?.((i + 1) / times.length);
    }
    return thumbs;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** One pass over the video in time order: motion samples, hook frames, contact sheets and thumbnails. */
async function readFrames(video: HTMLVideoElement, dur: number, width: number, height: number, options: Options) {
  const motionStep = round(Math.max(0.25, dur / 600), 2);
  const motionTimes = range(0, dur, motionStep);
  const hookTimes = HOOK_TIMES.filter((t) => t < dur - 0.05);
  const bodyFrom = dur > BODY_FROM_SEC * 2 ? BODY_FROM_SEC : 0;
  const bodyCount = Math.max(1, Math.min(options.maxBodyFrames, Math.floor(dur - bodyFrom)));
  const bodyGap = (dur - bodyFrom) / bodyCount;
  const bodyTimes = Array.from({ length: bodyCount }, (_, i) => round(bodyFrom + (i + 0.5) * bodyGap, 2));
  const thumbTimes = range(0, dur, Math.max(1, dur / 120));

  const tag = new Map<number, Set<'motion' | 'hook' | 'body' | 'thumb'>>();
  const add = (t: number, kind: 'motion' | 'hook' | 'body' | 'thumb') => {
    const key = round(Math.min(t, dur - 0.05), 2);
    if (!tag.has(key)) tag.set(key, new Set());
    tag.get(key)!.add(kind);
  };
  motionTimes.forEach((t) => add(t, 'motion'));
  hookTimes.forEach((t) => add(t, 'hook'));
  bodyTimes.forEach((t) => add(t, 'body'));
  thumbTimes.forEach((t) => add(t, 'thumb'));
  const times = Array.from(tag.keys()).sort((a, b) => a - b);

  const grayH = Math.max(1, Math.round((GRAY_W * height) / width));
  const gray = canvas(GRAY_W, grayH);
  const hook = canvas(HOOK_W, Math.round((HOOK_W * height) / width));
  const thumb = canvas(THUMB_W, Math.round((THUMB_W * height) / width));
  const cellH = Math.round((CELL_W * height) / width);

  const motion: number[] = [];
  const hookFrames: { t: number; image: string }[] = [];
  const thumbs: Thumb[] = [];
  const bodyCells: { t: number; bitmap: ImageBitmap | HTMLCanvasElement }[] = [];
  const boxSamples: Uint8Array[] = [];
  let prev: Uint8ClampedArray | null = null;
  let first: Uint8ClampedArray | null = null;
  let last: Uint8ClampedArray | null = null;

  for (let i = 0; i < times.length; i++) {
    if (options.signal?.aborted) throw new ExtractError('Cancelled.');
    const t = times[i];
    const kinds = tag.get(t)!;
    await seek(video, t);

    if (kinds.has('motion')) {
      gray.ctx.drawImage(video, 0, 0, GRAY_W, grayH);
      const rgba = gray.ctx.getImageData(0, 0, GRAY_W, grayH).data;
      motion.push(prev ? round(frameChange(prev, rgba), 4) : 0);
      prev = rgba;
      first = first ?? rgba;
      last = rgba;
      if (kinds.has('body') && boxSamples.length < 12) boxSamples.push(toGray(rgba));
    }
    if (kinds.has('hook')) {
      hook.ctx.drawImage(video, 0, 0, hook.el.width, hook.el.height);
      hookFrames.push({ t, image: hook.el.toDataURL('image/jpeg', 0.72) });
    }
    if (kinds.has('body')) {
      const cell = canvas(CELL_W, cellH);
      cell.ctx.drawImage(video, 0, 0, CELL_W, cellH);
      bodyCells.push({ t, bitmap: cell.el });
    }
    if (kinds.has('thumb')) {
      thumb.ctx.drawImage(video, 0, 0, thumb.el.width, thumb.el.height);
      thumbs.push({ t, url: thumb.el.toDataURL('image/jpeg', 0.6) });
    }
    options.onProgress({ step: 'frames', progress: (i + 1) / times.length });
  }

  return {
    motionStep,
    motion,
    hookFrames,
    sheets: buildSheets(bodyCells, CELL_W, cellH),
    thumbs,
    letterboxed: isLetterboxed(boxSamples, GRAY_W, grayH),
    loopSimilarity: first && last ? round(1 - frameChange(first, last), 3) : 0,
  };
}

/** 3×3 grids, each cell stamped with its time so the model can tell the order. */
function buildSheets(cells: { t: number; bitmap: CanvasImageSource }[], cellW: number, cellH: number) {
  const sheets: { image: string; times: number[] }[] = [];
  for (let start = 0; start < cells.length; start += SHEET_CELLS) {
    const group = cells.slice(start, start + SHEET_CELLS);
    const sheet = canvas(cellW * SHEET_COLS, cellH * SHEET_ROWS);
    sheet.ctx.fillStyle = '#000';
    sheet.ctx.fillRect(0, 0, sheet.el.width, sheet.el.height);
    group.forEach((cell, i) => {
      const x = (i % SHEET_COLS) * cellW;
      const y = Math.floor(i / SHEET_COLS) * cellH;
      sheet.ctx.drawImage(cell.bitmap, x, y, cellW, cellH);
      sheet.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      sheet.ctx.fillRect(x + 4, y + 4, 64, 24);
      sheet.ctx.fillStyle = '#fff';
      sheet.ctx.font = 'bold 16px sans-serif';
      sheet.ctx.fillText(`${cell.t.toFixed(1)}s`, x + 9, y + 22);
    });
    sheets.push({ image: sheet.el.toDataURL('image/jpeg', 0.7), times: group.map((c) => c.t) });
  }
  return sheets;
}

function canvas(width: number, height: number) {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new ExtractError('Your browser could not prepare the frames.');
  return { el, ctx };
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let t = from; t < to - 0.01; t += step) out.push(round(t, 2));
  return out;
}

function waitFor(video: HTMLVideoElement, event: 'loadeddata', timeoutMs: number, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) return resolve();
    const timer = setTimeout(() => done(new ExtractError(message)), timeoutMs);
    const onOk = () => done(null);
    const onErr = () => done(new ExtractError(message));
    function done(err: Error | null) {
      clearTimeout(timer);
      video.removeEventListener(event, onOk);
      video.removeEventListener('error', onErr);
      if (err) reject(err);
      else resolve();
    }
    video.addEventListener(event, onOk);
    video.addEventListener('error', onErr);
  });
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0.001, t);
    if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) return resolve();
    const timer = setTimeout(finish, 3000); // a frame that never seeks is drawn as-is
    function finish() {
      clearTimeout(timer);
      video.removeEventListener('seeked', finish);
      resolve();
    }
    video.addEventListener('seeked', finish);
    video.currentTime = target;
  });
}
