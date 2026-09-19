"use client";

import { generateSceneImage } from "@/lib/pollinations";
import type { SceneItem, AudioChunk, VoicePreset, ChunkStatus } from "@/types";
import {
  generateAudio,
  base64ToBlobUrl,
  base64ToUint8Array,
  estimateWavDurationMs,
} from "@/lib/gemini";

// ─── Batch Image Queue Interfaces ─────────────────────────────────────────────

export interface BatchSceneItem {
  sceneId: number;
  visualPrompt: string;
  fullPrompt?: string;
  narrationLine?: string;
  imagePath?: string;
  seed?: number;
  retryCount?: number;
}

export type BatchProgressCallback<T = BatchSceneItem> = (
  completedCount: number,
  totalCount: number,
  activeScene: T
) => void;

export interface BatchImageQueueOptions<T extends BatchSceneItem = BatchSceneItem> {
  projectId: string;
  scenes: T[];
  baseStyle?: string;
  concurrency?: number; // default: 3
  maxRetries?: number; // default: 3
  onProgress?: BatchProgressCallback<T>;
  onSceneCompleted?: (scene: T, filePath: string) => void;
  onSceneFailed?: (scene: T, errorMessage: string) => void;
  onComplete?: () => void;
}

// ─── Tauri FS Helper ──────────────────────────────────────────────────────────

async function saveImageToDisk(
  projectId: string,
  sceneId: number,
  buffer: ArrayBuffer
): Promise<string> {
  const filePath = `projects/${projectId}/scenes/scene_${sceneId}.jpg`;
  const uint8Data = new Uint8Array(buffer);

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { writeFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const dir = `projects/${projectId}/scenes`;

    await mkdir(dir, { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => { });
    await writeFile(filePath, uint8Data, { baseDir: BaseDirectory.AppLocalData });
  }

  return filePath;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Batch Image Queue ────────────────────────────────────────────────────────

export class BatchImageQueue<T extends BatchSceneItem = BatchSceneItem> {
  private running = false;
  private cancelled = false;
  private concurrency: number;
  private maxRetries: number;

  constructor(concurrency = 3, maxRetries = 3) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  public setConcurrency(concurrency: number): void {
    if (concurrency >= 1) {
      this.concurrency = concurrency;
    }
  }

  public cancel(): void {
    this.cancelled = true;
  }

  public get isRunning(): boolean {
    return this.running;
  }

  /**
   * Process scenes through a worker pool with dynamic concurrency and exponential backoff
   */
  public async run(options: BatchImageQueueOptions<T>): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.cancelled = false;

    const {
      projectId,
      scenes,
      baseStyle,
      concurrency = this.concurrency,
      maxRetries = this.maxRetries,
      onProgress,
      onSceneCompleted,
      onSceneFailed,
      onComplete,
    } = options;

    const totalCount = scenes.length;
    let completedCount = 0;
    let queueIndex = 0;

    // Worker that pulls the next available scene from the shared index
    const worker = async (): Promise<void> => {
      while (queueIndex < totalCount && !this.cancelled) {
        const currentIndex = queueIndex++;
        const scene = scenes[currentIndex];

        if (!scene) break;

        let success = false;
        let attempt = 0;
        let lastError = "";

        while (attempt <= maxRetries && !success && !this.cancelled) {
          try {
            if (onProgress) {
              onProgress(completedCount, totalCount, scene);
            }

            const promptToUse = scene.fullPrompt || scene.visualPrompt;
            const arrayBuffer = await generateSceneImage(promptToUse, baseStyle, scene.seed);

            // Directly write buffer to disk and release from memory
            const savedPath = await saveImageToDisk(projectId, scene.sceneId, arrayBuffer);

            success = true;
            completedCount++;

            if (onSceneCompleted) {
              onSceneCompleted(scene, savedPath);
            }

            if (onProgress) {
              onProgress(completedCount, totalCount, scene);
            }
          } catch (err) {
            attempt++;
            const errMsg = err instanceof Error ? err.message : String(err);
            lastError = errMsg;

            const is429 = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit");
            const isTimeout = errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("network");

            if (attempt <= maxRetries && !this.cancelled) {
              // Exponential backoff: 3s initial for 429, 1.5s for timeouts/general errors
              const baseBackoff = is429 ? 3000 : 1500;
              const delay = baseBackoff * Math.pow(2, attempt - 1);
              await sleep(delay);
            }
          }
        }

        if (!success && !this.cancelled) {
          completedCount++;
          if (onSceneFailed) {
            onSceneFailed(scene, lastError || "Failed after maximum retries");
          }
        }
      }
    };

    // Spawn concurrent workers
    const activeWorkers = Math.min(concurrency, totalCount);
    const workerPromises: Promise<void>[] = [];

    for (let i = 0; i < activeWorkers; i++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);

    this.running = false;

    if (!this.cancelled && onComplete) {
      onComplete();
    }
  }
}

// ─── Backward Compatibility: Audio Queue ──────────────────────────────────────

export interface QueueCallbacks {
  onChunkUpdate: (index: number, update: Partial<AudioChunk>) => void;
  onComplete: () => void;
  onError: (index: number, error: string) => void;
}

export interface QueueOptions {
  apiKey: string;
  preset: VoicePreset;
  projectId: string;
  chunks: AudioChunk[];
  callbacks: QueueCallbacks;
}

const MAX_AUDIO_RETRIES = 3;
const RATE_LIMIT_PAUSE_MS = 5000;

import { saveMediaBlob } from "@/lib/media-storage";

async function saveAudioFile(
  projectId: string,
  chunkIndex: number,
  data: Uint8Array,
  mimeType = "audio/wav"
): Promise<string> {
  const filePath = `projects/${projectId}/audio/chunk_${chunkIndex}.wav`;

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { writeFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const dir = `projects/${projectId}/audio`;

    await mkdir(dir, { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => { });
    await writeFile(filePath, data, { baseDir: BaseDirectory.AppLocalData });
  }

  // Persist to IndexedDB so browser reload and export have access to full audio
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  await saveMediaBlob(`audio_${projectId}_${chunkIndex}`, blob);

  return filePath;
}

async function processAudioChunk(
  chunk: AudioChunk,
  options: QueueOptions,
  retryAttempt = 0
): Promise<void> {
  const { apiKey, preset, projectId, callbacks } = options;

  callbacks.onChunkUpdate(chunk.index, { status: "PROCESSING" as ChunkStatus });

  try {
    const result = await generateAudio(apiKey, chunk.text, preset);

    const bytes = base64ToUint8Array(result.base64Audio);
    const durationMs = estimateWavDurationMs(bytes);
    const filePath = await saveAudioFile(projectId, chunk.index, bytes, result.mimeType);
    const audioUrl = base64ToBlobUrl(result.base64Audio, result.mimeType);

    callbacks.onChunkUpdate(chunk.index, {
      status: "COMPLETED" as ChunkStatus,
      filePath,
      durationMs,
      audioUrl,
      retryCount: retryAttempt,
    });
  } catch (err) {
    const error = err as Error & { status?: number };
    const isInvalidKey = error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("unauthorized");

    if (isInvalidKey) {
      callbacks.onChunkUpdate(chunk.index, {
        status: "FAILED" as ChunkStatus,
        error: error.message,
        retryCount: retryAttempt,
      });
      callbacks.onError(chunk.index, error.message);
      return;
    }

    const is429 = error.status === 429 || error.message.includes("429");

    if (is429 && retryAttempt < MAX_AUDIO_RETRIES) {
      const waitMs = RATE_LIMIT_PAUSE_MS * Math.pow(2, retryAttempt);
      callbacks.onChunkUpdate(chunk.index, {
        status: "PROCESSING" as ChunkStatus,
        error: `Rate limited. Retrying in ${waitMs / 1000}s… (attempt ${retryAttempt + 1}/${MAX_AUDIO_RETRIES})`,
        retryCount: retryAttempt + 1,
      });
      await sleep(waitMs);
      return processAudioChunk(chunk, options, retryAttempt + 1);
    }

    if (!is429 && retryAttempt < MAX_AUDIO_RETRIES) {
      const waitMs = 2000 * Math.pow(2, retryAttempt);
      callbacks.onChunkUpdate(chunk.index, {
        status: "PROCESSING" as ChunkStatus,
        error: `Error, retrying… (attempt ${retryAttempt + 1}/${MAX_AUDIO_RETRIES})`,
        retryCount: retryAttempt + 1,
      });
      await sleep(waitMs);
      return processAudioChunk(chunk, options, retryAttempt + 1);
    }

    callbacks.onChunkUpdate(chunk.index, {
      status: "FAILED" as ChunkStatus,
      error: error.message,
      retryCount: retryAttempt,
    });
    callbacks.onError(chunk.index, error.message);
  }
}

export class AudioQueue {
  private cancelled = false;
  private running = false;

  async run(options: QueueOptions): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;

    const pendingChunks = options.chunks.filter(
      (c) => c.status === "PENDING" || c.status === "FAILED"
    );

    for (const chunk of pendingChunks) {
      if (this.cancelled) break;
      await processAudioChunk(chunk, options);
    }

    this.running = false;
    if (!this.cancelled) {
      options.callbacks.onComplete();
    }
  }

  async retryChunk(chunk: AudioChunk, options: Omit<QueueOptions, "chunks">): Promise<void> {
    await processAudioChunk(chunk, { ...options, chunks: [chunk] }, 0);
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
