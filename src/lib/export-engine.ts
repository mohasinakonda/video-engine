/**
 * export-engine.ts — Pure Web SaaS Video Export Engine
 *
 * Provides:
 *  1. Single-Pass Encoding with Main-Thread Yielding: Renders full-length videos without tab hangs.
 *     Uses ONE muxer for the entire video (multi-blob concatenation is invalid for MP4).
 *     Yields the main thread every 10 frames (via setTimeout 0) to keep the browser responsive.
 *  2. Hardware Accelerated Encoding: WebCodecs (H.264/AVC) + mp4-muxer with MediaRecorder fallback.
 *  3. Ken Burns & Transition Animations: Smooth crossfade and pan/zoom cinema effects.
 *  4. Direct Browser Download: Saves rendered MP4 directly to user's Downloads folder.
 */

import type {
  AudioChunk,
  SceneItem,
  ExportSettings,
  ExportProgress,
  TransitionType,
} from '@/types';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { getMediaBlob } from '@/lib/media-storage';


export class ExportEngine {
  private cancelled = false;

  public cancel() {
    this.cancelled = true;
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
    projectTitle = 'video'
  ): Promise<string> {
    this.cancelled = false;

    const completedChunks = audioChunks.filter((c) => c.status === 'COMPLETED');
    const usableChunks = completedChunks.length > 0 ? completedChunks : audioChunks;

    const totalDurationMs = usableChunks.reduce((sum, c) => sum + (c.durationMs || 0), 0);
    const sceneMaxSec = scenes.length > 0 ? Math.max(...scenes.map((s) => s.audioEndSec || 0)) : 0;
    const totalDurationSec = totalDurationMs > 0
      ? totalDurationMs / 1000
      : (sceneMaxSec > 0 ? sceneMaxSec : (scenes.length > 0 ? scenes.length * 4.5 : 60));
    const fps = 30;
    const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));

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

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('AI Video Studio', { body: 'Your video export is ready and downloaded!' });
    }

    return browserUrl;
  }

  /**
   * High-Performance Segmented Chunk Browser Pipeline
   */
  private async renderFinalVideoBrowser(options: {
    projectId: string;
    projectTitle: string;
    scenes: SceneItem[];
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

    const renderFps = 30;
    const totalFrames = Math.max(1, Math.round(durationSec * renderFps));

    console.log(
      `[ExportEngine] Final timeline duration: ${durationSec.toFixed(2)}s (${Math.floor(durationSec / 60)}m ${Math.round(durationSec % 60)}s), totalFrames: ${totalFrames}, audioDuration: ${totalAudioDuration.toFixed(2)}s, optionsTotalSec: ${options.totalDurationSec}s`
    );

    // Dimensions based on resolution & ratio
    let width = 1920;
    let height = 1080;
    if (settings.aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
    } else if (settings.aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }
    if (settings.resolution === '4k') {
      width *= 2;
      height *= 2;
    } else if (settings.resolution === '720p') {
      if (settings.aspectRatio === '9:16') {
        width = 720;
        height = 1280;
      } else if (settings.aspectRatio === '1:1') {
        width = 720;
        height = 720;
      } else {
        width = 1280;
        height = 720;
      }
    }

    // ─── Step 2: Pre-load Scene Images into Memory ──────────────────────────────
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
    const sortedScenes = [...scenes].sort((a, b) => a.sceneId - b.sceneId);

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
              bitrate: settings.resolution === '4k' ? 25_000_000 : 8_000_000,
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
          bitrate: settings.resolution === '4k' ? 25_000_000 : 8_000_000,
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

          renderSceneWithTransitions(
            ctx,
            imageMap,
            sortedScenes,
            width,
            height,
            t,
            durationSec,
            settings.transitionType || 'crossfade',
            settings.transitionDurationSec ?? 0.6
          );

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
        const blobUrl = URL.createObjectURL(finalMp4Blob);

        const cleanTitle = (projectTitle || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
        const downloadFileName = `${cleanTitle}_${settings.resolution}.mp4`;

        if (typeof document !== 'undefined') {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadFileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); }, 2000);
        }

        if (audioContext) audioContext.close().catch(() => { });
        return blobUrl;
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
          videoBitsPerSecond: settings.resolution === '4k' ? 25000000 : 8000000,
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
        renderSceneWithTransitions(
          ctx,
          imageMap,
          sortedScenes,
          width,
          height,
          t,
          durationSec,
          settings.transitionType || 'crossfade',
          settings.transitionDurationSec ?? 0.6
        );
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

// ─── Ken Burns & Cinema Frame Renderer ────────────────────────────────────────

function renderSceneWithTransitions(
  ctx: CanvasRenderingContext2D,
  imageMap: Map<number, HTMLImageElement>,
  scenes: SceneItem[],
  width: number,
  height: number,
  t: number,
  totalDurationSec: number,
  transitionType: TransitionType,
  transitionDurationSec: number
) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  if (scenes.length === 0) return;

  let currentIdx = scenes.findIndex((s) => t >= (s.audioStartSec || 0) && t <= (s.audioEndSec || 0));
  if (currentIdx === -1) {
    if (t < (scenes[0].audioStartSec || 0)) currentIdx = 0;
    else currentIdx = scenes.length - 1;
  }

  const currentScene = scenes[currentIdx];
  const nextScene = scenes[currentIdx + 1];
  const sceneStart = currentScene.audioStartSec || 0;
  const sceneEnd = currentScene.audioEndSec || totalDurationSec;
  const sceneDuration = Math.max(0.1, sceneEnd - sceneStart);

  const timeInScene = t - sceneStart;
  const timeUntilEnd = sceneEnd - t;

  const currentImg = imageMap.get(currentScene.sceneId);

  // Check if we are in transition window to next scene
  const inTransition =
    nextScene &&
    transitionType !== 'none' &&
    timeUntilEnd <= transitionDurationSec &&
    imageMap.has(nextScene.sceneId);

  if (!inTransition) {
    if (currentImg) {
      drawKenBurnsImage(ctx, currentImg, width, height, timeInScene / sceneDuration, currentScene.motionProfile);
    }
    return;
  }

  // Draw transition between current and next scene
  const nextImg = imageMap.get(nextScene.sceneId)!;
  const transitionProgress = 1 - timeUntilEnd / transitionDurationSec; // 0 to 1

  if (transitionType === 'crossfade' || transitionType === 'fade_to_black') {
    if (currentImg) {
      ctx.globalAlpha = 1.0;
      drawKenBurnsImage(ctx, currentImg, width, height, timeInScene / sceneDuration, currentScene.motionProfile);
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, transitionProgress));
    drawKenBurnsImage(ctx, nextImg, width, height, 0, nextScene.motionProfile);
    ctx.globalAlpha = 1.0;
  } else if (transitionType === 'slide_left') {
    const offsetX = width * transitionProgress;
    ctx.save();
    ctx.translate(-offsetX, 0);
    if (currentImg) drawKenBurnsImage(ctx, currentImg, width, height, timeInScene / sceneDuration, currentScene.motionProfile);
    ctx.restore();

    ctx.save();
    ctx.translate(width - offsetX, 0);
    drawKenBurnsImage(ctx, nextImg, width, height, 0, nextScene.motionProfile);
    ctx.restore();
  } else {
    if (currentImg) {
      drawKenBurnsImage(ctx, currentImg, width, height, timeInScene / sceneDuration, currentScene.motionProfile);
    }
  }
}

function drawKenBurnsImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  progress: number, // 0 to 1
  motionProfile = 'zoom_in'
) {
  const p = Math.max(0, Math.min(1, progress));
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;

  if (motionProfile === 'zoom_in') {
    scale = 1.0 + p * 0.12; // 1.0 to 1.12
  } else if (motionProfile === 'zoom_out') {
    scale = 1.12 - p * 0.12; // 1.12 to 1.0
  } else if (motionProfile === 'pan_left') {
    scale = 1.1;
    offsetX = (1 - p) * (canvasWidth * 0.05);
  } else if (motionProfile === 'pan_right') {
    scale = 1.1;
    offsetX = -p * (canvasWidth * 0.05);
  } else {
    scale = 1.0 + p * 0.08;
  }

  const imgAspect = img.width / img.height;
  const canvasAspect = canvasWidth / canvasHeight;

  let drawW = canvasWidth * scale;
  let drawH = canvasHeight * scale;

  if (imgAspect > canvasAspect) {
    drawW = drawH * imgAspect;
  } else {
    drawH = drawW / imgAspect;
  }

  const x = (canvasWidth - drawW) / 2 + offsetX;
  const y = (canvasHeight - drawH) / 2 + offsetY;

  ctx.drawImage(img, x, y, drawW, drawH);
}
