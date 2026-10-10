'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Flame,
  Monitor,
  Smartphone,
  Square,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { getProject, saveProject } from '@/lib/store';
import { ExportEngine } from '@/lib/export-engine';
import { getMediaBlobUrl } from '@/lib/media-storage';
import { exportUniversalTimelineZip, TimelineExportProgress } from '@/lib/timeline-exporter';
import { YouTubeLaunchKit } from '@/components/export/youtube-launch-kit';
import { CinemaPreviewPanel } from '@/components/export/cinema-preview-panel';
import type {
  ProjectManifest,
  ExportResolution,
  HardwareEncoder,
  ExportProgress,
  TransitionType,
  ExportSettings,
} from '@/types';

export default function ExportInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id') || searchParams.get('projectId') || '';

  // ─── Studio Tabs ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'render' | 'youtube'>('render');

  // ─── State ─────────────────────────────────────────────────────────────────
  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [loading, setLoading] = useState(true);

  // Configuration options
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [encoder, setEncoder] = useState<HardwareEncoder>('auto');
  const [transitionType, setTransitionType] = useState<TransitionType>('crossfade');
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
        setEncoder(project.exportSettings.encoder ?? 'auto');

        setOutputPath(project.exportSettings.outputPath ?? '');
        if (project.exportSettings.transitionType) setTransitionType(project.exportSettings.transitionType);
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
      encoder,
      aspectRatio,

      outputPath: outputPath || downloadFileName,
      transitionType,
      transitionDurationSec: transitionDuration,
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
        project.title
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

    try {
      const zipBlob = await exportUniversalTimelineZip(project, (p) => {
        setTimelineProgress(p);
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
      showToast('Timeline ZIP package generated and downloaded!');
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
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                Phase 3 · Launch Studio
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Production Render & YouTube Viral Packaging
            </p>
          </div>
        </div>

        {/* Studio Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('render')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'render'
              ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Sliders size={14} className={activeTab === 'render' ? 'text-blue-400' : 'text-zinc-400'} />
            <span>Master Render</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('youtube')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'youtube'
              ? 'bg-red-500/20 text-red-300 shadow-sm border border-red-500/30'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Flame size={14} className="text-red-400" />
            <span>YouTube Launch Kit</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/30 text-red-300 uppercase font-mono">
              AI
            </span>
          </button>
        </div>
      </header>

      {/* ─── Main Two-Column Studio Layout ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {activeTab === 'render' ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column (7 cols): Active Tab Workspace */}
            <div className="lg:col-span-7 space-y-6">

              {/* TAB 1: Master Video Render & Audio Engine Settings */}
              <div className="space-y-6 animate-fade-in">

                {/* Aspect Ratio Format */}
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders size={15} className="text-blue-400" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                        Video Aspect Ratio
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
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
                      <p className="text-[10px] text-zinc-400 mt-0.5">YouTube / Desktop</p>
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
                      <p className="text-[10px] text-zinc-400 mt-0.5">Reels / Shorts / TikTok</p>
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
                      <p className="text-[10px] text-zinc-400 mt-0.5">Instagram Feed</p>
                    </button>
                  </div>
                </div>

                {/* Resolution Profile */}
                <div className="card space-y-3">
                  <div className="flex items-center gap-2">
                    <Film size={15} className="text-zinc-300" />
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                      Output Resolution
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setResolution('1080p')}
                      className={`p-3.5 rounded-xl border text-left transition-all ${resolution === '1080p'
                        ? 'bg-zinc-800 border-zinc-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                    >
                      <p className="text-sm font-bold text-white">1080p Full HD</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">1920×1080 · 30 FPS · 8–10 Mbps</p>
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                        Recommended
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResolution('4k')}
                      className={`p-3.5 rounded-xl border text-left transition-all ${resolution === '4k'
                        ? 'bg-zinc-800 border-zinc-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                    >
                      <p className="text-sm font-bold text-white">4K Ultra HD</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">3840×2160 · 30 FPS · 25–35 Mbps</p>
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                        Ultra Quality
                      </span>
                    </button>
                  </div>
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

                {/* Scene Transitions */}
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-zinc-400" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                        Scene Transitions & Blending
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-300 font-semibold bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
                      {transitionType === 'crossfade'
                        ? 'Cross-Dissolve'
                        : transitionType === 'fade_black'
                          ? 'Dip to Black'
                          : 'Direct Cut'}{' '}
                      · {transitionDuration}s
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTransitionType('crossfade')}
                      className={`p-3 rounded-xl border text-left transition-all ${transitionType === 'crossfade'
                        ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                    >
                      <p className="text-xs font-bold text-white">Cross-Dissolve</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Smooth blending between images</p>
                      <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-medium">
                        Recommended
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransitionType('fade_black')}
                      className={`p-3 rounded-xl border text-left transition-all ${transitionType === 'fade_black'
                        ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                    >
                      <p className="text-xs font-bold text-white">Dip to Black</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Gentle fade to black breath</p>
                      <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-medium">
                        Classic Film
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransitionType('cut')}
                      className={`p-3 rounded-xl border text-left transition-all ${transitionType === 'cut'
                        ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                    >
                      <p className="text-xs font-bold text-white">Hard Cut</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Instant switch between scenes</p>
                      <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                        Fast Montage
                      </span>
                    </button>
                  </div>

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



                {/* Destination */}
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={15} className="text-amber-400" />
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                        Export Destination
                      </h2>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
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
                  <p className="text-[11px] text-zinc-400">
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
                isExporting={isExporting}
                progress={progress}
                finalVideoUrl={finalVideoUrl}
                downloadFileName={downloadFileName}
                errorMsg={errorMsg}
                cleanedCache={cleanedCache}
                freedSpaceMB={freedSpaceMB}
                isExportingTimeline={isExportingTimeline}
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
        ) : (
          /* TAB 2: YouTube & Social Launch Studio (Full Width Dedicated Creator Suite) */
          <div className="max-w-7xl mx-auto animate-fade-in">
            <YouTubeLaunchKit
              project={project}
              onUpdateProject={setProject}
              showToast={showToast}
            />
          </div>
        )}
      </div>

    </div>
  );
}
