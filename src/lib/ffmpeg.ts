/**
 * ffmpeg.ts — Ken Burns Motion Animation Engine (Phase 2)
 *
 * Applies smooth pan & zoom animations (Ken Burns effect) to static images
 * using a bundled FFmpeg binary via Tauri Sidecar.
 *
 * Motion Profiles:
 *   zoom_in   — 1.0x → 1.15x smooth zoom to center
 *   zoom_out  — 1.15x → 1.0x zoom out
 *   pan_left  — slide from right to center (pan right-to-left)
 *   pan_right — slide from left to center (pan left-to-right)
 *
 * In non-Tauri (web dev) mode, the engine simulates the operation with a
 * short delay and marks the clip status as MOTION_READY.
 *
 * Output path: {AppLocalData}/projects/{id}/motion_clips/clip_{sceneId}.mp4
 */

import type { SceneItem, MotionProfile, SceneStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FFmpegCallbacks {
  onSceneUpdate: (sceneId: number, update: Partial<SceneItem>) => void;
  onComplete: () => void;
  onError: (sceneId: number, error: string) => void;
}

export interface FFmpegOptions {
  projectId: string;
  scenes: SceneItem[];    // Must have status IMAGE_READY
  fps?: number;           // Default: 30
  width?: number;         // Default: 1920
  height?: number;        // Default: 1080
  callbacks: FFmpegCallbacks;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

// ─── FFmpeg Filter Builder ────────────────────────────────────────────────────

/**
 * Builds the zoompan filter string for FFmpeg.
 * Duration in frames = durationSec * fps.
 */
function buildZoompanFilter(
  profile: MotionProfile,
  durationSec: number,
  fps: number,
  width: number,
  height: number
): string {
  const d = Math.round(durationSec * fps); // duration in frames
  const s = `${width}x${height}`;

  switch (profile) {
    case 'zoom_in':
      // Smooth zoom from 1.0x to 1.15x, centered
      return `zoompan=z='min(zoom+0.005,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=${fps}`;

    case 'zoom_out':
      // Start at 1.15x, zoom out to 1.0x, centered
      return `zoompan=z='if(lte(zoom,1.0),1.0,zoom-0.005)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=${fps},zoompan=z='max(zoom-0.005,1.0)':d=${d}:s=${s}:fps=${fps}`;

    case 'pan_left':
      // Pan from right to left — x decreases from max to 0
      return `zoompan=z='1.1':x='if(gte(on,1),x-2,iw*0.1)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=${fps}`;

    case 'pan_right':
      // Pan from left to right — x increases from 0
      return `zoompan=z='1.1':x='if(gte(on,1),x+2,0)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=${fps}`;

    default:
      return `zoompan=z='min(zoom+0.005,1.15)':d=${d}:s=${s}:fps=${fps}`;
  }
}

// ─── Path Helper ──────────────────────────────────────────────────────────────

function getAppLocalDataPath(): string {
  // In Tauri, we pass the absolute path via Tauri API.
  // Here we return a relative path for the command.
  return '';
}

// ─── Tauri Sidecar Executor ───────────────────────────────────────────────────

async function runFFmpegSidecar(args: string[]): Promise<void> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    // Web dev mode: simulate with delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return;
  }

  const { Command } = await import('@tauri-apps/plugin-shell');

  // The sidecar binary is registered as "ffmpeg" in tauri.conf.json
  const command = Command.sidecar('ffmpeg', args);
  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(`FFmpeg failed (code ${output.code}): ${output.stderr}`);
  }
}

// ─── Get App Local Data Dir (Tauri) ──────────────────────────────────────────

async function resolveProjectPath(projectId: string): Promise<string> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { appLocalDataDir } = await import('@tauri-apps/api/path');
    const base = await appLocalDataDir();
    return `${base}projects/${projectId}`;
  }
  // Web dev: return placeholder path
  return `/data/projects/${projectId}`;
}

// ─── Single Scene Motion Renderer ────────────────────────────────────────────

async function renderSceneMotion(
  scene: SceneItem,
  options: FFmpegOptions
): Promise<void> {
  const { projectId, callbacks } = options;
  const fps = options.fps ?? DEFAULT_FPS;
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;

  callbacks.onSceneUpdate(scene.sceneId, { status: 'GENERATING_MOTION' as SceneStatus });

  try {
    const profile = scene.motionProfile ?? 'zoom_in';
    const durationSec = scene.audioEndSec - scene.audioStartSec;
    const filter = buildZoompanFilter(profile, durationSec, fps, width, height);

    const projectPath = await resolveProjectPath(projectId);
    const inputPath = `${projectPath}/scenes/scene_${scene.sceneId}.jpg`;
    const outputDir = `${projectPath}/motion_clips`;
    const outputPath = `${outputDir}/clip_${scene.sceneId}.mp4`;

    // Build FFmpeg args
    const args = [
      '-loop', '1',
      '-i', inputPath,
      '-vf', filter,
      '-t', durationSec.toFixed(2),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '22',
      '-y',   // overwrite if exists
      outputPath,
    ];

    // In Tauri: create output directory first
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      await mkdir(`projects/${projectId}/motion_clips`, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      }).catch(() => {});
    }

    await runFFmpegSidecar(args);

    const motionClipPath = `projects/${projectId}/motion_clips/clip_${scene.sceneId}.mp4`;

    callbacks.onSceneUpdate(scene.sceneId, {
      status: 'MOTION_READY' as SceneStatus,
      motionClipPath,
      error: undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onSceneUpdate(scene.sceneId, {
      status: 'FAILED' as SceneStatus,
      error: `Motion render failed: ${msg}`,
    });
    callbacks.onError(scene.sceneId, msg);
  }
}

// ─── Motion Queue Controller ──────────────────────────────────────────────────

export class MotionQueue {
  private cancelled = false;
  private running = false;
  private readonly CONCURRENCY = 2; // FFmpeg is CPU-heavy, limit to 2 parallel

  async run(options: FFmpegOptions): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;

    const readyScenes = options.scenes.filter(
      (s) => s.status === 'IMAGE_READY' || s.status === 'FAILED'
    );

    for (let i = 0; i < readyScenes.length; i += this.CONCURRENCY) {
      if (this.cancelled) break;
      const batch = readyScenes.slice(i, i + this.CONCURRENCY);
      await Promise.all(
        batch.map((scene) =>
          this.cancelled ? Promise.resolve() : renderSceneMotion(scene, options)
        )
      );
    }

    this.running = false;
    if (!this.cancelled) {
      options.callbacks.onComplete();
    }
  }

  /** Render motion for a single scene */
  async renderScene(
    scene: SceneItem,
    options: Omit<FFmpegOptions, 'scenes'>
  ): Promise<void> {
    await renderSceneMotion(scene, { ...options, scenes: [scene] });
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isRunning(): boolean {
    return this.running;
  }
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export { buildZoompanFilter, getAppLocalDataPath };
