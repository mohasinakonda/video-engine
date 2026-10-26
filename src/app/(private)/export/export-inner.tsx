'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Film,
  Music,
  FolderOpen,
  Sparkles,
  Loader2,
  ChevronLeft,
  Cpu,
  Volume2,
  Sliders,
  Monitor,
  Smartphone,
  Square,
  Gauge,
  Palette,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { getProject, saveProject } from '@/lib/store';
import { ExportEngine, measureRenderSpeed, outputDimensions, videoBitrateFor } from '@/lib/export-engine';
import { estimateRenderSec, formatRenderTime, readDeviceInfo, recommendQuality } from '@/lib/export-quality';
import { getMediaBlobUrl } from '@/lib/media-storage';
import { exportUniversalTimelineZip, TimelineExportProgress } from '@/lib/timeline-exporter';
import { CinemaPreviewPanel } from '@/components/export/cinema-preview-panel';
import type {
  ProjectManifest,
  ExportResolution,
  ExportFps,
  HardwareEncoder,
  ExportProgress,
  TransitionType,
  ExportSettings,
  VideoLook,
} from '@/types';

const TRANSITION_OPTIONS: { id: TransitionType; label: string; description: string; badge: string }[] = [
  { id: 'auto', label: "Director's Mix", description: 'Cuts, dissolves for slow moments, zoom and whip into fast ones', badge: 'Recommended' },
  { id: 'crossfade', label: 'Cross-Dissolve', description: 'Every scene blends into the next', badge: 'Soft' },
  { id: 'fade_black', label: 'Dip to Black', description: 'A short fade through black between scenes', badge: 'Classic Film' },
  { id: 'cut', label: 'Hard Cut', description: 'Straight cuts only, best for editing later', badge: 'Editor-friendly' },
];

const LOOK_OPTIONS: { id: VideoLook; label: string; description: string; swatch: string }[] = [
  { id: 'film', label: 'Film', description: 'Contrast, warm tint, vignette and grain', swatch: 'linear-gradient(90deg,#3b2f2a,#e0a870)' },
  { id: 'warm', label: 'Warm', description: 'Golden, nostalgic tone', swatch: 'linear-gradient(90deg,#7a3d12,#ffb257)' },
  { id: 'cool', label: 'Cool', description: 'Blue, moody, mysterious', swatch: 'linear-gradient(90deg,#10233f,#6fa3ff)' },
  { id: 'natural', label: 'Natural', description: 'No grade, the images as they are', swatch: 'linear-gradient(90deg,#666,#ddd)' },
];

export default function ExportInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id') || searchParams.get('projectId') || '';

  // ─── State ─────────────────────────────────────────────────────────────────
  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [loading, setLoading] = useState(true);

  // Configuration options
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [fps, setFps] = useState<ExportFps>(30);
  // This device's render speed at 1080p in frames per second: undefined while measuring, null if unknown.
  const [speed1080, setSpeed1080] = useState<number | null | undefined>(undefined);
  // Once the user picks a quality (or saved one earlier), the recommendation no longer changes it.
  const qualityChosenRef = useRef(false);
  const [encoder, setEncoder] = useState<HardwareEncoder>('auto');
  const [transitionType, setTransitionType] = useState<TransitionType>('auto');
  const [look, setLook] = useState<VideoLook>('film');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.6);
  const [outputPath, setOutputPath] = useState<string>('');

  // Render Execution State
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({
    stage: 'idle',
    percentage: 0,
    fps: 0,
    frame: 0,
    totalFrames: 0,
    etaSeconds: 0,
    currentStepMessage: '',
  });

  const [finalVideoUrl, setFinalVideoUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cleanedCache, setCleanedCache] = useState(false);
  const [freedSpaceMB, setFreedSpaceMB] = useState(0);

  // Timeline Export State
  const [isExportingTimeline, setIsExportingTimeline] = useState(false);
  const [timelineProgress, setTimelineProgress] = useState<TimelineExportProgress | null>(null);
  const [timelineExportSuccess, setTimelineExportSuccess] = useState(false);
  const [includeShotClips, setIncludeShotClips] = useState(true);

  const engineRef = useRef<ExportEngine | null>(null);

  // ─── Load Project ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!projectId) {
      router.push('/');
      return;
    }
    setLoading(true);
    try {
      const project = await getProject(projectId);
      if (!project) {
        router.push('/');
        return;
      }

      // Restore audio blobs from IndexedDB (check custom audio fallback if chunks empty)
      let rawChunks = project.audioChunks || [];
      if (rawChunks.length === 0) {
        const customUrl = await getMediaBlobUrl(`audio_${project.projectId}_0`);
        if (customUrl) {
          rawChunks = [
            {
              index: 0,
              text: project.customAudioFileName || 'Uploaded Voiceover',
              filePath: `projects/${project.projectId}/audio/custom_voice.mp3`,
              durationMs: project.totalDurationMs || 0,
              status: 'COMPLETED',
              audioUrl: customUrl,
            },
          ];
        }
      }

      const restoredChunks = await Promise.all(
        rawChunks.map(async (chunk) => {
          if (chunk.audioUrl && !chunk.audioUrl.startsWith('blob:')) return chunk;
          const url = await getMediaBlobUrl(`audio_${project.projectId}_${chunk.index}`);
          return { ...chunk, audioUrl: url || undefined };
        })
      );

      // Restore scene image blobs from IndexedDB
      const restoredScenes = await Promise.all(
        (project.scenes || []).map(async (scene) => {
          if (scene.imageUrl && !scene.imageUrl.startsWith('blob:')) return scene;
          const url = await getMediaBlobUrl(`scene_${project.projectId}_${scene.sceneId}`);
          return { ...scene, imageUrl: url || undefined };
        })
      );

      const restoredProject: ProjectManifest = {
        ...project,
        audioChunks: restoredChunks,
        scenes: restoredScenes,
      };
      setProject(restoredProject);

      // Restore aspect ratio from project or saved export settings
      if (project.aspectRatio) {
        setAspectRatio(project.aspectRatio);
      } else if (project.exportSettings?.aspectRatio) {
        setAspectRatio(project.exportSettings.aspectRatio);
      }

      // Restore saved export settings if present
      if (project.exportSettings) {
        setResolution(project.exportSettings.resolution ?? '1080p');
        setFps(project.exportSettings.fps ?? 30);
        qualityChosenRef.current = true;
        setEncoder(project.exportSettings.encoder ?? 'auto');

        setOutputPath(project.exportSettings.outputPath ?? '');
        if (project.exportSettings.transitionType) setTransitionType(project.exportSettings.transitionType);
        if (project.exportSettings.look) setLook(project.exportSettings.look);
        if (project.exportSettings.transitionDurationSec) setTransitionDuration(project.exportSettings.transitionDurationSec);
      }

      if (project.finalVideoPath) {
        setFinalVideoUrl(project.finalVideoPath);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    load();
  }, [load]);



  // ─── Device speed & quality recommendation ─────────────────────────────────
  const durationSec = useMemo(() => {
    if (!project) return 0;
    if (project.totalDurationMs > 0) return project.totalDurationMs / 1000;
    return Math.max(0, ...(project.scenes || []).map((s) => s.audioEndSec || 0));
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const size = outputDimensions({ resolution: '1080p', aspectRatio });
    const cacheKey = `render-speed:${size.width}x${size.height}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setSpeed1080(Number(cached));
        return;
      }
    } catch { }
    let cancelled = false;
    setSpeed1080(undefined);
    measureRenderSpeed(size)
      .catch(() => null)
      .then((speed) => {
        if (cancelled) return;
        setSpeed1080(speed);
        if (speed) {
          try { sessionStorage.setItem(cacheKey, String(speed)); } catch { }
        }
      });
    return () => {
      cancelled = true;
    };
    // Measured once per project and aspect ratio; the result is cached for the browser session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.projectId, aspectRatio]);

  const recommendation = useMemo(
    () => (speed1080 === undefined || durationSec <= 0 ? null : recommendQuality({ speed1080, device: readDeviceInfo(), durationSec })),
    [speed1080, durationSec]
  );

  useEffect(() => {
    if (!recommendation || qualityChosenRef.current) return;
    setResolution(recommendation.option.resolution);
    setFps(recommendation.option.fps);
  }, [recommendation]);

  function chooseQuality(next: { resolution?: ExportResolution; fps?: ExportFps }) {
    qualityChosenRef.current = true;
    if (next.resolution) setResolution(next.resolution);
    if (next.fps) setFps(next.fps);
  }

  /** "~6 min on this device" for an option, once the speed is known. */
  function renderTimeLabel(option: { resolution: ExportResolution; fps: ExportFps }): string | null {
    if (!speed1080 || durationSec <= 0) return null;
    return `~${formatRenderTime(estimateRenderSec(speed1080, durationSec, option))} on this device`;
  }

  // Leaving the page would stop the render.
  useEffect(() => {
    if (!isExporting) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isExporting]);

  const downloadFileName = `${project?.title?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'video'}_${aspectRatio.replace(':', 'x')}_${resolution}.mp4`;

  // ─── Start Export ──────────────────────────────────────────────────────────
  async function handleStartExport() {
    if (!project) return;
    setIsExporting(true);
    setErrorMsg('');
    setCleanedCache(false);
    setFinalVideoUrl('');
    setProgress({
      stage: 'idle',
      percentage: 0,
      fps: 0,
      frame: 0,
      totalFrames: 0,
      etaSeconds: 0,
      currentStepMessage: 'Initializing audio and visual engines...',
    });

    const settings: ExportSettings = {
      resolution,
      fps,
      encoder,
      aspectRatio,

      outputPath: outputPath || downloadFileName,
      transitionType,
      transitionDurationSec: transitionDuration,
      look,
    };

    const updatedProject: ProjectManifest = {
      ...project,
      exportSettings: settings,
      updatedAt: Date.now(),
    };
    await saveProject(updatedProject);
    setProject(updatedProject);

    engineRef.current = new ExportEngine();

    try {
      const resultPath = await engineRef.current.execute(
        projectId,
        project.audioChunks,
        project.scenes || [],
        settings,
        (prog) => setProgress(prog),
        project.title,
        project.spokenWords
      );

      setFinalVideoUrl(resultPath);
      await saveProject({
        ...updatedProject,
        finalVideoPath: resultPath,
        updatedAt: Date.now(),
      });
      showToast('Video export completed! File downloaded.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setProgress((prev) => ({ ...prev, stage: 'failed', error: msg }));
    } finally {
      setIsExporting(false);
    }
  }

  function handleCancelExport() {
    engineRef.current?.cancel();
    setIsExporting(false);
    setProgress((prev) => ({
      ...prev,
      stage: 'idle',
      currentStepMessage: 'Export cancelled',
    }));
  }

  // ─── Clean Cache ────────────────────────────────────────────────────────────
  async function handleCleanCache() {
    if (!project) return;
    const engine = engineRef.current || new ExportEngine();
    const res = await engine.cleanProjectCache(projectId);
    setCleanedCache(true);
    setFreedSpaceMB(res.freedMB);
    showToast(`Temporary project cache cleaned! Freed ${res.freedMB > 0 ? (res.freedMB / 1024).toFixed(1) + ' GB' : 'disk space'}`);
  }

  function handleOpenFolder() {
    if (finalVideoUrl) {
      window.open(finalVideoUrl, '_blank');
    }
  }

  // ─── Universal Timeline Package Export ─────────────────────────────────────
  async function handleExportTimeline() {
    if (!project) return;
    setIsExportingTimeline(true);
    setTimelineExportSuccess(false);
    setTimelineProgress({ message: 'Preparing timeline package...', percentage: 5 });

    const cleanTitle = (project.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFileName = `${cleanTitle}_Timeline_Package.zip`;
    try {
      // With shot clips the ZIP is about as big as the video, so it is written straight to disk
      // when the browser allows (asked first, while the click still counts as a user gesture).
      let saveTo: FileSystemFileHandle | null = null;
      const picker = (window as unknown as {
        showSaveFilePicker?: (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker;
      if (includeShotClips && picker) {
        try {
          saveTo = await picker({ suggestedName: zipFileName, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }

      const zipBlob = await exportUniversalTimelineZip(project, (p) => setTimelineProgress(p), {
        settings: {
          resolution,
          fps,
          encoder,
          aspectRatio,
          outputPath: '',
          transitionType,
          transitionDurationSec: transitionDuration,
          look,
        },
        shotClipsEngine: includeShotClips ? new ExportEngine() : undefined,
        saveTo,
      });

      if (zipBlob && typeof document !== 'undefined') {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
      }

      setTimelineExportSuccess(true);
      showToast(saveTo ? `Timeline package saved as ${saveTo.name}.` : 'Timeline ZIP package generated and downloaded!');
    } catch (err: unknown) {
      console.error('Timeline export failed:', err);
      showToast('Timeline export failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExportingTimeline(false);
    }
  }

  if (loading || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-base min-h-screen">
      {/* ─── Studio Top Header ────────────────────────────────────────────── */}
      <header className="px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/storyboard?id=${projectId}`)}
            className="btn-ghost p-1.5"
            title="Back to Storyboard"
          >
            <ChevronLeft size={16} />
          </button>

          <div>
            <h1 className="text-sm font-bold text-white leading-tight flex items-center gap-2">
              <span>{project.title}</span>
              <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                Phase 3 · Launch Studio
              </span>
            </h1>
            <p className="text-xxs text-zinc-400 mt-0.5">
              Production Render & YouTube Viral Packaging
            </p>
          </div>
        </div>

        {/* YouTube Kit Studio Link */}
        <div className="flex items-center gap-2">
          <Link
            href={`/youtube-kit-studio?id=${project.projectId}`}
            className="btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-2"
            title="Open YouTube Kit Studio for this video"
          >
            <Sparkles size={14} className="text-rose-400" />
            <span>YouTube Kit Studio</span>
          </Link>
        </div>
      </header>

      {/* ─── Main Two-Column Studio Layout ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column (7 cols): Active Tab Workspace */}
            <div className="lg:col-span-7 space-y-6">

              {/* TAB 1: Master Video Render & Audio Engine Settings */}
              <div className="space-y-6 animate-fade-in">

                {/* Aspect Ratio Format */}
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-zinc-300" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                        Video Aspect Ratio
                      </h2>
                    </div>
                    <span className="text-2xs font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                      {aspectRatio === '16:9'
                        ? '1920 × 1080 (Landscape)'
                        : aspectRatio === '9:16'
                          ? '1080 × 1920 (Vertical)'
                          : '1080 × 1080 (Square)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAspectRatio('16:9')}
                      className={`p-3.5 rounded-xl border text-center transition-all ${aspectRatio === '16:9'
                        ? 'bg-zinc-800 border-white/50 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >
                      <Monitor size={18} className="mx-auto mb-1.5" />
                      <p className="text-xs font-bold">16:9 Landscape</p>
                      <p className="text-2xs text-zinc-400 mt-0.5">YouTube / Desktop</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAspectRatio('9:16')}
                      className={`p-3.5 rounded-xl border text-center transition-all ${aspectRatio === '9:16'
                        ? 'bg-zinc-800 border-white/50 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >
                      <Smartphone size={18} className="mx-auto mb-1.5" />
                      <p className="text-xs font-bold">9:16 Portrait</p>
                      <p className="text-2xs text-zinc-400 mt-0.5">Reels / Shorts / TikTok</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAspectRatio('1:1')}
                      className={`p-3.5 rounded-xl border text-center transition-all ${aspectRatio === '1:1'
                        ? 'bg-zinc-800 border-white/50 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                    >
                      <Square size={18} className="mx-auto mb-1.5" />
                      <p className="text-xs font-bold">1:1 Square</p>
                      <p className="text-2xs text-zinc-400 mt-0.5">Instagram Feed</p>
                    </button>
                  </div>
                </div>

                {/* Resolution Profile */}
                <div className="card space-y-3">
                  <div className="flex items-center gap-2">
                    <Film size={15} className="text-zinc-300" />
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                      Output Quality
                    </h2>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {(['720p', '1080p', '4k'] as const).map((res) => {
                      const size = outputDimensions({ resolution: res, aspectRatio });
                      const label = { '720p': '720p HD', '1080p': '1080p Full HD', '4k': '4K Ultra HD' }[res];
                      const estimate = renderTimeLabel({ resolution: res, fps });
                      return (
                        <button
                          key={res}
                          type="button"
                          onClick={() => chooseQuality({ resolution: res })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${resolution === res
                            ? 'bg-zinc-800 border-zinc-500 text-white'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                        >
                          <p className="text-sm font-bold text-white">{label}</p>
                          <p className="text-xxs text-zinc-400 mt-0.5">
                            {size.width}×{size.height} · {Math.round(videoBitrateFor(res, fps) / 1_000_000)} Mbps
                          </p>
                          {estimate && <p className="text-2xs text-zinc-500 mt-1">{estimate}</p>}
                          {recommendation?.option.resolution === res && (
                            <span className="inline-block mt-2 text-2xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                              Recommended
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {([30, 24] as const).map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => chooseQuality({ fps: rate })}
                        className={`p-3 rounded-xl border text-left transition-all ${fps === rate
                          ? 'bg-zinc-800 border-zinc-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                      >
                        <p className="text-xs font-bold text-white">
                          {rate} FPS
                          {recommendation?.option.fps === rate && (
                            <span className="ml-2 text-2xs font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                              Recommended
                            </span>
                          )}
                        </p>
                        <p className="text-2xs text-zinc-400 mt-0.5">
                          {rate === 30 ? 'Smoothest motion' : 'Film look, renders about 20% faster'}
                        </p>
                      </button>
                    ))}
                  </div>

                  <p className="flex items-start gap-2 text-2xs text-zinc-400">
                    <Gauge size={13} className="mt-px flex-shrink-0 text-zinc-500" />
                    {speed1080 === undefined
                      ? 'Checking how fast this device renders video…'
                      : recommendation
                        ? `${recommendation.reason} The render runs on this device; keep this tab open until it finishes.`
                        : 'The render runs on this device; keep this tab open until it finishes.'}
                  </p>
                </div>

                {/* Hardware Acceleration */}
                <div className="card space-y-3">
                  <div className="flex items-center gap-2">
                    <Cpu size={15} className="text-zinc-400" />
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                      Hardware Encoder
                    </h2>
                  </div>

                  <select
                    className="select"
                    value={encoder}
                    onChange={(e) => setEncoder(e.target.value as HardwareEncoder)}
                  >
                    <option value="auto">⚡ Auto (Best Available GPU/Hardware)</option>
                    <option value="h264_videotoolbox">Apple Silicon (VideoToolbox H.264)</option>
                    <option value="h264_nvenc">NVIDIA GPU (NVENC H.264)</option>
                    <option value="h264_qsv">Intel QuickSync (QSV H.264)</option>
                    <option value="libx264">Standard CPU (libx264 Software)</option>
                  </select>
                </div>

                {/* Scene Transitions */}
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-zinc-400" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                        Scene Transitions & Blending
                      </h2>
                    </div>
                    <span className="text-2xs font-mono text-zinc-300 font-semibold bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
                      {TRANSITION_OPTIONS.find((o) => o.id === transitionType)?.label ?? 'Hard Cut'}
                      {transitionType !== 'cut' && ` · ${transitionDuration}s`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TRANSITION_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTransitionType(option.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${transitionType === option.id
                          ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                      >
                        <p className="text-xs font-bold text-white">{option.label}</p>
                        <p className="text-2xs text-zinc-400 mt-0.5">{option.description}</p>
                        <span className="inline-block mt-2 text-3xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-medium">
                          {option.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-2xs text-zinc-500">
                    Each scene&apos;s image is filmed as several shots (wide, close, medium) cut on the narration&apos;s pauses; this setting
                    picks how one scene leads into the next.
                  </p>

                  {transitionType !== 'cut' && (
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-xs text-zinc-400 font-medium">Transition Duration:</span>
                      <div className="flex items-center gap-1.5">
                        {[0.4, 0.6, 0.8].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setTransitionDuration(sec)}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${transitionDuration === sec
                              ? 'bg-white text-zinc-950 font-bold shadow-sm'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                              }`}
                          >
                            {sec}s {sec === 0.4 ? '(Snappy)' : sec === 0.6 ? '(Natural)' : '(Cinematic)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>



                {/* Look */}
                <div className="card space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette size={15} className="text-zinc-400" />
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">Look</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {LOOK_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLook(option.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${look === option.id
                          ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                      >
                        <span className="block h-1.5 w-10 rounded-full mb-2" style={{ background: option.swatch }} />
                        <p className="text-xs font-bold text-white">{option.label}</p>
                        <p className="text-2xs text-zinc-400 mt-0.5">{option.description}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-2xs text-zinc-500">
                    One grade over every scene makes AI images with different colours feel like a single film. Pick Natural to grade it
                    yourself in your editor.
                  </p>
                </div>

                {/* Destination */}
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={15} className="text-zinc-400" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                        Export Destination
                      </h2>
                    </div>
                    <span className="text-2xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Downloads Folder (~/Downloads)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1 text-xs font-mono"
                      placeholder={downloadFileName}
                      value={outputPath || downloadFileName}
                      onChange={(e) => setOutputPath(e.target.value)}
                      readOnly
                    />
                  </div>
                  <p className="text-xxs text-zinc-400">
                    Rendered videos are automatically saved directly into your computer&apos;s Downloads folder.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Persistent Cinema Preview & Master Actions */}
            <div className="lg:col-span-5 sticky top-6">
              <CinemaPreviewPanel
                project={project}
                aspectRatio={aspectRatio}
                resolution={resolution}
                fps={fps}
                isExporting={isExporting}
                progress={progress}
                finalVideoUrl={finalVideoUrl}
                downloadFileName={downloadFileName}
                errorMsg={errorMsg}
                cleanedCache={cleanedCache}
                freedSpaceMB={freedSpaceMB}
                isExportingTimeline={isExportingTimeline}
                includeShotClips={includeShotClips}
                onIncludeShotClipsChange={setIncludeShotClips}
                timelineProgress={timelineProgress}
                timelineExportSuccess={timelineExportSuccess}
                onStartExport={handleStartExport}
                onCancelExport={handleCancelExport}
                onExportTimeline={handleExportTimeline}
                onCleanCache={handleCleanCache}
                onReExport={() => {
                  setProgress({
                    stage: 'idle',
                    percentage: 0,
                    fps: 0,
                    frame: 0,
                    totalFrames: 0,
                    etaSeconds: 0,
                    currentStepMessage: '',
                  });
                  setFinalVideoUrl('');
                }}
                onOpenFolder={handleOpenFolder}
              />
            </div>
          </div>
      </div>

    </div>
  );
}
