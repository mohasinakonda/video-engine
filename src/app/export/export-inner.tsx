'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Video,
  Film,
  Music,
  FolderOpen,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Trash2,
  Cpu,
  Volume2,
  Download,
  StopCircle,
  ExternalLink,
  Layers,
  FileArchive,
  FileText,
  HelpCircle,
  Check,
  ChevronDown,
  ChevronUp,
  HardDrive,
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { getProject, saveProject } from '@/lib/store';
import { ExportEngine } from '@/lib/export-engine';
import { getMediaBlobUrl } from '@/lib/media-storage';
import { exportUniversalTimelineZip, TimelineExportProgress } from '@/lib/timeline-exporter';
import type {
  ProjectManifest,
  ExportResolution,
  HardwareEncoder,
  ExportProgress,
  TransitionType,
  ExportSettings,
} from '@/types';

function formatDuration(ms: number): string {
  if (!ms) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ExportInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id') ?? '';

  // ─── State ─────────────────────────────────────────────────────────────────
  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [loading, setLoading] = useState(true);

  // Configuration options
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [encoder, setEncoder] = useState<HardwareEncoder>('auto');
  const [transitionType, setTransitionType] = useState<TransitionType>('crossfade');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.6);
  const [bgmFilePath, setBgmFilePath] = useState<string>('');
  const [bgmFileName, setBgmFileName] = useState<string>('');
  const [bgmVolume, setBgmVolume] = useState<number>(0.15);
  const [enableAutoDucking, setEnableAutoDucking] = useState<boolean>(true);
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
  const [showImportGuide, setShowImportGuide] = useState(false);

  const engineRef = useRef<ExportEngine | null>(null);

  // ─── Load Project ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!projectId) {
      router.push('/');
      return;
    }
    setLoading(true);
    try {
      const p = await getProject(projectId);
      if (!p) {
        router.push('/');
        return;
      }
      // Restore audio blobs from IndexedDB
      const restoredChunks = await Promise.all(
        (p.audioChunks || []).map(async (c) => {
          if (c.audioUrl) return c;
          const url = await getMediaBlobUrl(`audio_${p.projectId}_${c.index}`);
          return { ...c, audioUrl: url || undefined };
        })
      );

      // Restore scene image blobs from IndexedDB
      const restoredScenes = await Promise.all(
        (p.scenes || []).map(async (s) => {
          if (s.imageUrl) return s;
          const url = await getMediaBlobUrl(`scene_${p.projectId}_${s.sceneId}`);
          return { ...s, imageUrl: url || undefined };
        })
      );

      const restoredProject: ProjectManifest = {
        ...p,
        audioChunks: restoredChunks,
        scenes: restoredScenes,
      };
      setProject(restoredProject);

      // Restore saved export settings if present
      if (p.exportSettings) {
        setResolution(p.exportSettings.resolution ?? '1080p');
        setEncoder(p.exportSettings.encoder ?? 'auto');
        setBgmFilePath(p.exportSettings.bgmFilePath ?? '');
        setBgmVolume(p.exportSettings.bgmVolume ?? 0.15);
        setEnableAutoDucking(p.exportSettings.enableAutoDucking ?? true);
        setOutputPath(p.exportSettings.outputPath ?? '');
        if (p.exportSettings.transitionType) setTransitionType(p.exportSettings.transitionType);
        if (p.exportSettings.transitionDurationSec) setTransitionDuration(p.exportSettings.transitionDurationSec);
      }

      if (p.finalVideoPath) {
        setFinalVideoUrl(p.finalVideoPath);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── File Pickers (Tauri / Browser) ─────────────────────────────────────────

  async function handleSelectBgmFile() {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a'] }],
      });
      if (selected && typeof selected === 'string') {
        setBgmFilePath(selected);
        setBgmFileName(selected.split('/').pop() || selected.split('\\').pop() || 'Background Music');
      }
    } else {
      // Browser input fallback
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setBgmFilePath(url);
          setBgmFileName(file.name);
        }
      };
      input.click();
    }
  }

  const downloadFileName = `${project?.title?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'video'}_${resolution}.mp4`;

  async function handleSelectOutputPath() {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const selected = await save({
        defaultPath: downloadFileName,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      });
      if (selected) {
        setOutputPath(selected);
      }
    } else {
      setOutputPath(downloadFileName);
    }
  }

  // ─── Start Export ──────────────────────────────────────────────────────────

  async function handleStartExport() {
    if (!project) return;
    setIsExporting(true);
    setErrorMsg('');
    setCleanedCache(false);

    const settings: ExportSettings = {
      resolution,
      encoder,
      bgmFilePath,
      bgmVolume,
      enableAutoDucking,
      outputPath: outputPath || downloadFileName,
      transitionType,
      transitionDurationSec: transitionDuration,
    };

    // Save settings to project manifest
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
        project.title
      );

      setFinalVideoUrl(resultPath);
      await saveProject({
        ...updatedProject,
        finalVideoPath: resultPath,
        updatedAt: Date.now(),
      });
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
  }

  // ─── Open Folder / Play Video ──────────────────────────────────────────────

  async function handleOpenFolder() {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { Command } = await import('@tauri-apps/plugin-shell');
      const target = finalVideoUrl || outputPath;
      if (target) {
        Command.create('open', ['-R', target]).execute().catch(() => {});
      }
    } else if (finalVideoUrl) {
      // In browser: open video in a new tab for playback and viewing
      window.open(finalVideoUrl, '_blank');
    }
  }

  // ─── Universal Timeline Package Export ─────────────────────────────────────

  async function handleExportTimeline() {
    if (!project) return;
    setIsExportingTimeline(true);
    setTimelineExportSuccess(false);
    setTimelineProgress({ message: 'Preparing timeline package...', percentage: 5 });

    try {
      const zipBlob = await exportUniversalTimelineZip(project, (progress) => {
        setTimelineProgress(progress);
      });

      const cleanTitle = (project.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
      const zipFileName = `${cleanTitle}_Timeline_Package.zip`;
      const url = URL.createObjectURL(zipBlob);

      if (typeof document !== 'undefined') {
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
    } catch (err: unknown) {
      console.error('Timeline export failed:', err);
      alert('Timeline export failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExportingTimeline(false);
    }
  }

  // ─── Derived calculations ─────────────────────────────────────────────────

  const totalDurationMs = project?.totalDurationMs ?? 0;
  const completedChunks = project?.audioChunks?.filter((c) => c.status === 'COMPLETED').length ?? 0;
  const readyClips = project?.scenes?.filter((s) => s.status === 'MOTION_READY').length ?? 0;
  const totalScenes = project?.scenes?.length ?? 0;
  const estFileSizeMB = resolution === '4k' ? Math.round((totalDurationMs / 1000) * 4) : Math.round((totalDurationMs / 1000) * 1.2);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <Loader2 size={24} className="animate-spin text-accent-purple" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/storyboard?id=${projectId}`)}
              className="btn-ghost p-1.5"
              title="Back to Storyboard"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 border border-accent-purple/30 flex items-center justify-center">
              <Download size={16} className="text-accent-cyan" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">{project?.title}</h1>
              <p className="text-[10px] text-slate-500">Phase 3 · Assembly, Audio Sync & Hardware Render</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Render Progress Overlay / Card */}
            {(isExporting || progress.stage === 'completed' || progress.stage === 'failed') && (
              <div className="card p-6 bg-gradient-to-br from-bg-surface to-bg-elevated border-accent-purple/40 glow-purple animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {progress.stage === 'completed' ? (
                      <CheckCircle2 size={24} className="text-emerald-400" />
                    ) : progress.stage === 'failed' ? (
                      <AlertTriangle size={24} className="text-red-400" />
                    ) : (
                      <Loader2 size={24} className="animate-spin text-accent-cyan" />
                    )}
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {progress.stage === 'completed'
                          ? 'Export Render Complete!'
                          : progress.stage === 'failed'
                          ? 'Export Failed'
                          : 'Rendering Final Video...'}
                      </h2>
                      <p className="text-xs text-slate-400">{progress.currentStepMessage}</p>
                    </div>
                  </div>

                  {isExporting && (
                    <button
                      onClick={handleCancelExport}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      <StopCircle size={14} />
                      Cancel
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Progress: {progress.percentage}%</span>
                    {progress.fps > 0 && <span>Speed: {progress.fps} FPS</span>}
                    {progress.etaSeconds > 0 && (
                      <span className="font-mono text-accent-cyan">ETA: {formatEta(progress.etaSeconds)}</span>
                    )}
                  </div>
                  <div className="h-3 bg-bg-base rounded-full overflow-hidden border border-bg-border">
                    <div
                      className="h-full bg-gradient-to-r from-accent-purple via-accent-purple-light to-accent-cyan transition-all duration-300 rounded-full"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-300">
                    {errorMsg}
                  </div>
                )}

                {/* Post-Render Actions */}
                {progress.stage === 'completed' && (
                  <div className="mt-6 pt-6 border-t border-bg-border space-y-5">
                    {/* Success Alert */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300">
                      <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">Video export ready and downloaded!</p>
                        <p className="text-[11px] text-emerald-300/80 mt-0.5">
                          Saved to your computer as <strong className="font-mono text-emerald-200">{downloadFileName}</strong>
                        </p>
                      </div>
                    </div>

                    {/* In-App Video Player Preview */}
                    {finalVideoUrl && (
                      <div className="relative rounded-2xl overflow-hidden border border-accent-purple/30 bg-black aspect-video shadow-2xl shadow-purple-950/40">
                        <video
                          src={finalVideoUrl}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {finalVideoUrl && (
                        <a
                          href={finalVideoUrl}
                          download={downloadFileName}
                          className="btn-primary flex items-center gap-2"
                        >
                          <Download size={15} />
                          Download Video Again
                        </a>
                      )}
                      {finalVideoUrl && (
                        <button onClick={handleOpenFolder} className="btn-secondary flex items-center gap-2">
                          <ExternalLink size={15} />
                          Open in New Tab
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setProgress({ stage: 'idle', percentage: 0, fps: 0, frame: 0, totalFrames: 0, etaSeconds: 0, currentStepMessage: '' });
                          setFinalVideoUrl('');
                        }}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <RotateCcw size={15} />
                        Re-export Video
                      </button>
                    </div>

                    {/* Cache Cleaner Prompt */}
                    <div className="p-4 rounded-xl bg-bg-base/70 border border-bg-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <HardDrive size={20} className="text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-white">Clean temporary project cache?</p>
                          <p className="text-[11px] text-slate-400">
                            Frees up ~4.2 GB of intermediate scene images & motion clips from your disk.
                          </p>
                        </div>
                      </div>
                      {cleanedCache ? (
                        <span className="text-xs text-emerald-400 font-medium px-3 py-1.5 bg-emerald-950/40 rounded-lg border border-emerald-800/40 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          Freed {freedSpaceMB > 0 ? `${(freedSpaceMB / 1024).toFixed(1)} GB` : 'Disk Space'}
                        </span>
                      ) : (
                        <button onClick={handleCleanCache} className="btn-secondary text-xs">
                          <Trash2 size={13} className="text-amber-400" />
                          Clean Cache
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export Configuration Grid */}
            {!isExporting && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left (2 cols): Settings Form */}
                <div className="md:col-span-2 space-y-6">

                  {/* 1. Resolution Profile */}
                  <div className="card space-y-3">
                    <div className="flex items-center gap-2">
                      <Film size={15} className="text-accent-purple-light" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">Output Resolution</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setResolution('1080p')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          resolution === '1080p'
                            ? 'bg-accent-purple/20 border-accent-purple-light text-white glow-purple'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-sm font-bold text-white">1080p Full HD</p>
                        <p className="text-[11px] text-slate-400 mt-1">1920×1080 · 30 FPS · 8–10 Mbps</p>
                        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-accent-purple/30 text-purple-200">
                          Recommended
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setResolution('4k')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          resolution === '4k'
                            ? 'bg-accent-cyan/20 border-accent-cyan text-white glow-cyan'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-sm font-bold text-white">4K Ultra HD</p>
                        <p className="text-[11px] text-slate-400 mt-1">3840×2160 · 30 FPS · 25–35 Mbps</p>
                        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          Ultra Quality
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Hardware Acceleration */}
                  <div className="card space-y-3">
                    <div className="flex items-center gap-2">
                      <Cpu size={15} className="text-accent-cyan" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">Hardware Encoder</h2>
                    </div>

                    <select
                      className="input"
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

                  {/* 3. Cinematic Scene Transitions */}
                  <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-purple-400" />
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">Scene Transitions & Blending</h2>
                      </div>
                      <span className="text-[10px] font-mono text-purple-300 font-semibold bg-purple-950/70 border border-purple-800/40 px-2 py-0.5 rounded">
                        {transitionType === 'crossfade' ? 'Cross-Dissolve' : transitionType === 'fade_black' ? 'Dip to Black' : 'Direct Cut'} · {transitionDuration}s
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setTransitionType('crossfade')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          transitionType === 'crossfade'
                            ? 'bg-accent-purple/20 border-accent-purple text-white shadow-lg shadow-purple-950/40 glow-purple'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-xs font-bold text-white">Cross-Dissolve</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Smooth, seamless blending between images</p>
                        <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-accent-purple/30 text-purple-200 font-medium">
                          Recommended
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTransitionType('fade_black')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          transitionType === 'fade_black'
                            ? 'bg-accent-cyan/20 border-accent-cyan text-white shadow-lg shadow-cyan-950/40 glow-cyan'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-xs font-bold text-white">Dip to Black</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Gentle fade to black breath between scenes</p>
                        <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
                          Classic Film
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTransitionType('cut')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          transitionType === 'cut'
                            ? 'bg-slate-800 border-slate-500 text-white shadow-lg'
                            : 'bg-bg-elevated border-bg-border text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <p className="text-xs font-bold text-white">Hard Cut</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Instant switch without transition blending</p>
                        <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                          Fast Montage
                        </span>
                      </button>
                    </div>

                    {transitionType !== 'cut' && (
                      <div className="pt-2 border-t border-bg-border flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Transition Duration:</span>
                        <div className="flex items-center gap-1.5">
                          {[0.4, 0.6, 0.8].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => setTransitionDuration(sec)}
                              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                                transitionDuration === sec
                                  ? 'bg-purple-600 text-white shadow-md font-bold'
                                  : 'bg-bg-elevated text-slate-400 hover:text-white'
                              }`}
                            >
                              {sec}s {sec === 0.4 ? '(Snappy)' : sec === 0.6 ? '(Natural)' : '(Cinematic)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500">
                      ✨ Seamlessly preserves Ken Burns pan/zoom motion across cuts. Includes 0.5s fade-in from black at video start and 0.8s fade-out at end.
                    </p>
                  </div>

                  {/* 4. Background Music & Auto-Ducking */}
                  <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music size={15} className="text-emerald-400" />
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">Background Music & Audio Ducking</h2>
                      </div>
                    </div>

                    {/* BGM File Picker */}
                    <div className="space-y-2">
                      <label className="label">Background Music File (Optional)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          className="input flex-1 font-mono text-xs"
                          placeholder="No background music selected"
                          value={bgmFileName || bgmFilePath}
                        />
                        <button type="button" onClick={handleSelectBgmFile} className="btn-secondary text-xs">
                          <Music size={13} />
                          Browse
                        </button>
                        {bgmFilePath && (
                          <button
                            type="button"
                            onClick={() => { setBgmFilePath(''); setBgmFileName(''); }}
                            className="btn-ghost text-xs text-red-400"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {bgmFilePath && (
                      <div className="space-y-3 pt-2 border-t border-bg-border">
                        {/* BGM Volume Slider */}
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Volume2 size={13} /> Base Volume
                            </span>
                            <span className="text-white font-mono">{Math.round(bgmVolume * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.5"
                            step="0.01"
                            value={bgmVolume}
                            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                            className="w-full accent-accent-purple"
                          />
                        </div>

                        {/* Dynamic Auto-Ducking Toggle */}
                        <label className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableAutoDucking}
                            onChange={(e) => setEnableAutoDucking(e.target.checked)}
                            className="rounded accent-accent-purple w-4 h-4"
                          />
                          <div>
                            <p className="text-xs font-medium text-white">Enable Dynamic Auto-Ducking</p>
                            <p className="text-[10px] text-slate-400">
                              Automatically drops BGM volume to -18dB..-24dB when voiceover is active.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* 4. Export Destination */}
                  <div className="card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={15} className="text-amber-400" />
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">Export Destination</h2>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-bg-base text-slate-400 border border-bg-border">
                        {typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? 'Local Disk Path' : 'Downloads Folder (~/Downloads)'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1 text-xs font-mono"
                        placeholder={downloadFileName}
                        value={outputPath || downloadFileName}
                        onChange={(e) => setOutputPath(e.target.value)}
                      />
                      {typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window && (
                        <button type="button" onClick={handleSelectOutputPath} className="btn-secondary text-xs">
                          Select Path
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
                        ? 'Choose the file destination path on your system.'
                        : "Rendered videos are automatically saved directly into your computer's Downloads folder."}
                    </p>
                  </div>

                </div>

                {/* Right (1 col): Timeline Summary & Export CTA */}
                <div className="space-y-6">

                  {/* Project Overview Card */}
                  <div className="card space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Summary</h3>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Audio Timeline:</span>
                        <span className="text-white font-mono">{formatDuration(totalDurationMs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Audio Chunks:</span>
                        <span className="text-white font-mono">{completedChunks} completed</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Motion Video Clips:</span>
                        <span className="text-cyan-400 font-mono">{readyClips}/{totalScenes} ready</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Est. Export Size:</span>
                        <span className="text-white font-mono">~{estFileSizeMB} MB</span>
                      </div>
                    </div>
                  </div>

                  {/* Export Final Video (.mp4) CTA Button */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleStartExport}
                      className="w-full py-4 rounded-xl font-bold text-sm text-white
                                 bg-gradient-to-r from-accent-purple via-accent-purple-light to-accent-cyan
                                 hover:shadow-xl hover:shadow-purple-900/50 transition-all duration-200
                                 flex items-center justify-center gap-2 glow-purple active:scale-95"
                    >
                      <Sparkles size={18} />
                      Export Final Video (.mp4)
                    </button>
                    <p className="text-[10px] text-center text-slate-500">
                      Renders full composite video with voiceover, BGM & motion
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-bg-border" />
                    <span className="flex-shrink mx-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Or Open in Video Editor
                    </span>
                    <div className="flex-grow border-t border-bg-border" />
                  </div>

                  {/* Universal Timeline Package Card */}
                  <div className="card p-4 space-y-3 bg-gradient-to-br from-bg-surface to-cyan-950/20 border-accent-cyan/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-accent-cyan/20 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan">
                          <Layers size={15} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white leading-tight">Universal Timeline Package</h3>
                          <p className="text-[10px] text-accent-cyan/80">CapCut · Premiere · DaVinci · FCP</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
                        ZIP Bundle
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Exports multi-track project with <strong>FCP 7 XML</strong>, <strong>CapCut SRT captions</strong>, <strong>CMX 3600 EDL</strong>, master audio WAV, and numbered scene artwork.
                    </p>

                    {/* Editor Compatibility Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-base/80 border border-bg-border text-slate-300">
                        🎬 CapCut
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-base/80 border border-bg-border text-slate-300">
                        ⚡ Premiere Pro
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-base/80 border border-bg-border text-slate-300">
                        🎨 DaVinci Resolve
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-base/80 border border-bg-border text-slate-300">
                        🍎 Final Cut Pro
                      </span>
                    </div>

                    {/* Progress Bar when packaging timeline */}
                    {isExportingTimeline && timelineProgress && (
                      <div className="space-y-1.5 pt-2 border-t border-accent-cyan/20">
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span className="truncate pr-2">{timelineProgress.message}</span>
                          <span className="font-mono text-accent-cyan">{timelineProgress.percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-bg-base rounded-full overflow-hidden border border-bg-border">
                          <div
                            className="h-full bg-gradient-to-r from-accent-cyan to-emerald-400 transition-all duration-300 rounded-full"
                            style={{ width: `${timelineProgress.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Success Notice */}
                    {timelineExportSuccess && !isExportingTimeline && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 text-xs text-emerald-300">
                        <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                        <span>Timeline ZIP downloaded to your computer!</span>
                      </div>
                    )}

                    {/* Timeline Export Button */}
                    <button
                      type="button"
                      disabled={isExportingTimeline}
                      onClick={handleExportTimeline}
                      className="w-full py-3 rounded-xl font-bold text-xs text-white
                                 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-cyan-950/30"
                    >
                      {isExportingTimeline ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Generating Timeline Package...</span>
                        </>
                      ) : (
                        <>
                          <FileArchive size={14} />
                          <span>Export Timeline Package (.zip)</span>
                        </>
                      )}
                    </button>

                    {/* Expandable Import Guide */}
                    <div className="pt-1 border-t border-bg-border">
                      <button
                        type="button"
                        onClick={() => setShowImportGuide(!showImportGuide)}
                        className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-white py-1 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <HelpCircle size={12} className="text-accent-cyan" />
                          How to import in CapCut & Premiere?
                        </span>
                        {showImportGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {showImportGuide && (
                        <div className="mt-2 p-3 rounded-lg bg-bg-base/90 border border-bg-border text-[11px] space-y-2.5 text-slate-300 animate-slide-up">
                          <div>
                            <strong className="text-white block mb-0.5">🎬 In CapCut (Desktop/Mobile):</strong>
                            <p className="text-slate-400 text-[10px] leading-relaxed">
                              1. Drag all images from <code className="text-accent-cyan">media/images/</code> and <code className="text-accent-cyan">master_voice.wav</code> to the timeline.<br />
                              2. Go to <strong>Text &gt; Local Captions &gt; Import</strong> and select <code className="text-emerald-400">subtitles.srt</code>. CapCut will automatically create and sync all animated subtitle cards!
                            </p>
                          </div>
                          <div className="pt-1.5 border-t border-bg-border/60">
                            <strong className="text-white block mb-0.5">⚡ In Adobe Premiere Pro:</strong>
                            <p className="text-slate-400 text-[10px] leading-relaxed">
                              Go to <strong>File &gt; Import</strong> and choose <code className="text-accent-purple-light">timeline.xml</code>. Premiere will automatically generate a sequence with all cuts and audio synced to the exact frame.
                            </p>
                          </div>
                          <div className="pt-1.5 border-t border-bg-border/60">
                            <strong className="text-white block mb-0.5">🎨 In DaVinci Resolve:</strong>
                            <p className="text-slate-400 text-[10px] leading-relaxed">
                              Go to <strong>File &gt; Import Timeline &gt; Import AAF, EDL, XML...</strong> and select <code className="text-accent-purple-light">timeline.xml</code>.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
