/**
 * export-worker.ts — renders and encodes the final video off the main thread.
 *
 * Draws every frame on an OffscreenCanvas, encodes with WebCodecs (H.264 + AAC/Opus) and
 * streams the MP4 back in chunks, so the page stays responsive and the finished file is
 * never held in this worker's memory. Scene images are decoded only while they are on
 * screen (current + next shot) and released right after.
 *
 * Also renders each shot as its own short silent MP4 ('clips'), for the editor timeline package.
 */

import { ArrayBufferTarget, Muxer, StreamTarget } from 'mp4-muxer';
import type { VideoLook } from '@/types';
import { coverSize, LookPainter, renderShotFrame, type FrameImage } from './export-frame';
import { shotIndexAt, type Shot } from './shot-planner';

export interface WorkerStartMessage {
  type: 'start';
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  bitrate: number;
  /** The edit: which image is on screen when, how it's framed and moved, and how shots join. */
  shots: Shot[];
  look: VideoLook;
  images: { sceneId: number; blob: Blob }[];
  /** Stereo samples at 44.1 kHz, or null for a silent video. */
  audio: { left: Float32Array; right: Float32Array } | null;
  /** 'file': written to disk by position (normal MP4). 'memory': appended in order (fragmented MP4). */
  container: 'file' | 'memory';
}

/** Renders every shot as a separate clip, exactly its frames on the full timeline, with no transitions. */
export interface WorkerClipsMessage {
  type: 'clips';
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  shots: Shot[];
  look: VideoLook;
  images: { sceneId: number; blob: Blob }[];
}

export type WorkerInMessage = WorkerStartMessage | WorkerClipsMessage | { type: 'cancel' };

export type WorkerOutMessage =
  | { type: 'unsupported'; reason: string }
  | { type: 'data'; data: Uint8Array; position: number }
  | { type: 'progress'; frame: number }
  | { type: 'clip'; index: number; data: ArrayBuffer }
  | { type: 'done' }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

const AUDIO_SAMPLE_RATE = 44100;
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_QUEUE = 8;
const YIELD_EVERY_FRAMES = 10;
const PROGRESS_EVERY_FRAMES = 15;

const scope = self as unknown as {
  postMessage(message: WorkerOutMessage, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerInMessage>) => void) | null;
};

let cancelled = false;

function post(message: WorkerOutMessage, transfer?: Transferable[]) {
  scope.postMessage(message, transfer);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class CancelledError extends Error {}

scope.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (msg.type === 'start' || msg.type === 'clips') {
    cancelled = false;
    (msg.type === 'start' ? render(msg) : renderClips(msg)).then(
      () => post({ type: 'done' }),
      (err) => {
        if (err instanceof CancelledError) post({ type: 'cancelled' });
        else post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    );
  }
};

/** The first H.264 profile this device can encode, on the hardware encoder when there is one. */
async function pickVideoConfig(width: number, height: number, bitrate: number, framerate: number): Promise<VideoEncoderConfig | null> {
  const candidates = [
    'avc1.4d002a', // Main Profile Level 4.2
    'avc1.640028', // High Profile Level 4.0
    'avc1.420028', // Baseline Level 4.0
    'avc1.42001f', // Baseline Level 3.1
  ];
  for (const hardwareAcceleration of ['prefer-hardware', 'no-preference'] as const) {
    for (const codec of candidates) {
      const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate, hardwareAcceleration };
      try {
        if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
      } catch {
        // try the next one
      }
    }
  }
  return null;
}

async function pickAudioCodec(): Promise<{ codec: string; muxer: 'aac' | 'opus'; bitrate: number } | null> {
  const options = [
    { codec: 'mp4a.40.2', muxer: 'aac' as const, bitrate: 192000 },
    { codec: 'opus', muxer: 'opus' as const, bitrate: 128000 },
  ];
  for (const o of options) {
    try {
      const check = await AudioEncoder.isConfigSupported({ codec: o.codec, sampleRate: AUDIO_SAMPLE_RATE, numberOfChannels: 2, bitrate: o.bitrate });
      if (check.supported) return o;
    } catch {
      // try the next one
    }
  }
  return null;
}

/** Keeps decoded images for the scenes on screen only; everything else stays a compressed Blob. */
class SceneImages {
  private blobs = new Map<number, Blob>();
  private ready = new Map<number, FrameImage>();
  private failed = new Set<number>();

  constructor(images: { sceneId: number; blob: Blob }[], private width: number, private height: number) {
    for (const i of images) this.blobs.set(i.sceneId, i.blob);
  }

  get map(): Map<number, FrameImage> {
    return this.ready;
  }

  /** Decodes the wanted scenes' images and closes every other decoded one. */
  async keepOnly(sceneIds: number[]) {
    this.ready.forEach((img, id) => {
      if (!sceneIds.includes(id)) {
        (img as ImageBitmap).close();
        this.ready.delete(id);
      }
    });
    for (const id of sceneIds) {
      if (this.ready.has(id) || this.failed.has(id)) continue;
      const blob = this.blobs.get(id);
      if (!blob) continue;
      try {
        this.ready.set(id, await this.decode(blob));
      } catch {
        this.failed.add(id); // drawn as black, like a missing image
      }
    }
  }

  private async decode(blob: Blob): Promise<ImageBitmap> {
    const bitmap = await createImageBitmap(blob);
    const target = coverSize(bitmap.width, bitmap.height, this.width, this.height);
    // Only shrink: a bigger source costs every frame, a smaller one is upscaled by drawImage anyway.
    if (bitmap.width <= target.width) return bitmap;
    const scaled = await createImageBitmap(bitmap, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' });
    bitmap.close();
    return scaled;
  }

  closeAll() {
    this.ready.forEach((img) => (img as ImageBitmap).close());
    this.ready.clear();
  }
}

async function encodeAudio(muxer: Muxer<StreamTarget>, audio: { left: Float32Array; right: Float32Array }, codec: { codec: string; bitrate: number }) {
  let failure: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => {
      failure = err;
    },
  });
  encoder.configure({ codec: codec.codec, sampleRate: AUDIO_SAMPLE_RATE, numberOfChannels: 2, bitrate: codec.bitrate });

  const { left, right } = audio;
  const chunkSize = 2048; // Multiple of 1024 for AAC
  const isAac = codec.codec === 'mp4a.40.2';
  for (let offset = 0; offset < left.length; ) {
    if (cancelled) {
      encoder.close();
      throw new CancelledError();
    }
    if (failure) throw failure;
    const frames = Math.min(chunkSize, left.length - offset);
    // Pad to multiple of 1024 for strict AAC encoder compliance
    const padded = isAac ? Math.ceil(frames / 1024) * 1024 : frames;
    const planar = new Float32Array(padded * 2);
    planar.set(left.subarray(offset, offset + frames), 0);
    planar.set(right.subarray(offset, offset + frames), padded);
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfFrames: padded,
      numberOfChannels: 2,
      timestamp: Math.round((offset / AUDIO_SAMPLE_RATE) * 1_000_000),
      data: planar,
    });
    encoder.encode(data);
    data.close();
    offset += frames;
    if (encoder.encodeQueueSize > 30) await pause(5);
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
}

/** Encoder config and drawing surface, or null after telling the page this worker can't render. */
async function prepare(job: { width: number; height: number; bitrate: number; fps: number }) {
  if (typeof OffscreenCanvas === 'undefined' || typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    post({ type: 'unsupported', reason: 'WebCodecs or OffscreenCanvas is not available in workers.' });
    return null;
  }
  const videoConfig = await pickVideoConfig(job.width, job.height, job.bitrate, job.fps);
  if (!videoConfig) {
    post({ type: 'unsupported', reason: 'No H.264 encoder for this resolution.' });
    return null;
  }
  const canvas = new OffscreenCanvas(job.width, job.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    post({ type: 'unsupported', reason: 'OffscreenCanvas 2D context is not available.' });
    return null;
  }
  return { videoConfig, canvas, ctx };
}

async function renderClips(job: WorkerClipsMessage) {
  const ready = await prepare(job);
  if (!ready) return;
  const { videoConfig, canvas, ctx } = ready;
  const images = new SceneImages(job.images, job.width, job.height);
  const look = new LookPainter(job.look, job.width, job.height);
  const keyFrameEvery = job.fps * 2;
  let framesDone = 0;

  try {
    for (let k = 0; k < job.shots.length; k++) {
      // Frame boundaries rounded from the shared timeline, so the clips placed back to back
      // add up to exactly the full video and stay in sync with the narration.
      const first = Math.round(job.shots[k].start * job.fps);
      const last = Math.round(job.shots[k].end * job.fps);
      if (last <= first) continue;
      // The shot alone, so nothing of its neighbours is blended in.
      const alone: Shot[] = [{ ...job.shots[k], transitionIn: 'cut', transitionSec: 0 }];
      await images.keepOnly([alone[0].sceneId]);

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: job.width, height: job.height, frameRate: job.fps },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });
      let failure: unknown = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (err) => {
          failure = err;
        },
      });
      encoder.configure(videoConfig);
      try {
        for (let f = first; f < last; f++) {
          if (cancelled) throw new CancelledError();
          if (failure) throw failure;
          renderShotFrame(ctx, images.map, alone, job.width, job.height, f / job.fps, look, f);
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(((f - first) / job.fps) * 1_000_000),
            duration: Math.round((1 / job.fps) * 1_000_000),
          });
          encoder.encode(frame, { keyFrame: (f - first) % keyFrameEvery === 0 });
          frame.close();
          while (encoder.encodeQueueSize > MAX_VIDEO_QUEUE) await pause(2);
          framesDone++;
          if (framesDone % YIELD_EVERY_FRAMES === 0) await pause(0);
          if (framesDone % PROGRESS_EVERY_FRAMES === 0) post({ type: 'progress', frame: framesDone });
        }
        await encoder.flush();
        if (failure) throw failure;
      } finally {
        if (encoder.state !== 'closed') encoder.close();
      }
      muxer.finalize();
      post({ type: 'clip', index: k, data: target.buffer }, [target.buffer]);
    }
  } finally {
    images.closeAll();
  }
}

async function render(job: WorkerStartMessage) {
  const ready = await prepare(job);
  if (!ready) return;
  const { videoConfig, canvas, ctx } = ready;
  const audioCodec = job.audio && typeof AudioEncoder !== 'undefined' ? await pickAudioCodec() : null;

  const target = new StreamTarget({
    // The muxer may reuse its buffer, so a copy is transferred.
    onData: (data, position) => {
      const copy = data.slice();
      post({ type: 'data', data: copy, position }, [copy.buffer]);
    },
    chunked: true,
    chunkSize: CHUNK_SIZE,
  });
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: job.width, height: job.height, frameRate: job.fps },
    audio: audioCodec ? { codec: audioCodec.muxer, numberOfChannels: 2, sampleRate: AUDIO_SAMPLE_RATE } : undefined,
    fastStart: job.container === 'file' ? false : 'fragmented',
    firstTimestampBehavior: 'offset',
  });

  const images = new SceneImages(job.images, job.width, job.height);
  let videoFailure: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      videoFailure = err;
    },
  });
  videoEncoder.configure(videoConfig);
  const keyFrameEvery = job.fps * 2; // a keyframe every 2 seconds

  try {
    if (job.audio && audioCodec) {
      try {
        await encodeAudio(muxer, job.audio, audioCodec);
      } catch (err) {
        if (err instanceof CancelledError) throw err;
        console.warn('[export-worker] Audio encoding failed, the video continues without it:', err);
      }
    }
    job.audio = null; // release the samples before the long video pass

    const look = new LookPainter(job.look, job.width, job.height);
    let shownIdx = -1;
    for (let f = 0; f < job.totalFrames; f++) {
      if (cancelled) throw new CancelledError();
      if (videoFailure) throw videoFailure;

      const t = f / job.fps;
      const idx = job.shots.length > 0 ? shotIndexAt(job.shots, t) : -1;
      if (idx !== shownIdx && idx >= 0) {
        await images.keepOnly(job.shots.slice(idx, idx + 2).map((s) => s.sceneId));
        shownIdx = idx;
      }

      renderShotFrame(ctx, images.map, job.shots, job.width, job.height, t, look, f);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(t * 1_000_000),
        duration: Math.round((1 / job.fps) * 1_000_000),
      });
      videoEncoder.encode(frame, { keyFrame: f % keyFrameEvery === 0 });
      frame.close();

      // Back-pressure: wait for the encoder instead of queuing frames in memory.
      while (videoEncoder.encodeQueueSize > MAX_VIDEO_QUEUE) await pause(2);
      // Let the cancel message through.
      if (f % YIELD_EVERY_FRAMES === 0) await pause(0);
      if (f % PROGRESS_EVERY_FRAMES === 0 || f === job.totalFrames - 1) post({ type: 'progress', frame: f + 1 });
    }

    await videoEncoder.flush();
    if (videoFailure) throw videoFailure;
    videoEncoder.close();
    muxer.finalize();
  } catch (err) {
    if (videoEncoder.state !== 'closed') videoEncoder.close();
    throw err;
  } finally {
    images.closeAll();
  }
}
