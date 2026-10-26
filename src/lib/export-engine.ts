/**
 * export-engine.ts — Pure Web SaaS Video Export Engine
 *
 * Provides:
 *  1. Worker rendering: frames are drawn and encoded in a Web Worker (OffscreenCanvas + WebCodecs),
 *     so the page never freezes, and the MP4 is streamed to disk (File System Access) or kept as
 *     small Blob parts instead of one big in-memory buffer. See export-worker.ts.
 *  2. Fallback: the same single-pass WebCodecs encoder on the main thread (yielding every 10 frames),
 *     then MediaRecorder, for browsers without WebCodecs in workers.
 *  3. Ken Burns & Transition Animations: Smooth crossfade and pan/zoom cinema effects.
 *  4. Direct Browser Download: Saves rendered MP4 directly to user's Downloads folder.
 */

import type {
  AudioChunk,
  ExportResolution,
  SceneItem,
  ExportSettings,
  ExportProgress,
  TransitionType,
} from '@/types';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { getMediaBlob } from '@/lib/media-storage';
import { LookPainter, measureFocus, renderShotFrame, type FrameImage } from '@/lib/export-frame';
import { maxZoomFor, planShots, type ImageFocus, type PlannerScene, type Shot, type SpokenWord } from '@/lib/shot-planner';
import type { WorkerClipsMessage, WorkerOutMessage, WorkerStartMessage } from '@/lib/export-worker';

/** Output frame size for a resolution and aspect ratio. */
export function outputDimensions(settings: Pick<ExportSettings, 'resolution' | 'aspectRatio'>): { width: number; height: number } {
  const ratio = settings.aspectRatio ?? '16:9';
  const base = { '720p': 720, '1080p': 1080, '4k': 2160 }[settings.resolution] ?? 1080;
  const long = Math.round((base * 16) / 9);
  if (ratio === '9:16') return { width: base, height: long };
  if (ratio === '1:1') return { width: base, height: base };
  return { width: long, height: base };
}

export function exportFps(settings: Pick<ExportSettings, 'fps'>): number {
  return settings.fps ?? 30;
}

/** YouTube's recommended upload bitrates (SDR), scaled down for 24 fps. */
export function videoBitrateFor(resolution: ExportResolution, fps = 30): number {
  const at30 = { '720p': 5_000_000, '1080p': 8_000_000, '4k': 25_000_000 }[resolution] ?? 8_000_000;
  return Math.round((at30 * fps) / 30);
}

/** Videos at least this long are written straight to a file the user picks (when the browser can). */
const SAVE_TO_FILE_MIN_SEC = 180;

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

/** Worker rendering needs WebCodecs, OffscreenCanvas and image decoding off the main thread. */
function canRenderInWorker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  );
}

/**
 * Renders and encodes a short test clip in the export worker and returns this device's speed in
 * frames per second at the given size (null when worker rendering isn't available). The test image
 * is detailed noise, so the encoder works about as hard as on real scene art.
 */
export async function measureRenderSpeed(size: { width: number; height: number }, fps = 30, frames = 60): Promise<number | null> {
  if (!canRenderInWorker()) return null;
  const art = new OffscreenCanvas(1024, 576);
  const artCtx = art.getContext('2d');
  if (!artCtx) return null;
  const pixels = artCtx.createImageData(1024, 576);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = Math.random() * 255;
    pixels.data[i] = v;
    pixels.data[i + 1] = (v + (i % 4096) / 16) % 255;
    pixels.data[i + 2] = 255 - v;
    pixels.data[i + 3] = 255;
  }
  artCtx.putImageData(pixels, 0, 0);
  const blob = await art.convertToBlob({ type: 'image/jpeg', quality: 0.9 });

  const durationSec = frames / fps;
  const job: WorkerStartMessage = {
    type: 'start',
    width: size.width,
    height: size.height,
    fps,
    totalFrames: frames,
    bitrate: 8_000_000,
    // Two scenes joined by a crossfade (two images drawn per frame) with the film look on: the
    // heaviest frames a real render draws, so estimates err on the slow side.
    shots: planShots(
      [
        { sceneId: 1, audioStartSec: 0, audioEndSec: durationSec * 0.6, cutPace: 'ATMOSPHERIC_HOLD' },
        { sceneId: 2, audioStartSec: durationSec * 0.6, audioEndSec: durationSec, cutPace: 'NORMAL' },
      ],
      { totalDurationSec: durationSec, maxZoom: 1.6, transitionType: 'crossfade', crossfadeSec: 0.6 }
    ),
    look: 'film',
    images: [{ sceneId: 1, blob }, { sceneId: 2, blob }],
    audio: null,
    container: 'memory',
  };

  return new Promise<number | null>((resolve) => {
    const worker = new Worker(new URL('./export-worker.ts', import.meta.url), { type: 'module' });
    let firstFrameAt = 0;
    const done = (speed: number | null) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(speed);
    };
    const timer = setTimeout(() => done(null), 30_000);
    worker.onerror = () => done(null);
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      // Timed from the first frame, so encoder start-up isn't counted against the device.
      if (msg.type === 'progress' && firstFrameAt === 0) firstFrameAt = performance.now();
      else if (msg.type === 'done' && firstFrameAt > 0) done((frames - 1) / Math.max(0.001, (performance.now() - firstFrameAt) / 1000));
      else if (msg.type === 'unsupported' || msg.type === 'error' || msg.type === 'done') done(null);
    };
    worker.postMessage(job);
  });
}

/** Keeps the screen (and so the computer) awake during a long render; re-acquired when the tab comes back. */
async function keepAwake(): Promise<() => void> {
  type WakeLock = { release(): Promise<void> };
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLock> } }) : null;
  if (!nav?.wakeLock) return () => {};
  let lock: WakeLock | null = null;
  let active = true;
  const acquire = async () => {
    try {
      lock = await nav.wakeLock!.request('screen');
    } catch {
      lock = null; // e.g. battery saver: rendering still works, the screen may just sleep
    }
  };
  // The browser drops the lock when the tab is hidden.
  const onVisible = () => {
    if (active && document.visibilityState === 'visible') acquire();
  };
  await acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisible);
    lock?.release().catch(() => {});
  };
}

function videoFileName(projectTitle: string, resolution: string): string {
  return `${(projectTitle || 'video').replace(/[^a-zA-Z0-9_-]/g, '_')}_${resolution}.mp4`;
}

function triggerDownload(url: string, fileName: string) {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); }, 2000);
}

/** Where the worker's MP4 bytes go: a file on disk (by position) or Blob parts (in order). */
interface VideoSink {
  write(data: Uint8Array, position: number): Promise<void>;
  /** Returns a URL for the finished video. */
  finish(): Promise<string>;
  /** Drops what was written; `removeFile: false` keeps the picked file for the fallback renderer. */
  abort(removeFile?: boolean): Promise<void>;
}

class FileSink implements VideoSink {
  private constructor(private handle: FileSystemFileHandle, private writable: FileSystemWritableFileStream) {}

  static async open(handle: FileSystemFileHandle): Promise<FileSink> {
    return new FileSink(handle, await handle.createWritable());
  }

  write(data: Uint8Array, position: number) {
    return this.writable.write({ type: 'write', position, data: data as Uint8Array<ArrayBuffer> });
  }

  async finish() {
    await this.writable.close();
    // A File from the handle is read from disk on demand, not loaded into memory.
    return URL.createObjectURL(await this.handle.getFile());
  }

  async abort(removeFile = true) {
    await this.writable.abort().catch(() => {});
    // Chromium can delete the half-written file; elsewhere it stays empty.
    if (removeFile) await (this.handle as FileSystemFileHandle & { remove?: () => Promise<void> }).remove?.().catch(() => {});
  }
}

class BlobSink implements VideoSink {
  // Each part becomes its own Blob right away, which browsers may keep on disk.
  private parts: Blob[] = [];
  private size = 0;

  constructor(private fileName: string) {}

  async write(data: Uint8Array, position: number) {
    // Fragmented MP4 is written strictly in order.
    if (position !== this.size) throw new Error(`Video data arrived out of order (at ${position}, expected ${this.size}).`);
    this.parts.push(new Blob([data as Uint8Array<ArrayBuffer>]));
    this.size += data.byteLength;
  }

  async finish() {
    const url = URL.createObjectURL(new Blob(this.parts, { type: 'video/mp4' }));
    this.parts = [];
    triggerDownload(url, this.fileName);
    return url;
  }

  async abort() {
    this.parts = [];
  }
}


export class ExportEngine {
  private cancelled = false;
  private worker: Worker | null = null;

  public cancel() {
    this.cancelled = true;
    this.worker?.postMessage({ type: 'cancel' });
  }

  public get isCancelled(): boolean {
    return this.cancelled;
  }

  public async cleanProjectCache(projectId: string): Promise<{ freedMB: number }> {
    return { freedMB: 0 };
  }

  /**
   * Main export execution pipeline for Web SaaS
   */
  public async execute(
    projectId: string,
    audioChunks: AudioChunk[],
    scenes: SceneItem[],
    settings: ExportSettings,
    onProgress: (progress: ExportProgress) => void,
    projectTitle = 'video',
    /** Word timings of the narration, so shots cut on natural breaks (estimated from punctuation without them). */
    words?: SpokenWord[]
  ): Promise<string> {
    this.cancelled = false;

    const completedChunks = audioChunks.filter((c) => c.status === 'COMPLETED');
    const usableChunks = completedChunks.length > 0 ? completedChunks : audioChunks;

    const totalDurationMs = usableChunks.reduce((sum, c) => sum + (c.durationMs || 0), 0);
    const sceneMaxSec = scenes.length > 0 ? Math.max(...scenes.map((s) => s.audioEndSec || 0)) : 0;
    const totalDurationSec = totalDurationMs > 0
      ? totalDurationMs / 1000
      : (sceneMaxSec > 0 ? sceneMaxSec : (scenes.length > 0 ? scenes.length * 4.5 : 60));
    const fps = exportFps(settings);
    const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));

    // Asked first, while the click that started the export still counts as a user gesture.
    const saveFile = await this.pickSaveFile(totalDurationSec, projectTitle, settings);

    const releaseWakeLock = await keepAwake();
    let browserUrl: string;
    try {
      browserUrl = await this.renderFinalVideoBrowser({
        projectId,
        projectTitle,
        saveFile,
        scenes,
        words,
        audioChunks: usableChunks,
        settings,
        totalDurationSec,
        totalFrames,
        onProgress,
      });
    } finally {
      releaseWakeLock();
    }

    onProgress({
      stage: 'completed',
      percentage: 100,
      fps: 30,
      frame: totalFrames,
      totalFrames,
      etaSeconds: 0,
      currentStepMessage: saveFile ? `Render complete! Video saved as ${saveFile.name}.` : 'Render complete! Video saved to your Downloads folder.',
    });

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('AI Video Studio', { body: 'Your video export is ready and downloaded!' });
    }

    return browserUrl;
  }

  /**
   * For long videos, asks where to save so the MP4 can be written to disk while it renders
   * (RAM stays flat). Null when the video is short, the browser can't, or the user wasn't asked.
   */
  private async pickSaveFile(durationSec: number, projectTitle: string, settings: ExportSettings): Promise<FileSystemFileHandle | null> {
    const picker = typeof window !== 'undefined' ? (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker : undefined;
    if (!picker || durationSec < SAVE_TO_FILE_MIN_SEC || !canRenderInWorker()) return null;
    try {
      return await picker({
        suggestedName: videoFileName(projectTitle, settings.resolution),
        types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw new Error('Export cancelled by user.');
      return null; // e.g. the gesture expired: fall back to a normal download
    }
  }

  /**
   * Renders and encodes in export-worker.ts. Resolves to the video URL, or null when the worker
   * reports it can't run here (nothing was written yet, so the caller can fall back).
   */
  private renderInWorker(options: {
    job: Omit<WorkerStartMessage, 'type' | 'container'>;
    saveFile: FileSystemFileHandle | null;
    fileName: string;
    onStarted: () => void;
    onProgress: (progress: ExportProgress) => void;
  }): Promise<string | null> {
    const { job, saveFile, fileName, onStarted, onProgress } = options;
    const totalFrames = job.totalFrames;

    return new Promise<string | null>((resolve, reject) => {
      const worker = new Worker(new URL('./export-worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      let sink: VideoSink | null = null;
      let writes: Promise<void> = Promise.resolve();
      let started = false;
      let startedAt = 0;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        fn();
      };
      let failing = false;
      const fail = (err: unknown) => {
        if (failing || settled) return;
        failing = true;
        const error = err instanceof Error ? err : new Error(String(err));
        writes
          .catch(() => {})
          .then(() => sink?.abort())
          .finally(() => finish(() => reject(error)));
      };
      // Nothing was rendered: release the file and let the caller use the main-thread renderer.
      const fallBack = () => {
        if (settled) return;
        Promise.resolve(sink?.abort(false)).finally(() => finish(() => resolve(null)));
      };

      worker.onerror = (event) => {
        event.preventDefault();
        // The worker script itself failed to load.
        if (!started) fallBack();
        else fail(new Error(event.message || 'The video renderer stopped unexpectedly.'));
      };

      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;
        if (msg.type === 'unsupported') {
          console.warn('[ExportEngine] Worker rendering unavailable, using the main thread:', msg.reason);
          fallBack();
          return;
        }
        if (!started) {
          started = true;
          startedAt = performance.now();
          onStarted();
        }
        if (msg.type === 'data') {
          const s = sink!;
          writes = writes.then(() => s.write(msg.data, msg.position));
          writes.catch(fail);
        } else if (msg.type === 'progress') {
          const pct = Math.min(99, Math.round(20 + (msg.frame / totalFrames) * 78));
          const elapsedSec = (performance.now() - startedAt) / 1000;
          const framesPerSec = elapsedSec > 0 ? msg.frame / elapsedSec : 0;
          const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
          onProgress({
            stage: 'final_render',
            percentage: pct,
            fps: Math.round(framesPerSec),
            frame: msg.frame,
            totalFrames,
            etaSeconds: framesPerSec > 0 ? Math.round((totalFrames - msg.frame) / framesPerSec) : 0,
            currentStepMessage: `Encoding ${fmt(msg.frame / job.fps)} / ${fmt(totalFrames / job.fps)} (${pct}%)...`,
          });
        } else if (msg.type === 'done') {
          writes
            .then(() => sink!.finish())
            .then((url) => finish(() => resolve(url)), fail);
        } else if (msg.type === 'cancelled') {
          fail(new Error('Export cancelled by user.'));
        } else if (msg.type === 'error') {
          fail(new Error(`Video encoding failed: ${msg.message}`));
        }
      };

      (saveFile ? FileSink.open(saveFile) : Promise.resolve(new BlobSink(fileName))).then(
        (opened) => {
          sink = opened;
          if (this.cancelled) {
            fail(new Error('Export cancelled by user.'));
            return;
          }
          const start: WorkerStartMessage = { type: 'start', ...job, container: saveFile ? 'file' : 'memory' };
          const transfer: Transferable[] = job.audio ? [job.audio.left.buffer, job.audio.right.buffer] : [];
          worker.postMessage(start, transfer);
        },
        (err) => finish(() => reject(err))
      );
    });
  }

  /**
   * The edit for this render: finds each image's subject (for close-ups) and how deep it can be
   * cropped while staying sharp, then splits the scenes into shots.
   */
  private planEdit(
    scenes: SceneItem[],
    images: { sceneId: number; image: FrameImage }[],
    options: { words?: SpokenWord[]; durationSec: number; width: number; height: number; settings: ExportSettings }
  ): Shot[] {
    const focus = new Map<number, ImageFocus>();
    const shortSides: number[] = [];
    for (const { sceneId, image } of images) {
      focus.set(sceneId, measureFocus(image));
      shortSides.push(Math.min(image.width, image.height));
    }
    shortSides.sort((a, b) => a - b);
    const typicalShortSide = shortSides.length ? shortSides[Math.floor(shortSides.length / 2)] : 576;
    const plannerScenes: PlannerScene[] = scenes.map((s) => ({
      sceneId: s.sceneId,
      audioStartSec: s.audioStartSec,
      audioEndSec: s.audioEndSec,
      narrationLine: s.narrationLine,
      cutPace: s.cutPace,
      shotType: s.shotType,
      cameraMotion: s.cameraMotion,
      motionProfile: s.motionProfile,
    }));
    return planShots(plannerScenes, {
      totalDurationSec: options.durationSec,
      words: options.words,
      focus,
      maxZoom: maxZoomFor(typicalShortSide, Math.min(options.width, options.height)),
      transitionType: options.settings.transitionType ?? 'auto',
      crossfadeSec: options.settings.transitionDurationSec ?? 0.6,
    });
  }

  /** Decodes each image once to plan the edit, then releases it (the worker decodes again on demand). */
  private async planEditFromBlobs(
    scenes: SceneItem[],
    blobs: { sceneId: number; blob: Blob }[],
    options: { words?: SpokenWord[]; durationSec: number; width: number; height: number; settings: ExportSettings }
  ): Promise<Shot[]> {
    const decoded: { sceneId: number; image: ImageBitmap }[] = [];
    for (const { sceneId, blob } of blobs) {
      try {
        decoded.push({ sceneId, image: await createImageBitmap(blob) });
      } catch { }
    }
    try {
      return this.planEdit(scenes, decoded, options);
    } finally {
      decoded.forEach((d) => d.image.close());
    }
  }

  /**
   * Renders the same edit as the final video, but as one silent MP4 per shot (camera move and
   * look included, transitions left to the editor). Clips are cut on the shared frame grid, so
   * placed back to back they match the narration exactly. Null when this browser can't render
   * in a worker.
   */
  public async renderShotClips(options: {
    projectId: string;
    scenes: SceneItem[];
    settings: ExportSettings;
    words?: SpokenWord[];
    durationSec: number;
    onProgress: (framesDone: number, totalFrames: number) => void;
  }): Promise<{ shots: Shot[]; clips: (Blob | null)[]; fps: number; width: number; height: number } | null> {
    if (!canRenderInWorker()) return null;
    this.cancelled = false;
    const { projectId, settings, durationSec, onProgress } = options;
    const fps = exportFps(settings);
    const { width, height } = outputDimensions(settings);
    const sortedScenes = [...options.scenes].sort((a, b) => a.sceneId - b.sceneId);
    const images = await this.loadSceneImageBlobs(projectId, sortedScenes);
    const shots = await this.planEditFromBlobs(sortedScenes, images, { words: options.words, durationSec, width, height, settings });
    const totalFrames = Math.max(1, Math.round(durationSec * fps));

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./export-worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      const clips: (Blob | null)[] = shots.map(() => null);
      const done = (fn: () => void) => {
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        fn();
      };
      worker.onerror = (event) => {
        event.preventDefault();
        done(() => reject(new Error(event.message || 'The clip renderer stopped unexpectedly.')));
      };
      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;
        if (msg.type === 'clip') clips[msg.index] = new Blob([msg.data], { type: 'video/mp4' });
        else if (msg.type === 'progress') onProgress(msg.frame, totalFrames);
        else if (msg.type === 'done') done(() => resolve({ shots, clips, fps, width, height }));
        else if (msg.type === 'unsupported') done(() => resolve(null));
        else if (msg.type === 'cancelled') done(() => reject(new Error('Export cancelled by user.')));
        else if (msg.type === 'error') done(() => reject(new Error(`Clip rendering failed: ${msg.message}`)));
      };
      const job: WorkerClipsMessage = {
        type: 'clips',
        width,
        height,
        fps,
        bitrate: videoBitrateFor(settings.resolution, fps),
        shots,
        look: settings.look ?? 'natural',
        images,
      };
      worker.postMessage(job);
    });
  }

  /** Each scene's image as a compressed Blob (decoded later, inside the worker, only when on screen). */
  private async loadSceneImageBlobs(projectId: string, scenes: SceneItem[]): Promise<{ sceneId: number; blob: Blob }[]> {
    const loaded = await Promise.all(
      scenes.map(async (scene) => {
        let blob: Blob | null = null;
        if (scene.imageUrl) {
          try {
            const res = await fetch(scene.imageUrl);
            if (res.ok) blob = await res.blob();
          } catch { }
        }
        if (!blob) blob = await getMediaBlob(`scene_${projectId}_${scene.sceneId}`);
        return blob ? { sceneId: scene.sceneId, blob } : null;
      })
    );
    return loaded.filter((x): x is { sceneId: number; blob: Blob } => x !== null);
  }

  /** Main-thread fallback output: into the picked file, or a normal download. */
  private async deliverBlob(blob: Blob, fileName: string, saveFile: FileSystemFileHandle | null): Promise<string> {
    if (saveFile) {
      const writable = await saveFile.createWritable();
      await writable.write(blob);
      await writable.close();
      return URL.createObjectURL(await saveFile.getFile());
    }
    const url = URL.createObjectURL(blob);
    triggerDownload(url, fileName);
    return url;
  }

  /**
   * High-Performance Segmented Chunk Browser Pipeline
   */
  private async renderFinalVideoBrowser(options: {
    projectId: string;
    projectTitle: string;
    saveFile: FileSystemFileHandle | null;
    scenes: SceneItem[];
    words?: SpokenWord[];
    audioChunks: AudioChunk[];
    settings: ExportSettings;
    totalDurationSec: number;
    totalFrames: number;
    onProgress: (progress: ExportProgress) => void;
  }): Promise<string> {
    const { projectId, projectTitle, scenes, audioChunks, settings, onProgress } = options;
    const win = typeof window !== 'undefined' ? (window as any) : {};

    // ─── Step 1: Decode Master Audio Track ──────────────────────────────────────
    let masterAudioBuffer: AudioBuffer | null = null;
    const AudioContextClass = win.AudioContext || win.webkitAudioContext;
    const audioContext = typeof AudioContextClass !== 'undefined'
      ? new AudioContextClass({ sampleRate: 44100 })
      : null;

    let effectiveChunks = [...audioChunks];
    if (effectiveChunks.length === 0) {
      // Fallback: check if custom uploaded voice exists in IndexedDB
      const customBlob = await getMediaBlob(`audio_${projectId}_0`);
      if (customBlob) {
        effectiveChunks = [{
          index: 0,
          text: 'Uploaded Voice',
          filePath: `projects/${projectId}/audio/custom_voice.mp3`,
          durationMs: 0,
          status: 'COMPLETED',
        }];
      }
    }

    if (audioContext && effectiveChunks.length > 0) {
      try {
        const decodedBuffers: AudioBuffer[] = [];
        for (let i = 0; i < effectiveChunks.length; i++) {
          const chunk = effectiveChunks[i];
          const chunkIdx = chunk.index !== undefined ? chunk.index : i;
          let arrayBuffer: ArrayBuffer | null = null;

          // 1. Try persistent IndexedDB blob
          const blob = await getMediaBlob(`audio_${projectId}_${chunkIdx}`);
          if (blob) {
            arrayBuffer = await blob.arrayBuffer().catch(() => null);
          }

          // 2. Fall back to chunk.audioUrl
          if (!arrayBuffer && chunk.audioUrl) {
            try {
              const res = await fetch(chunk.audioUrl);
              if (res.ok) arrayBuffer = await res.arrayBuffer();
            } catch { }
          }

          if (arrayBuffer && arrayBuffer.byteLength > 0) {
            try {
              const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
              if (decoded) decodedBuffers.push(decoded);
            } catch (decErr) {
              console.warn(`[ExportEngine] Failed to decode audio chunk ${chunkIdx}:`, decErr);
            }
          }
        }

        if (decodedBuffers.length > 0) {
          const totalLength = decodedBuffers.reduce((acc, b) => acc + b.length, 0);
          const createdBuffer = audioContext.createBuffer(2, totalLength, 44100);
          let offset = 0;
          for (const buf of decodedBuffers) {
            const ch0 = buf.getChannelData(0);
            // If audio is mono (1 channel), clone to both Left and Right channels
            const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
            createdBuffer.getChannelData(0).set(ch0, offset);
            createdBuffer.getChannelData(1).set(ch1, offset);
            offset += buf.length;
          }
          masterAudioBuffer = createdBuffer;
        }
      } catch (err) {
        console.warn('[ExportEngine] Audio stitching fallback:', err);
      }
    }

    // ─── Step 1.5: Decode & Mix Background Music (BGM) ──────────────────────────
    if (audioContext && settings.bgmFilePath) {
      try {
        const bgmRes = await fetch(settings.bgmFilePath);
        if (bgmRes.ok) {
          const bgmArrayBuf = await bgmRes.arrayBuffer();
          const bgmBuffer = await audioContext.decodeAudioData(bgmArrayBuf.slice(0));
          const bgmVolume = typeof settings.bgmVolume === 'number' ? settings.bgmVolume : 0.15;
          const enableDucking = settings.enableAutoDucking !== false;

          if (masterAudioBuffer) {
            // Mix BGM into existing voiceover track with ducking
            const voiceLeft = masterAudioBuffer.getChannelData(0);
            const voiceRight = masterAudioBuffer.numberOfChannels > 1 ? masterAudioBuffer.getChannelData(1) : voiceLeft;
            const bgmLeft = bgmBuffer.getChannelData(0);
            const bgmRight = bgmBuffer.numberOfChannels > 1 ? bgmBuffer.getChannelData(1) : bgmLeft;

            for (let s = 0; s < masterAudioBuffer.length; s++) {
              const bgmIdx = s % bgmBuffer.length;
              const voiceAmp = Math.max(Math.abs(voiceLeft[s]), Math.abs(voiceRight[s]));
              // Duck BGM if voiceover is speaking
              const duckFactor = (enableDucking && voiceAmp > 0.03) ? 0.25 : 1.0;
              const gain = bgmVolume * duckFactor;

              voiceLeft[s] = Math.max(-1, Math.min(1, voiceLeft[s] + bgmLeft[bgmIdx] * gain));
              voiceRight[s] = Math.max(-1, Math.min(1, voiceRight[s] + bgmRight[bgmIdx] * gain));
            }
          } else {
            // No voiceover track: use BGM as master audio
            const sceneDur = scenes.length > 0 ? Math.max(...scenes.map((s) => s.audioEndSec || 0)) : 0;
            const targetSec = sceneDur > 0 ? sceneDur : (options.totalDurationSec > 0 ? options.totalDurationSec : bgmBuffer.duration);
            const targetSamples = Math.round(targetSec * 44100);
            const created = audioContext.createBuffer(2, targetSamples, 44100);
            const outL = created.getChannelData(0);
            const outR = created.getChannelData(1);
            const bgmL = bgmBuffer.getChannelData(0);
            const bgmR = bgmBuffer.numberOfChannels > 1 ? bgmBuffer.getChannelData(1) : bgmL;

            for (let s = 0; s < targetSamples; s++) {
              const bgmIdx = s % bgmBuffer.length;
              outL[s] = bgmL[bgmIdx] * bgmVolume;
              outR[s] = bgmR[bgmIdx] * bgmVolume;
            }
            masterAudioBuffer = created;
          }
        }
      } catch (bgmErr) {
        console.warn('[ExportEngine] Failed to decode/mix BGM:', bgmErr);
      }
    }

    const totalAudioDuration = masterAudioBuffer ? masterAudioBuffer.duration : 0;
    const sceneMaxSec = scenes.length > 0 ? Math.max(...scenes.map((s) => s.audioEndSec || 0)) : 0;
    const durationSec = totalAudioDuration > 0
      ? totalAudioDuration
      : (options.totalDurationSec > 0 ? options.totalDurationSec : (sceneMaxSec > 0 ? sceneMaxSec : 60));

    const renderFps = exportFps(settings);
    const totalFrames = Math.max(1, Math.round(durationSec * renderFps));

    console.log(
      `[ExportEngine] Final timeline duration: ${durationSec.toFixed(2)}s (${Math.floor(durationSec / 60)}m ${Math.round(durationSec % 60)}s), totalFrames: ${totalFrames}, audioDuration: ${totalAudioDuration.toFixed(2)}s, optionsTotalSec: ${options.totalDurationSec}s`
    );

    const { width, height } = outputDimensions(settings);

    // ─── Step 2: Worker Rendering (preferred) ──────────────────────────────────
    const sortedScenes = [...scenes].sort((a, b) => a.sceneId - b.sceneId);
    const editOptions = { words: options.words, durationSec, width, height, settings };
    const videoBitrate = videoBitrateFor(settings.resolution, renderFps);
    const fileName = videoFileName(projectTitle, settings.resolution);

    if (canRenderInWorker()) {
      onProgress({
        stage: 'video_concat',
        percentage: 15,
        fps: 0,
        frame: 0,
        totalFrames,
        etaSeconds: 0,
        currentStepMessage: `Loading scene assets for ${Math.floor(durationSec / 60)}m ${Math.round(durationSec % 60)}s timeline...`,
      });
      const images = await this.loadSceneImageBlobs(projectId, sortedScenes);
      const shots = await this.planEditFromBlobs(sortedScenes, images, editOptions);
      // Copies, so the AudioBuffer can be released once the worker has taken over.
      const audio = masterAudioBuffer
        ? {
            left: masterAudioBuffer.getChannelData(0).slice(),
            right: (masterAudioBuffer.numberOfChannels > 1 ? masterAudioBuffer.getChannelData(1) : masterAudioBuffer.getChannelData(0)).slice(),
          }
        : null;
      // Silent right channel (checked over the first second, as before): play the left in both ears.
      if (audio && !audio.right.subarray(0, 44100).some((v) => Math.abs(v) > 0.0001)) audio.right = audio.left.slice();

      const url = await this.renderInWorker({
        job: {
          width,
          height,
          fps: renderFps,
          totalFrames,
          bitrate: videoBitrate,
          shots,
          look: settings.look ?? 'natural',
          images,
          audio,
        },
        saveFile: options.saveFile,
        fileName,
        onStarted: () => {
          masterAudioBuffer = null;
          if (audioContext) audioContext.close().catch(() => { });
        },
        onProgress,
      });
      if (url) return url;
    }

    // ─── Step 2b: Pre-load Scene Images into Memory (main-thread fallback) ─────
    onProgress({
      stage: 'video_concat',
      percentage: 15,
      fps: 0,
      frame: 0,
      totalFrames,
      etaSeconds: Math.round(durationSec * 0.1),
      currentStepMessage: `Loading scene assets for ${Math.floor(durationSec / 60)}m ${Math.round(durationSec % 60)}s timeline...`,
    });

    const imageMap = new Map<number, HTMLImageElement>();

    if (typeof window !== 'undefined') {
      await Promise.all(
        sortedScenes.map(async (scene) => {
          let url = scene.imageUrl;
          if (!url) {
            const blob = await getMediaBlob(`scene_${projectId}_${scene.sceneId}`);
            if (blob) url = URL.createObjectURL(blob);
          }
          if (!url) return;

          return new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              imageMap.set(scene.sceneId, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url!;
            setTimeout(resolve, 3000);
          });
        })
      );
    }

    const shots = this.planEdit(
      sortedScenes,
      Array.from(imageMap, ([sceneId, image]) => ({ sceneId, image })),
      editOptions
    );
    const look = new LookPainter(settings.look, width, height);

    // ─── Step 3: Single-Pass WebCodecs Encoding with Main-Thread Yielding ──────────────────
    const hasWebCodecs =
      typeof win.VideoEncoder !== 'undefined' &&
      typeof win.AudioEncoder !== 'undefined' &&
      typeof win.VideoFrame !== 'undefined' &&
      typeof win.AudioData !== 'undefined';

    if (hasWebCodecs) {
      try {
        const YIELD_EVERY_FRAMES = 10; // yield every 10 frames so tab never hangs

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to create 2D canvas context');

        const target = new Mp4Target();
        const hasAudio = !!masterAudioBuffer && masterAudioBuffer.duration > 0;

        // Check supported audio codec
        let audioCodec = 'mp4a.40.2';
        let audioMuxerCodec: 'aac' | 'opus' = 'aac';
        let canEncodeAudio = false;

        if (hasAudio) {
          try {
            if (win.AudioEncoder.isConfigSupported) {
              const checkAac = await win.AudioEncoder.isConfigSupported({
                codec: 'mp4a.40.2',
                sampleRate: 44100,
                numberOfChannels: 2,
                bitrate: 192000,
              });
              if (checkAac.supported) {
                canEncodeAudio = true;
                audioCodec = 'mp4a.40.2';
                audioMuxerCodec = 'aac';
              } else {
                const checkOpus = await win.AudioEncoder.isConfigSupported({
                  codec: 'opus',
                  sampleRate: 44100,
                  numberOfChannels: 2,
                  bitrate: 128000,
                });
                if (checkOpus.supported) {
                  canEncodeAudio = true;
                  audioCodec = 'opus';
                  audioMuxerCodec = 'opus';
                }
              }
            } else {
              canEncodeAudio = true;
            }
          } catch {
            canEncodeAudio = true;
          }
        }

        const muxer = new Mp4Muxer({
          target,
          video: { codec: 'avc', width, height, frameRate: renderFps },
          audio: canEncodeAudio && hasAudio ? { codec: audioMuxerCodec, numberOfChannels: 2, sampleRate: 44100 } : undefined,
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        });

        // Negotiate highest supported H.264 Level
        const candidateCodecs = [
          'avc1.4d002a', // Main Profile Level 4.2
          'avc1.640028', // High Profile Level 4.0
          'avc1.420028', // Baseline Level 4.0
          'avc1.42001f', // Baseline Level 3.1
        ];

        let videoCodec = 'avc1.4d002a';
        for (const candidate of candidateCodecs) {
          try {
            const check = await win.VideoEncoder.isConfigSupported({
              codec: candidate,
              width,
              height,
              bitrate: videoBitrate,
            });
            if (check.supported) {
              videoCodec = candidate;
              break;
            }
          } catch { }
        }

        const videoEncoder = new win.VideoEncoder({
          output: (chunk: unknown, meta: unknown) => muxer.addVideoChunk(chunk as any, meta as any),
          error: (err: unknown) => console.error('[ExportEngine] VideoEncoder error:', err),
        });

        videoEncoder.configure({
          codec: videoCodec,
          width,
          height,
          bitrate: videoBitrate,
          framerate: renderFps,
        });

        // 1. Encode full audio track first if available
        if (canEncodeAudio && hasAudio && masterAudioBuffer) {
          try {
            const audioEncoder = new win.AudioEncoder({
              output: (chunk: unknown, meta: unknown) => muxer.addAudioChunk(chunk as any, meta as any),
              error: (err: unknown) => console.error('[ExportEngine] AudioEncoder error:', err),
            });

            audioEncoder.configure({
              codec: audioCodec,
              sampleRate: 44100,
              numberOfChannels: 2,
              bitrate: audioCodec === 'opus' ? 128000 : 192000,
            });

            const left = masterAudioBuffer.getChannelData(0);
            let right = masterAudioBuffer.numberOfChannels > 1 ? masterAudioBuffer.getChannelData(1) : left;

            // Extra safety: verify right channel has signal; if silent, clone left so both ears play sound
            let rightHasSignal = false;
            const sampleCheckCount = Math.min(44100, masterAudioBuffer.length);
            for (let k = 0; k < sampleCheckCount; k++) {
              if (Math.abs(right[k]) > 0.0001) {
                rightHasSignal = true;
                break;
              }
            }
            if (!rightHasSignal) {
              right = left;
            }
            const chunkSize = 2048; // Multiple of 1024 for AAC
            let frameOffset = 0;
            const totalSamples = masterAudioBuffer.length;

            while (frameOffset < totalSamples) {
              if (this.cancelled) {
                videoEncoder.close();
                audioEncoder.close();
                throw new Error('Export cancelled by user.');
              }

              const rawFrames = totalSamples - frameOffset;
              const curFrames = Math.min(chunkSize, rawFrames);
              // Pad to multiple of 1024 for strict AAC encoder compliance
              const paddedFrames = audioCodec === 'mp4a.40.2'
                ? Math.ceil(curFrames / 1024) * 1024
                : curFrames;

              const planarData = new Float32Array(paddedFrames * 2);
              planarData.set(left.subarray(frameOffset, frameOffset + curFrames), 0);
              planarData.set(right.subarray(frameOffset, frameOffset + curFrames), paddedFrames);

              const audioData = new win.AudioData({
                format: 'f32-planar',
                sampleRate: 44100,
                numberOfFrames: paddedFrames,
                numberOfChannels: 2,
                timestamp: Math.round((frameOffset / 44100) * 1_000_000),
                data: planarData,
              });

              audioEncoder.encode(audioData);
              audioData.close();
              frameOffset += curFrames;

              if (audioEncoder.encodeQueueSize > 30) {
                await new Promise((r) => setTimeout(r, 5));
              }
            }

            await audioEncoder.flush();
            audioEncoder.close();
          } catch (audioEncErr) {
            console.warn('[ExportEngine] Audio encoding warning (video will proceed):', audioEncErr);
          }
        }

        // 2. Encode all video frames with periodic main-thread yield
        for (let f = 0; f < totalFrames; f++) {
          if (this.cancelled) {
            videoEncoder.close();
            throw new Error('Export cancelled by user.');
          }

          const t = f / renderFps;

          renderShotFrame(ctx, imageMap, shots, width, height, t, look, f);

          const vFrame = new win.VideoFrame(canvas, {
            timestamp: Math.round(t * 1_000_000),
            duration: Math.round((1 / renderFps) * 1_000_000),
          });
          videoEncoder.encode(vFrame, { keyFrame: f % 60 === 0 });
          vFrame.close();

          // Yield to browser main thread every N frames — keeps tab responsive
          if (f % YIELD_EVERY_FRAMES === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }

          // Back-pressure: pause if encoder falls behind
          if (videoEncoder.encodeQueueSize > 20) {
            await new Promise((r) => setTimeout(r, 5));
          }

          // Progress update every 30 frames (1s of video)
          if (f % 30 === 0 || f === totalFrames - 1) {
            const pct = Math.min(99, Math.round(20 + ((f + 1) / totalFrames) * 78));
            const currentSec = Math.floor((f + 1) / renderFps);
            const totalSec = Math.floor(totalFrames / renderFps);
            const currentFormatted = `${Math.floor(currentSec / 60)}:${String(currentSec % 60).padStart(2, '0')}`;
            const totalFormatted = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;

            onProgress({
              stage: 'final_render',
              percentage: pct,
              fps: 30,
              frame: f + 1,
              totalFrames,
              etaSeconds: Math.max(0, Math.round(((totalFrames - f - 1) / renderFps) * 0.12)),
              currentStepMessage: `Encoding ${currentFormatted} / ${totalFormatted} (${pct}%)...`,
            });
          }
        }

        await videoEncoder.flush();
        videoEncoder.close();
        muxer.finalize();

        const finalMp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
        if (audioContext) audioContext.close().catch(() => { });
        return await this.deliverBlob(finalMp4Blob, fileName, options.saveFile);
      } catch (encodeErr) {
        console.warn('[ExportEngine] WebCodecs encoding error, falling back to MediaRecorder:', encodeErr);
      }
    }

    // ─── Step 4: Fallback MediaRecorder Pipeline ──────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });

    const canvasStream = canvas.captureStream ? canvas.captureStream(renderFps) : null;
    const streamTracks: MediaStreamTrack[] = [];
    if (canvasStream) streamTracks.push(...canvasStream.getVideoTracks());

    let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
    let audioSourceNode: AudioBufferSourceNode | null = null;
    if (masterAudioBuffer && audioContext) {
      const dest = audioContext.createMediaStreamDestination();
      const srcNode = audioContext.createBufferSource();
      srcNode.buffer = masterAudioBuffer;
      srcNode.connect(dest);
      mediaStreamDest = dest;
      audioSourceNode = srcNode;
      streamTracks.push(...dest.stream.getAudioTracks());
    }

    const combinedStream = new MediaStream(streamTracks);
    let mimeType = 'video/webm';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
        mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      }
    }

    const recordedBlobs: Blob[] = [];
    let recorder: MediaRecorder | null = null;

    if (typeof MediaRecorder !== 'undefined' && canvasStream) {
      try {
        recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: videoBitrate,
        });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedBlobs.push(e.data);
        };
        recorder.start(100);
        if (audioSourceNode) audioSourceNode.start(0);
      } catch (recErr) {
        console.warn('[ExportEngine] MediaRecorder init error:', recErr);
      }
    }

    for (let f = 0; f < totalFrames; f++) {
      if (this.cancelled) {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        if (audioSourceNode) { try { audioSourceNode.stop(); } catch { } }
        throw new Error('Export cancelled by user.');
      }

      const t = f / renderFps;
      if (ctx) {
        renderShotFrame(ctx, imageMap, shots, width, height, t, look, f);
      }

      if (f % 15 === 0 || f === totalFrames - 1) {
        const pct = Math.min(99, Math.round(20 + ((f + 1) / totalFrames) * 78));
        const currentSec = Math.floor((f + 1) / renderFps);
        const totalSec = Math.floor(totalFrames / renderFps);
        const currentFormatted = `${Math.floor(currentSec / 60)}:${String(currentSec % 60).padStart(2, '0')}`;
        const totalFormatted = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;

        onProgress({
          stage: 'final_render',
          percentage: pct,
          fps: 30,
          frame: f + 1,
          totalFrames,
          etaSeconds: Math.max(0, Math.round(((totalFrames - f) / totalFrames) * 15)),
          currentStepMessage: `Rendering ${currentFormatted} / ${totalFormatted} (${pct}%)...`,
        });
        await new Promise((r) => setTimeout(r, 16));
      }
    }

    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder!.onstop = () => resolve();
        recorder!.stop();
      });
    }
    if (audioSourceNode) { try { audioSourceNode.stop(); } catch { } }

    const finalBlob = recordedBlobs.length > 0
      ? new Blob(recordedBlobs, { type: mimeType })
      : new Blob([], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(finalBlob);

    const cleanTitle = (projectTitle || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadFileName = `${cleanTitle}_${settings.resolution}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;

    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadFileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 2000);
    }

    if (audioContext) audioContext.close().catch(() => { });
    return blobUrl;
  }
}
