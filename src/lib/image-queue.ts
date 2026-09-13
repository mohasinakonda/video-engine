/**
 * image-queue.ts — Throttled batch image generation queue (Phase 2)
 *
 * Processes scene images with:
 *  - Max 3 concurrent workers (configurable)
 *  - Automatic 10s pause on 429 Too Many Requests
 *  - Crash-resume checkpointing (skips already-downloaded scenes)
 *  - Tauri FS disk storage at: {AppLocalData}/projects/{id}/scenes/scene_{n}.jpg
 *  - Browser fallback: stores as data URLs in memory
 */

import type { SceneItem, SceneStatus, MotionProfile } from '@/types';
import { generateImage, base64ToBlobUrl, base64ToUint8Array } from '@/lib/gemini';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = 3;
const RATE_LIMIT_PAUSE_MS = 10_000; // 10s on 429
const MAX_RETRIES = 3;

// ─── Motion Profile Random Assignment ────────────────────────────────────────

const MOTION_PROFILES: MotionProfile[] = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right'];

export function randomMotionProfile(): MotionProfile {
  return MOTION_PROFILES[Math.floor(Math.random() * MOTION_PROFILES.length)];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageQueueCallbacks {
  onSceneUpdate: (sceneId: number, update: Partial<SceneItem>) => void;
  onComplete: () => void;
  onError: (sceneId: number, error: string) => void;
  onPause: (reason: string, resumeInMs: number) => void;
}

export interface ImageQueueOptions {
  apiKey: string;
  projectId: string;
  scenes: SceneItem[];
  negativePrompt?: string;
  model?: string;
  concurrency?: number;
  callbacks: ImageQueueCallbacks;
}

// ─── Tauri FS Helper ──────────────────────────────────────────────────────────

import { saveMediaBlob } from '@/lib/media-storage';

async function saveImageFile(
  projectId: string,
  sceneId: number,
  data: Uint8Array,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const filePath = `projects/${projectId}/scenes/scene_${sceneId}.${ext}`;

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const dir = `projects/${projectId}/scenes`;
    await mkdir(dir, { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => {});
    await writeFile(filePath, data, { baseDir: BaseDirectory.AppLocalData });
  }

  // Persist to IndexedDB for persistent browser access in Storyboard and Export
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  await saveMediaBlob(`scene_${projectId}_${sceneId}`, blob);

  return filePath;
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Single Scene Worker ──────────────────────────────────────────────────────

async function processScene(
  scene: SceneItem,
  options: ImageQueueOptions,
  retryAttempt = 0
): Promise<void> {
  const { apiKey, projectId, negativePrompt, callbacks } = options;

  callbacks.onSceneUpdate(scene.sceneId, { status: 'GENERATING_IMAGE' as SceneStatus });

  try {
    const prompt = scene.fullPrompt ?? scene.visualPrompt;
    const result = await generateImage(apiKey, prompt, negativePrompt, { model: options.model });

    // Decode + save to disk
    const bytes = base64ToUint8Array(result.base64Image);
    const filePath = await saveImageFile(projectId, scene.sceneId, bytes, result.mimeType);

    // Create preview URL
    const imageUrl = base64ToBlobUrl(result.base64Image, result.mimeType);

    // Assign a random motion profile
    const motionProfile = randomMotionProfile();

    callbacks.onSceneUpdate(scene.sceneId, {
      status: 'IMAGE_READY' as SceneStatus,
      imagePath: filePath,
      imageUrl,
      motionProfile,
      retryCount: retryAttempt,
      error: undefined,
    });
  } catch (err) {
    const error = err as Error & { status?: number };
    const is429 = error.status === 429 || error.message.includes('429');

    if (is429 && retryAttempt < MAX_RETRIES) {
      const waitMs = RATE_LIMIT_PAUSE_MS * Math.pow(2, retryAttempt);
      callbacks.onSceneUpdate(scene.sceneId, {
        status: 'GENERATING_IMAGE' as SceneStatus,
        error: `Rate limited. Retrying in ${waitMs / 1000}s… (attempt ${retryAttempt + 1}/${MAX_RETRIES})`,
        retryCount: retryAttempt + 1,
      });
      callbacks.onPause(`Rate limited on scene ${scene.sceneId}`, waitMs);
      await sleep(waitMs);
      return processScene(scene, options, retryAttempt + 1);
    }

    if (!is429 && retryAttempt < MAX_RETRIES) {
      const waitMs = 2000 * (retryAttempt + 1);
      callbacks.onSceneUpdate(scene.sceneId, {
        status: 'GENERATING_IMAGE' as SceneStatus,
        error: `Error, retrying… (${retryAttempt + 1}/${MAX_RETRIES})`,
        retryCount: retryAttempt + 1,
      });
      await sleep(waitMs);
      return processScene(scene, options, retryAttempt + 1);
    }

    callbacks.onSceneUpdate(scene.sceneId, {
      status: 'FAILED' as SceneStatus,
      error: error.message,
      retryCount: retryAttempt,
    });
    callbacks.onError(scene.sceneId, error.message);
  }
}

// ─── Queue Controller ─────────────────────────────────────────────────────────

export class ImageQueue {
  private cancelled = false;
  private running = false;

  async run(options: ImageQueueOptions): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;

    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

    // Filter only pending/failed scenes (checkpoint resume)
    const pendingScenes = options.scenes.filter(
      (s) => s.status === 'PENDING' || s.status === 'FAILED'
    );

    // Process in batches of `concurrency`
    for (let i = 0; i < pendingScenes.length; i += concurrency) {
      if (this.cancelled) break;

      const batch = pendingScenes.slice(i, i + concurrency);
      await Promise.all(
        batch.map((scene) =>
          this.cancelled ? Promise.resolve() : processScene(scene, options)
        )
      );
    }

    this.running = false;
    if (!this.cancelled) {
      options.callbacks.onComplete();
    }
  }

  /** Retry a single failed scene */
  async retryScene(
    scene: SceneItem,
    options: Omit<ImageQueueOptions, 'scenes'>
  ): Promise<void> {
    await processScene(scene, { ...options, scenes: [scene] }, 0);
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
