/**
 * queue.ts — Sequential audio generation queue
 *
 * Processes audio chunks one at a time to:
 *  - Respect Gemini API rate limits
 *  - Support exponential back-off retry on 429
 *  - Emit per-chunk status updates via callbacks
 */

import type { VoicePreset, AudioChunk, ChunkStatus } from '@/types';
import {
  generateAudio,
  base64ToBlobUrl,
  base64ToUint8Array,
  estimateWavDurationMs,
} from '@/lib/gemini';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RATE_LIMIT_PAUSE_MS = 5000; // 5 s initial back-off on 429

// ─── Tauri FS Helper ──────────────────────────────────────────────────────────

async function saveAudioFile(
  projectId: string,
  chunkIndex: number,
  data: Uint8Array
): Promise<string> {
  const filePath = `projects/${projectId}/audio/chunk_${chunkIndex}.wav`;

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const dir = `projects/${projectId}/audio`;

    await mkdir(dir, { baseDir: BaseDirectory.AppLocalData, recursive: true }).catch(() => { });
    await writeFile(filePath, data, { baseDir: BaseDirectory.AppLocalData });
  }

  return filePath;
}

// ─── Exponential Back-off ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Single Chunk Worker ──────────────────────────────────────────────────────

async function processChunk(
  chunk: AudioChunk,
  options: QueueOptions,
  retryAttempt = 0
): Promise<void> {
  const { apiKey, preset, projectId, callbacks } = options;

  callbacks.onChunkUpdate(chunk.index, { status: 'PROCESSING' as ChunkStatus });

  try {
    const result = await generateAudio(apiKey, chunk.text, preset);

    // Decode + save
    const bytes = base64ToUint8Array(result.base64Audio);
    const durationMs = estimateWavDurationMs(bytes);
    const filePath = await saveAudioFile(projectId, chunk.index, bytes);

    // Create a blob URL for immediate in-app playback
    const audioUrl = base64ToBlobUrl(result.base64Audio, result.mimeType);

    callbacks.onChunkUpdate(chunk.index, {
      status: 'COMPLETED' as ChunkStatus,
      filePath,
      durationMs,
      audioUrl,
      retryCount: retryAttempt,
    });
  } catch (err) {
    const error = err as Error & { status?: number };
    const is429 = error.status === 429 || error.message.includes('429');

    if (is429 && retryAttempt < MAX_RETRIES) {
      const waitMs = RATE_LIMIT_PAUSE_MS * Math.pow(2, retryAttempt);
      callbacks.onChunkUpdate(chunk.index, {
        status: 'PROCESSING' as ChunkStatus,
        error: `Rate limited. Retrying in ${waitMs / 1000}s… (attempt ${retryAttempt + 1}/${MAX_RETRIES})`,
        retryCount: retryAttempt + 1,
      });
      await sleep(waitMs);
      return processChunk(chunk, options, retryAttempt + 1);
    }

    if (!is429 && retryAttempt < MAX_RETRIES) {
      const waitMs = 2000 * Math.pow(2, retryAttempt);
      callbacks.onChunkUpdate(chunk.index, {
        status: 'PROCESSING' as ChunkStatus,
        error: `Error, retrying… (attempt ${retryAttempt + 1}/${MAX_RETRIES})`,
        retryCount: retryAttempt + 1,
      });
      await sleep(waitMs);
      return processChunk(chunk, options, retryAttempt + 1);
    }

    callbacks.onChunkUpdate(chunk.index, {
      status: 'FAILED' as ChunkStatus,
      error: error.message,
      retryCount: retryAttempt,
    });
    callbacks.onError(chunk.index, error.message);
  }
}

// ─── Queue Controller ─────────────────────────────────────────────────────────

export class AudioQueue {
  private cancelled = false;
  private running = false;

  async run(options: QueueOptions): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;

    const pendingChunks = options.chunks.filter(
      (c) => c.status === 'PENDING' || c.status === 'FAILED'
    );

    for (const chunk of pendingChunks) {
      if (this.cancelled) break;
      await processChunk(chunk, options);
    }

    this.running = false;
    if (!this.cancelled) {
      options.callbacks.onComplete();
    }
  }

  /** Retry a single failed chunk */
  async retryChunk(chunk: AudioChunk, options: Omit<QueueOptions, 'chunks'>): Promise<void> {
    await processChunk(chunk, { ...options, chunks: [chunk] }, 0);
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
