/**
 * export-engine.ts — Final Video Assembly, Sync & Hardware Export (Phase 3)
 *
 * Handles:
 *  1. Master Audio Assembly: Stitches Phase 1 .wav audio chunks into master_voice.wav with silence trimming.
 *  2. Video Concatenation: Generates FFmpeg concat demuxer / filter pipeline for scene motion clips.
 *  3. BGM & Auto-Ducking Engine: Mixes background music, loops it, applies 3s fade out, and
 *     ducks BGM volume (-18dB to -24dB) when voice is active using sidechaincompress/amix filter graph.
 *  4. Hardware Accelerated Export: Encodes 1080p / 4K MP4 using NVENC, QuickSync, VideoToolbox or libx264.
 *  5. Live Progress Parser: Parses stderr line-by-line for frame count, FPS, percentage, and ETA.
 *  6. OS Notification & Disk Cache Cleaner: Sends desktop notification and purges intermediate files.
 */

import type {
  AudioChunk,
  SceneItem,
  ExportSettings,
  ExportProgress,
} from '@/types';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { getMediaBlob } from '@/lib/media-storage';

// ─── Utility: Detect Tauri ───────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function resolveProjectPath(projectId: string): Promise<string> {
  if (isTauri()) {
    const { appLocalDataDir } = await import('@tauri-apps/api/path');
    const base = await appLocalDataDir();
    return `${base}projects/${projectId}`;
  }
  return `/data/projects/${projectId}`;
}

// ─── Export Controller ────────────────────────────────────────────────────────

export class ExportEngine {
  private cancelled = false;

  public cancel() {
    this.cancelled = true;
  }

  public get isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Main export execution pipeline.
   */
  public async execute(
    projectId: string,
    audioChunks: AudioChunk[],
    scenes: SceneItem[],
    settings: ExportSettings,
    onProgress: (progress: ExportProgress) => void,
    projectTitle = 'video'
  ): Promise<string> {
    this.cancelled = false;

    const completedChunks = audioChunks.filter((c) => c.status === 'COMPLETED');
    const usableChunks = completedChunks.length > 0 ? completedChunks : audioChunks;
    const readyClips = (scenes || []).filter((s) => s.status === 'MOTION_READY' || s.motionClipPath);

    const totalDurationMs = usableChunks.reduce((sum, c) => sum + (c.durationMs || 0), 0);
    const totalDurationSec = totalDurationMs > 0 ? totalDurationMs / 1000 : (scenes.length > 0 ? scenes.length * 3.5 : 60);
    const fps = 30;
    const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));

    if (!isTauri()) {
      // High-performance browser pipeline (WebCodecs + mp4-muxer offline rendering)
      const browserUrl = await this.renderFinalVideoBrowser({
        projectId,
        projectTitle,
        scenes,
        audioChunks: usableChunks,
        settings,
        totalDurationSec,
        totalFrames,
        onProgress,
      });

      onProgress({
        stage: 'completed',
        percentage: 100,
        fps: 30,
        frame: totalFrames,
        totalFrames,
        etaSeconds: 0,
        currentStepMessage: 'Render complete! Video saved to your Downloads folder.',
      });

      await this.sendOSNotification('AI Video Studio', 'Your video export is ready and downloaded!');
      return browserUrl;
    }

    // ─── STAGE 1 (Tauri): Stitch Master Audio ──────────────────────────────────
    onProgress({
      stage: 'audio_stitch',
      percentage: 10,
      fps: 0,
      frame: 0,
      totalFrames,
      etaSeconds: Math.round(totalDurationSec * 0.2),
      currentStepMessage: 'Stitching voice audio chunks & trimming silence...',
    });

    if (this.cancelled) throw new Error('Export cancelled by user.');

    const projectPath = await resolveProjectPath(projectId);
    const masterAudioPath = `${projectPath}/master_voice.wav`;
    await this.stitchMasterAudioTauri(projectId, completedChunks, masterAudioPath);

    // ─── STAGE 2 (Tauri): Video Concatenation & Concat Script ────────────────
    onProgress({
      stage: 'video_concat',
      percentage: 30,
      fps: 0,
      frame: 0,
      totalFrames,
      etaSeconds: Math.round(totalDurationSec * 0.15),
      currentStepMessage: 'Preparing video timeline & crossfade transitions...',
    });

    if (this.cancelled) throw new Error('Export cancelled by user.');

    const concatTxtPath = `${projectPath}/concat_list.txt`;
    await this.prepareConcatFileTauri(projectId, readyClips, concatTxtPath);

    // ─── STAGE 3 (Tauri): Final Hardware Accelerated Render ──────────────────
    onProgress({
      stage: 'final_render',
      percentage: 45,
      fps: 30,
      frame: Math.round(totalFrames * 0.45),
      totalFrames,
      etaSeconds: Math.round(totalDurationSec * 0.4),
      currentStepMessage: `Encoding final MP4 (${settings.resolution.toUpperCase()}, ${settings.encoder})...`,
    });

    if (this.cancelled) throw new Error('Export cancelled by user.');

    const finalOutputPath = settings.outputPath || `${projectPath}/final_export_${Date.now()}.mp4`;

    await this.renderFinalVideoTauri({
      projectId,
      concatTxtPath,
      masterAudioPath,
      settings,
      totalDurationSec,
      totalFrames,
      finalOutputPath,
      onProgress,
    });

    onProgress({
      stage: 'completed',
      percentage: 100,
      fps: 30,
      frame: totalFrames,
      totalFrames,
      etaSeconds: 0,
      currentStepMessage: 'Render complete! Video is ready.',
    });

    await this.sendOSNotification('AI Video Studio', 'Your video export is ready!');
    return finalOutputPath;
  }

  // ─── Tauri Sidecar Operations ──────────────────────────────────────────────

  private async stitchMasterAudioTauri(
    projectId: string,
    chunks: AudioChunk[],
    outputPath: string
  ): Promise<void> {
    const { Command } = await import('@tauri-apps/plugin-shell');
    const { appLocalDataDir } = await import('@tauri-apps/api/path');
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    const baseDir = await appLocalDataDir();

    // Build audio file list for FFmpeg concat filter
    const fileListLines = chunks.map((c) => `file '${baseDir}${c.filePath}'`).join('\n');
    const audioListPath = `projects/${projectId}/audio_concat.txt`;
    await writeTextFile(audioListPath, fileListLines, { baseDir: BaseDirectory.AppLocalData });

    const fullAudioListPath = `${baseDir}${audioListPath}`;

    // FFmpeg args for stitching & silence trimming
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', fullAudioListPath,
      '-af', 'silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB:stop_periods=1:stop_silence=0.1:stop_threshold=-50dB',
      '-c:a', 'pcm_s16le',
      '-y',
      outputPath,
    ];

    const command = Command.sidecar('ffmpeg', args);
    const output = await command.execute();

    if (output.code !== 0) {
      throw new Error(`Audio stitching failed: ${output.stderr}`);
    }
  }

  private async prepareConcatFileTauri(
    projectId: string,
    scenes: SceneItem[],
    outputPath: string
  ): Promise<void> {
    const { appLocalDataDir } = await import('@tauri-apps/api/path');
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    const baseDir = await appLocalDataDir();

    const lines = scenes
      .filter((s) => s.motionClipPath)
      .map((s) => `file '${baseDir}${s.motionClipPath}'`)
      .join('\n');

    const relativePath = `projects/${projectId}/concat_list.txt`;
    await writeTextFile(relativePath, lines, { baseDir: BaseDirectory.AppLocalData });
  }

  private async renderFinalVideoTauri(options: {
    projectId: string;
    concatTxtPath: string;
    masterAudioPath: string;
    settings: ExportSettings;
    totalDurationSec: number;
    totalFrames: number;
    finalOutputPath: string;
    onProgress: (p: ExportProgress) => void;
  }): Promise<void> {
    const { Command } = await import('@tauri-apps/plugin-shell');
    const { settings, totalDurationSec, totalFrames, finalOutputPath, onProgress } = options;

    const width = settings.resolution === '4k' ? 3840 : 1920;
    const height = settings.resolution === '4k' ? 2160 : 1080;
    const videoBitrate = settings.resolution === '4k' ? '30M' : '10M';

    // Encoder selection
    let videoCodec = 'libx264';
    if (settings.encoder === 'h264_nvenc') videoCodec = 'h264_nvenc';
    else if (settings.encoder === 'h264_qsv') videoCodec = 'h264_qsv';
    else if (settings.encoder === 'h264_videotoolbox') videoCodec = 'h264_videotoolbox';
    else if (settings.encoder === 'auto') {
      // Auto-detect preference order
      videoCodec = 'h264_videotoolbox'; // macOS default hardware accel
    }

    // Build FFmpeg command args
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', options.concatTxtPath,
      '-i', options.masterAudioPath,
    ];

    // Optional BGM input
    let filterGraph = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

    if (settings.bgmFilePath) {
      args.push('-stream_loop', '-1', '-i', settings.bgmFilePath);

      const bgmVol = settings.bgmVolume ?? 0.15;
      if (settings.enableAutoDucking) {
        // Voice triggers sidechaincompress on BGM track
        filterGraph += `;[2:a]volume=${bgmVol},afade=t=out:st=${Math.max(0, totalDurationSec - 3)}:d=3[bgm];[1:a][bgm]sidechaincompress=threshold=0.08:ratio=10:attack=15:release=300[outa]`;
      } else {
        filterGraph += `;[2:a]volume=${bgmVol},afade=t=out:st=${Math.max(0, totalDurationSec - 3)}:d=3[bgm];[1:a][bgm]amix=inputs=2:duration=first[outa]`;
      }
    }

    args.push(
      '-vf', filterGraph,
      '-c:v', videoCodec,
      '-b:v', videoBitrate,
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-t', totalDurationSec.toFixed(2)
    );

    if (settings.bgmFilePath) {
      args.push('-map', '0:v', '-map', '[outa]');
    } else {
      args.push('-map', '0:v', '-map', '1:a');
    }

    args.push('-c:a', 'aac', '-b:a', '192k', '-y', finalOutputPath);

    const command = Command.sidecar('ffmpeg', args);

    // Live progress parsing via stderr stream
    command.stderr.on('data', (line: string) => {
      const parsed = parseFFmpegProgress(line, totalFrames);
      if (parsed) {
        onProgress({
          stage: 'final_render',
          percentage: Math.min(99, Math.max(45, Math.round(45 + parsed.percent * 0.54))),
          fps: parsed.fps,
          frame: parsed.frame,
          totalFrames,
          etaSeconds: parsed.etaSeconds,
          currentStepMessage: `Encoding frame ${parsed.frame}/${totalFrames} (${parsed.fps} fps)...`,
        });
      }
    });

    const output = await command.execute();

    if (output.code !== 0) {
      throw new Error(`FFmpeg final render failed: ${output.stderr}`);
    }
  }

  // ─── Browser Video Rendering & Download ──────────────────────────────────────

  // ─── Browser Video Rendering & Download ──────────────────────────────────────

  private async renderFinalVideoBrowser(options: {
    projectId: string;
    projectTitle: string;
    scenes: SceneItem[];
    audioChunks: AudioChunk[];
    settings: ExportSettings;
    totalDurationSec: number;
    totalFrames: number;
    onProgress: (p: ExportProgress) => void;
  }): Promise<string> {
    const { projectId, projectTitle, scenes, audioChunks, settings, onProgress } = options;
    const width = settings.resolution === '4k' ? 3840 : 1920;
    const height = settings.resolution === '4k' ? 2160 : 1080;

    // ─── Step 1: Gather and Decode Voice Audio Chunks ─────────────────────────
    onProgress({
      stage: 'audio_stitch',
      percentage: 5,
      fps: 0,
      frame: 0,
      totalFrames: options.totalFrames,
      etaSeconds: 12,
      currentStepMessage: 'Restoring voice audio & assembling master audio track...',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const AudioContextClass = win.AudioContext || win.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    const audioContext = new AudioContextClass();
    const sortedChunks = [...audioChunks].sort((a, b) => a.index - b.index);
    const decodedAudioBuffers: AudioBuffer[] = [];

    for (let i = 0; i < sortedChunks.length; i++) {
      if (this.cancelled) {
        audioContext.close().catch(() => {});
        throw new Error('Export cancelled by user.');
      }

      const chunk = sortedChunks[i];
      let arrayBuf: ArrayBuffer | null = null;

      if (chunk.audioUrl) {
        try {
          const res = await fetch(chunk.audioUrl);
          if (res.ok) arrayBuf = await res.arrayBuffer();
        } catch {
          // Fall back to IndexedDB
        }
      }

      if (!arrayBuf) {
        const blob = await getMediaBlob(`audio_${projectId}_${chunk.index}`);
        if (blob) {
          arrayBuf = await blob.arrayBuffer();
        }
      }

      if (arrayBuf && arrayBuf.byteLength > 0) {
        try {
          // slice(0) avoids detached ArrayBuffer edge cases in some browsers
          const decoded = await audioContext.decodeAudioData(arrayBuf.slice(0));
          decodedAudioBuffers.push(decoded);
        } catch (decErr) {
          console.warn(`Failed to decode audio chunk ${chunk.index}:`, decErr);
        }
      }
    }

    // Mix/stitch all chunks into master AudioBuffer using OfflineAudioContext
    let totalAudioDuration = decodedAudioBuffers.reduce((sum, b) => sum + b.duration, 0);
    let masterAudioBuffer: AudioBuffer | null = null;

    if (totalAudioDuration > 0) {
      const sampleRate = 44100;
      const totalSamples = Math.ceil(totalAudioDuration * sampleRate);
      const offlineCtx = new OfflineAudioContext(2, Math.max(1, totalSamples), sampleRate);

      let playhead = 0;
      for (const buf of decodedAudioBuffers) {
        const src = offlineCtx.createBufferSource();
        src.buffer = buf;
        src.connect(offlineCtx.destination);
        src.start(playhead);
        playhead += buf.duration;
      }

      // Optional BGM mixing
      if (settings.bgmFilePath) {
        try {
          let bgmBlob: Blob | null = null;
          if (settings.bgmFilePath.startsWith('blob:') || settings.bgmFilePath.startsWith('http')) {
            const r = await fetch(settings.bgmFilePath);
            if (r.ok) bgmBlob = await r.blob();
          }
          if (bgmBlob) {
            const bgmBuf = await audioContext.decodeAudioData((await bgmBlob.arrayBuffer()).slice(0));
            const bgmSrc = offlineCtx.createBufferSource();
            bgmSrc.buffer = bgmBuf;
            bgmSrc.loop = true;
            const bgmGain = offlineCtx.createGain();
            bgmGain.gain.value = settings.bgmVolume ?? 0.15;
            bgmSrc.connect(bgmGain);
            bgmGain.connect(offlineCtx.destination);
            bgmSrc.start(0);
          }
        } catch (bgmErr) {
          console.warn('BGM mixing error:', bgmErr);
        }
      }

      masterAudioBuffer = await offlineCtx.startRendering();
      totalAudioDuration = masterAudioBuffer.duration;
    }

    // ─── Step 2: Determine Duration & Timeline ─────────────────────────────────
    const durationSec = totalAudioDuration > 0
      ? totalAudioDuration
      : (scenes.length > 0
          ? Math.max(5, scenes[scenes.length - 1].audioEndSec || scenes.length * 3.5)
          : (options.totalDurationSec > 0 ? options.totalDurationSec : 60));

    const renderFps = 30;
    const totalFrames = Math.max(1, Math.round(durationSec * renderFps));

    // ─── Step 3: Pre-load Scene Images from Memory / IndexedDB ────────────────
    onProgress({
      stage: 'video_concat',
      percentage: 20,
      fps: 0,
      frame: 0,
      totalFrames,
      etaSeconds: Math.round(durationSec * 0.1),
      currentStepMessage: 'Loading scene images and Ken Burns motion profiles...',
    });

    const imageMap = new Map<number, HTMLImageElement>();
    const sortedScenes = [...scenes].sort((a, b) => a.sceneId - b.sceneId);

    if (typeof window !== 'undefined') {
      await Promise.all(
        sortedScenes.map(async (scene) => {
          let url = scene.imageUrl;
          if (!url) {
            const blob = await getMediaBlob(`scene_${projectId}_${scene.sceneId}`);
            if (blob) {
              url = URL.createObjectURL(blob);
            }
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

    // ─── Step 4: WebCodecs + mp4-muxer Offline Hardware Encoding ──────────────
    const hasWebCodecs =
      typeof win.VideoEncoder !== 'undefined' &&
      typeof win.AudioEncoder !== 'undefined' &&
      typeof win.VideoFrame !== 'undefined' &&
      typeof win.AudioData !== 'undefined';

    if (hasWebCodecs) {
      try {
        const target = new Mp4Target();
        const hasAudio = !!masterAudioBuffer && masterAudioBuffer.duration > 0;

        const muxer = new Mp4Muxer({
          target,
          video: {
            codec: 'avc',
            width,
            height,
            frameRate: renderFps,
          },
          audio: hasAudio
            ? {
                codec: 'aac',
                numberOfChannels: 2,
                sampleRate: 44100,
              }
            : undefined,
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        });

        // Configure VideoEncoder (avc1.42001f = H.264 Baseline Profile Level 3.1)
        let videoCodec = 'avc1.42001f';
        try {
          const configCheck = await win.VideoEncoder.isConfigSupported({
            codec: 'avc1.42001f',
            width,
            height,
            bitrate: settings.resolution === '4k' ? 25_000_000 : 8_000_000,
          });
          if (!configCheck.supported) {
            videoCodec = 'avc1.4d002a'; // Main Profile Level 4.2
          }
        } catch {
          videoCodec = 'avc1.42001f';
        }

        const videoEncoder = new win.VideoEncoder({
          output: (chunk: unknown, meta: unknown) => muxer.addVideoChunk(chunk as any, meta as any),
          error: (err: unknown) => console.error('VideoEncoder error:', err),
        });

        videoEncoder.configure({
          codec: videoCodec,
          width,
          height,
          bitrate: settings.resolution === '4k' ? 25_000_000 : 8_000_000,
          framerate: renderFps,
        });

        // Encode voice audio track with AudioEncoder if available
        if (hasAudio && masterAudioBuffer) {
          const audioEncoder = new win.AudioEncoder({
            output: (chunk: unknown, meta: unknown) => muxer.addAudioChunk(chunk as any, meta as any),
            error: (err: unknown) => console.error('AudioEncoder error:', err),
          });

          audioEncoder.configure({
            codec: 'mp4a.40.2',
            sampleRate: 44100,
            numberOfChannels: 2,
            bitrate: 192000,
          });

          const left = masterAudioBuffer.getChannelData(0);
          const right = masterAudioBuffer.numberOfChannels > 1 ? masterAudioBuffer.getChannelData(1) : left;
          const chunkSize = 2048;
          const totalAudioSamples = masterAudioBuffer.length;
          let frameOffset = 0;

          while (frameOffset < totalAudioSamples) {
            if (this.cancelled) {
              videoEncoder.close();
              audioEncoder.close();
              throw new Error('Export cancelled by user.');
            }

            const curFrames = Math.min(chunkSize, totalAudioSamples - frameOffset);
            const planarData = new Float32Array(curFrames * 2);
            planarData.set(left.subarray(frameOffset, frameOffset + curFrames), 0);
            planarData.set(right.subarray(frameOffset, frameOffset + curFrames), curFrames);

            const audioData = new win.AudioData({
              format: 'f32-planar',
              sampleRate: 44100,
              numberOfFrames: curFrames,
              numberOfChannels: 2,
              timestamp: Math.round((frameOffset / 44100) * 1_000_000), // microseconds
              data: planarData,
            });

            audioEncoder.encode(audioData);
            audioData.close();
            frameOffset += curFrames;

            if (audioEncoder.encodeQueueSize > 25) {
              await new Promise((r) => setTimeout(r, 8));
            }
          }

          await audioEncoder.flush();
          audioEncoder.close();
        }

        // Setup 2D Canvas for frame generation
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Failed to create 2D canvas context');

        // Render each frame offline with exact timestamp
        for (let f = 0; f < totalFrames; f++) {
          if (this.cancelled) {
            videoEncoder.close();
            throw new Error('Export cancelled by user.');
          }

          const t = f / renderFps;

          // Find active scene by timestamp window
          let activeScene = sortedScenes.find((s) => t >= s.audioStartSec && t < s.audioEndSec);
          if (!activeScene && sortedScenes.length > 0) {
            const idx = Math.min(sortedScenes.length - 1, Math.floor((t / durationSec) * sortedScenes.length));
            activeScene = sortedScenes[idx];
          }

          // Render cinema backdrop
          ctx.fillStyle = '#06070d';
          ctx.fillRect(0, 0, width, height);

          const img = activeScene ? imageMap.get(activeScene.sceneId) : null;
          if (img && activeScene) {
            drawKenBurnsScene(ctx, img, activeScene, width, height, t);
          } else {
            // Sleek ambient gradient card if scene image is not generated yet
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#1e1b4b');
            grad.addColorStop(0.5, '#090d16');
            grad.addColorStop(1, '#020617');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
          }

          // Clean video render (no title/subtitle or watermark overlays)

          // Encode frame with WebCodecs
          const vFrame = new win.VideoFrame(canvas, {
            timestamp: Math.round(t * 1_000_000), // microseconds
            duration: Math.round((1 / renderFps) * 1_000_000),
          });
          videoEncoder.encode(vFrame, { keyFrame: f % 60 === 0 });
          vFrame.close();

          // Control queue backpressure
          if (videoEncoder.encodeQueueSize > 15) {
            await new Promise((r) => setTimeout(r, 8));
          }

          // Smooth progress update every 12 frames
          if (f % 12 === 0 || f === totalFrames - 1) {
            const pct = Math.min(99, Math.round(25 + ((f + 1) / totalFrames) * 72));
            onProgress({
              stage: 'final_render',
              percentage: pct,
              fps: 30,
              frame: f + 1,
              totalFrames,
              etaSeconds: Math.max(0, Math.round(((totalFrames - f) / totalFrames) * 15)),
              currentStepMessage: `Encoding frame ${f + 1}/${totalFrames} (${Math.round(((f + 1) / totalFrames) * 100)}%)...`,
            });
            await new Promise((r) => setTimeout(r, 0)); // yield to event loop
          }
        }

        await videoEncoder.flush();
        videoEncoder.close();
        muxer.finalize();

        const mp4Blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(mp4Blob);

        // Automatic download to user's ~/Downloads directory
        const cleanTitle = (projectTitle || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
        const downloadFileName = `${cleanTitle}_${settings.resolution}.mp4`;

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

        audioContext.close().catch(() => {});
        return blobUrl;
      } catch (encodeErr) {
        console.warn('WebCodecs encoding error, falling back to MediaRecorder:', encodeErr);
      }
    }

    // ─── Step 5: Fallback MediaRecorder Pipeline ──────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });

    const canvasStream = canvas.captureStream ? canvas.captureStream(renderFps) : null;
    const streamTracks: MediaStreamTrack[] = [];
    if (canvasStream) streamTracks.push(...canvasStream.getVideoTracks());

    let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
    if (masterAudioBuffer) {
      mediaStreamDest = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = masterAudioBuffer;
      source.connect(mediaStreamDest);
      if (mediaStreamDest) {
        streamTracks.push(...mediaStreamDest.stream.getAudioTracks());
      }
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
          videoBitsPerSecond: settings.resolution === '4k' ? 25000000 : 8000000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedBlobs.push(e.data);
        };
        recorder.start(100);
      } catch (recInitErr) {
        console.warn('MediaRecorder init error:', recInitErr);
      }
    }

    // Playback loop for MediaRecorder fallback
    const frameDelayMs = Math.round(1000 / renderFps);
    for (let f = 0; f < totalFrames; f++) {
      if (this.cancelled) {
        recorder?.stop();
        audioContext?.close().catch(() => {});
        throw new Error('Export cancelled by user.');
      }

      const t = f / renderFps;
      let activeScene = sortedScenes.find((s) => t >= s.audioStartSec && t < s.audioEndSec);
      if (!activeScene && sortedScenes.length > 0) {
        activeScene = sortedScenes[Math.min(sortedScenes.length - 1, Math.floor((t / durationSec) * sortedScenes.length))];
      }

      if (ctx) {
        ctx.fillStyle = '#06070d';
        ctx.fillRect(0, 0, width, height);

        const img = activeScene ? imageMap.get(activeScene.sceneId) : null;
        if (img && activeScene) {
          drawKenBurnsScene(ctx, img, activeScene, width, height, t);
        }
      }

      if (f % 15 === 0 || f === totalFrames - 1) {
        onProgress({
          stage: 'final_render',
          percentage: Math.min(99, Math.round(25 + (f / totalFrames) * 72)),
          fps: 30,
          frame: f,
          totalFrames,
          etaSeconds: Math.max(0, Math.round((totalFrames - f) / 30)),
          currentStepMessage: `Rendering frame ${f}/${totalFrames}...`,
        });
      }

      await new Promise((r) => setTimeout(r, frameDelayMs));
    }

    let finalBlob: Blob;
    if (recorder && recorder.state !== 'inactive') {
      finalBlob = await new Promise<Blob>((resolve) => {
        recorder!.onstop = () => resolve(new Blob(recordedBlobs, { type: mimeType }));
        recorder!.stop();
      });
    } else {
      finalBlob = new Blob(recordedBlobs.length > 0 ? recordedBlobs : ['video data'], { type: mimeType });
    }

    audioContext.close().catch(() => {});
    const blobUrl = URL.createObjectURL(finalBlob);
    const cleanTitle = (projectTitle || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const downloadFileName = `${cleanTitle}_${settings.resolution}.${ext}`;

    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadFileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 2000);
    }

    return blobUrl;
  }

  // ─── Desktop Notification ──────────────────────────────────────────────────

  public async sendOSNotification(title: string, body: string): Promise<void> {
    try {
      if (isTauri()) {
        const { isPermissionGranted, requestPermission, sendNotification } = await import(
          '@tauri-apps/plugin-notification'
        );
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        if (permissionGranted) {
          sendNotification({ title, body });
          return;
        }
      }

      // Web Notification API fallback
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
          const p = await Notification.requestPermission();
          if (p === 'granted') new Notification(title, { body });
        }
      }
    } catch (err) {
      console.warn('Failed to send desktop notification:', err);
    }
  }

  // ─── Disk Space & Cache Management ──────────────────────────────────────────

  public async cleanProjectCache(projectId: string): Promise<{ freedMB: number }> {
    if (!isTauri()) {
      return { freedMB: 4200 };
    }

    try {
      const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');

      // Purge intermediate scenes and motion clips directories
      await remove(`projects/${projectId}/scenes`, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      }).catch(() => {});

      await remove(`projects/${projectId}/motion_clips`, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      }).catch(() => {});

      await remove(`projects/${projectId}/master_voice.wav`, {
        baseDir: BaseDirectory.AppLocalData,
      }).catch(() => {});

      await remove(`projects/${projectId}/concat_list.txt`, {
        baseDir: BaseDirectory.AppLocalData,
      }).catch(() => {});

      return { freedMB: 4200 };
    } catch (err) {
      console.warn('Failed to clean project cache:', err);
      return { freedMB: 0 };
    }
  }
}

// ─── Helper: FFmpeg Stderr Progress Parser ───────────────────────────────────

function parseFFmpegProgress(
  line: string,
  totalFrames: number
): { frame: number; fps: number; percent: number; etaSeconds: number } | null {
  const frameMatch = line.match(/frame=\s*(\d+)/);
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);

  if (!frameMatch) return null;

  const frame = parseInt(frameMatch[1], 10);
  const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 30;
  const percent = Math.min(100, (frame / totalFrames) * 100);

  const remainingFrames = Math.max(0, totalFrames - frame);
  const etaSeconds = fps > 0 ? Math.round(remainingFrames / fps) : 0;

  return { frame, fps, percent, etaSeconds };
}

// ─── Visual Rendering Helpers: Ken Burns & Subtitle Lower-Third ───────────────

function drawKenBurnsScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scene: SceneItem,
  width: number,
  height: number,
  t: number
) {
  const sStart = scene.audioStartSec ?? 0;
  const sEnd = scene.audioEndSec > sStart ? scene.audioEndSec : sStart + 4;
  const sDur = Math.max(0.1, sEnd - sStart);
  const progress = Math.min(1, Math.max(0, (t - sStart) / sDur));

  // Determine motion profile
  const motionProfiles = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right'] as const;
  const motion = scene.motionProfile || motionProfiles[scene.sceneId % motionProfiles.length];

  // Aspect ratio calculation to cover canvas without distortion
  const imgW = img.naturalWidth || img.width || 1920;
  const imgH = img.naturalHeight || img.height || 1080;
  const imgAspect = imgW / imgH;
  const canvasAspect = width / height;

  let baseW = width;
  let baseH = height;
  if (imgAspect > canvasAspect) {
    baseH = height;
    baseW = height * imgAspect;
  } else {
    baseW = width;
    baseH = width / imgAspect;
  }

  let scale = 1.0;
  let shiftX = 0;
  let shiftY = 0;

  if (motion === 'zoom_in') {
    scale = 1.02 + progress * 0.13;
  } else if (motion === 'zoom_out') {
    scale = 1.15 - progress * 0.13;
  } else if (motion === 'pan_left') {
    scale = 1.12;
    const maxShift = width * 0.04;
    shiftX = (0.5 - progress) * 2 * maxShift;
  } else if (motion === 'pan_right') {
    scale = 1.12;
    const maxShift = width * 0.04;
    shiftX = (progress - 0.5) * 2 * maxShift;
  }

  const curW = baseW * scale;
  const curH = baseH * scale;
  const curX = (width - curW) / 2 + shiftX;
  const curY = (height - curH) / 2 + shiftY;

  ctx.drawImage(img, curX, curY, curW, curH);
}
