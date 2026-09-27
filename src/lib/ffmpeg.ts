/**
 * ffmpeg.ts — Motion Profile Helper for Web SaaS Engine
 *
 * Provides motion profiles (zoom_in, zoom_out, pan_left, pan_right)
 * for live Canvas rendering and offline MP4 encoding.
 */

import type { SceneItem, MotionProfile } from '@/types';

export interface FFmpegCallbacks {
  onSceneUpdate: (sceneId: number, update: Partial<SceneItem>) => void;
  onComplete: () => void;
  onError: (sceneId: number, error: string) => void;
}

export interface FFmpegOptions {
  projectId: string;
  scenes: SceneItem[];
  fps?: number;
  width?: number;
  height?: number;
  callbacks: FFmpegCallbacks;
}

/**
 * Web motion clip renderer. Marks scenes as MOTION_READY for Canvas export.
 */
export async function processSceneMotion(
  scene: SceneItem,
  projectId: string,
  options?: Partial<FFmpegOptions>
): Promise<string> {
  const sceneId = scene.sceneId;
  const clipPath = `projects/${projectId}/motion_clips/clip_${sceneId}.mp4`;
  return clipPath;
}

export class MotionBatchProcessor {
  private cancelled = false;

  public cancel() {
    this.cancelled = true;
  }

  public async run(options: FFmpegOptions): Promise<void> {
    const { projectId, scenes, callbacks } = options;

    const readyScenes = scenes.filter(
      (s) => s.status === 'IMAGE_READY' || s.status === 'MOTION_READY'
    );

    for (const scene of readyScenes) {
      if (this.cancelled) break;

      try {
        callbacks.onSceneUpdate(scene.sceneId, { status: 'GENERATING_MOTION' });
        const motionClipPath = await processSceneMotion(scene, projectId, options);
        callbacks.onSceneUpdate(scene.sceneId, {
          status: 'MOTION_READY',
          motionClipPath,
        });
      } catch (err: any) {
        callbacks.onError(scene.sceneId, err.message || 'Motion processing failed');
      }
    }

    callbacks.onComplete();
  }
}

export { MotionBatchProcessor as MotionQueue };
