'use client';

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  StopCircle,
  Download,
  ExternalLink,
  RotateCcw,
  HardDrive,
  Trash2,
  Layers,
  FileArchive,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Film,
  Play,
  Check,
} from 'lucide-react';
import type {
  ProjectManifest,
  ExportProgress,
  ExportResolution,
} from '@/types';
import type { TimelineExportProgress } from '@/lib/timeline-exporter';

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

interface CinemaPreviewPanelProps {
  project: ProjectManifest;
  aspectRatio: '16:9' | '9:16' | '1:1';
  resolution: ExportResolution;
  isExporting: boolean;
  progress: ExportProgress;
  finalVideoUrl: string;
  downloadFileName: string;
  errorMsg: string;
  cleanedCache: boolean;
  freedSpaceMB: number;
  isExportingTimeline: boolean;
  timelineProgress: TimelineExportProgress | null;
  timelineExportSuccess: boolean;
  onStartExport: () => void;
  onCancelExport: () => void;
  onExportTimeline: () => void;
  onCleanCache: () => void;
  onReExport: () => void;
  onOpenFolder: () => void;
}

export function CinemaPreviewPanel({
  project,
  aspectRatio,
  resolution,
  isExporting,
  progress,
  finalVideoUrl,
  downloadFileName,
  errorMsg,
  cleanedCache,
  freedSpaceMB,
  isExportingTimeline,
  timelineProgress,
  timelineExportSuccess,
  onStartExport,
  onCancelExport,
  onExportTimeline,
  onCleanCache,
  onReExport,
  onOpenFolder,
}: CinemaPreviewPanelProps) {
  const [showImportGuide, setShowImportGuide] = useState(false);

  const totalDurationMs = project?.totalDurationMs ?? 0;
  const completedChunks = project?.audioChunks?.filter((c) => c.status === 'COMPLETED').length ?? 0;
  const readyClips = project?.scenes?.filter((s) => s.status === 'MOTION_READY').length ?? 0;
  const totalScenes = project?.scenes?.length ?? 0;
  const estFileSizeMB =
    resolution === '4k' ? Math.round((totalDurationMs / 1000) * 4) : Math.round((totalDurationMs / 1000) * 1.2);

  const heroImage =
    project?.youtubePackaging?.selectedThumbnailUrl ||
    project?.scenes?.[0]?.imageUrl ||
    '';

  return (
    <div className="space-y-6">
      {/* ─── 1. Cinema Monitor ────────────────────────────────────────────── */}
      <div className="card p-4 bg-zinc-900 border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film size={14} className="text-zinc-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {finalVideoUrl ? 'Rendered Master Video' : 'Cinema Stage Preview'}
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
            {aspectRatio} · {resolution.toUpperCase()}
          </span>
        </div>

        {/* Video / Image Screen */}
        <div
          className={`relative rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-2xl flex items-center justify-center ${
            aspectRatio === '9:16'
              ? 'aspect-[9/16] max-h-[460px] mx-auto'
              : aspectRatio === '1:1'
              ? 'aspect-square max-h-[380px] mx-auto'
              : 'aspect-video w-full'
          }`}
        >
          {finalVideoUrl ? (
            <video
              key={finalVideoUrl}
              src={finalVideoUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          ) : heroImage ? (
            <div className="relative w-full h-full group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt="Scene Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <p className="text-xs font-semibold text-white truncate">
                  {project?.title}
                </p>
                <p className="text-[10px] text-zinc-300">
                  {totalScenes} scenes · {formatDuration(totalDurationMs)}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 space-y-2">
              <Film size={32} className="mx-auto text-zinc-600" />
              <p className="text-xs">No media preview available</p>
            </div>
          )}
        </div>

        {/* Post-Render Quick Video Actions */}
        {finalVideoUrl && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex gap-2">
              <a
                href={finalVideoUrl}
                download={downloadFileName}
                className="btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Download size={14} />
                <span>Download MP4</span>
              </a>
              <button
                type="button"
                onClick={onOpenFolder}
                className="btn-secondary py-2 px-3 text-xs"
                title="Open Video in New Tab"
              >
                <ExternalLink size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={onReExport}
              className="btn-ghost w-full py-1.5 text-xs text-zinc-400 hover:text-white flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={12} />
              <span>Re-render Video</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── 2. Render Progress Card (Active or Failed) ───────────────────── */}
      {(isExporting || progress.stage === 'failed') && (
        <div className="card p-5 bg-zinc-900 border-zinc-700 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {progress.stage === 'failed' ? (
                <AlertTriangle size={20} className="text-red-400" />
              ) : (
                <Loader2 size={20} className="animate-spin text-white" />
              )}
              <div>
                <h4 className="text-xs font-bold text-white">
                  {progress.stage === 'failed' ? 'Export Failed' : 'Rendering MP4 Video...'}
                </h4>
                <p className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                  {progress.currentStepMessage}
                </p>
              </div>
            </div>

            {isExporting && (
              <button
                type="button"
                onClick={onCancelExport}
                className="btn-danger text-[11px] px-2.5 py-1"
              >
                <StopCircle size={13} />
                Cancel
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span className="font-mono text-white font-semibold">{progress.percentage}%</span>
              {progress.fps > 0 && <span>{progress.fps} FPS</span>}
              {progress.etaSeconds > 0 && (
                <span className="font-mono text-zinc-300">ETA {formatEta(progress.etaSeconds)}</span>
              )}
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/40 text-[11px] text-red-300">
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* ─── 3. Project Specs & Summary ───────────────────────────────────── */}
      <div className="card space-y-3">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Master Specifications
        </h4>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-400">Total Duration:</span>
            <span className="text-white font-mono">{formatDuration(totalDurationMs)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Audio Chunks:</span>
            <span className="text-white font-mono">{completedChunks} completed</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Motion Clips:</span>
            <span className="text-zinc-300 font-mono">{readyClips}/{totalScenes} ready</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Resolution & Ratio:</span>
            <span className="text-white font-mono">{resolution.toUpperCase()} · {aspectRatio}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Est. Video File Size:</span>
            <span className="text-white font-mono">~{estFileSizeMB} MB</span>
          </div>
        </div>
      </div>

      {/* ─── 4. Master Action Button (Render MP4) ─────────────────────────── */}
      {!isExporting && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onStartExport}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-zinc-950
                       bg-white hover:bg-zinc-200 transition-all
                       flex items-center justify-center gap-2 shadow-lg active:scale-[0.99]"
          >
            <Sparkles size={18} className="text-zinc-950" />
            <span>Render Final Video (.mp4)</span>
          </button>
          <p className="text-[10px] text-center text-zinc-500">
            Hardware-accelerated single-pass render with Ken Burns & audio ducking
          </p>
        </div>
      )}

      {/* ─── 5. Universal Timeline Package (CapCut / Premiere) ────────────── */}
      <div className="card p-4 space-y-3 bg-zinc-900/90 border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
              <Layers size={14} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">
                Universal Timeline Package
              </h4>
              <p className="text-[10px] text-zinc-400">CapCut · Premiere · DaVinci · FCP</p>
            </div>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
            ZIP Bundle
          </span>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Multi-track package with <strong>FCP 7 XML</strong>, <strong>CapCut SRT subtitles</strong>, CMX 3600 EDL, master WAV, and numbered scenes.
        </p>

        {isExportingTimeline && timelineProgress && (
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex justify-between text-[11px] text-zinc-300">
              <span className="truncate pr-2">{timelineProgress.message}</span>
              <span className="font-mono text-zinc-300">{timelineProgress.percentage}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${timelineProgress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {timelineExportSuccess && !isExportingTimeline && (
          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
            <span>Timeline ZIP downloaded to your computer!</span>
          </div>
        )}

        <button
          type="button"
          disabled={isExportingTimeline}
          onClick={onExportTimeline}
          className="w-full py-2.5 rounded-lg font-medium text-xs text-zinc-200
                     bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 hover:text-white
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
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

        {/* Collapsible Import Guide */}
        <div className="pt-1 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => setShowImportGuide(!showImportGuide)}
            className="w-full flex items-center justify-between text-[11px] text-zinc-400 hover:text-white py-1 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle size={12} className="text-zinc-400" />
              How to import in CapCut & Premiere?
            </span>
            {showImportGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showImportGuide && (
            <div className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] space-y-2 text-zinc-300 animate-slide-up">
              <div>
                <strong className="text-white block mb-0.5">🎬 In CapCut (Desktop/Mobile):</strong>
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  1. Drag all images and <code className="text-zinc-200">master_voice.wav</code> to timeline.<br />
                  2. Go to <strong>Text &gt; Local Captions &gt; Import</strong> and select <code className="text-emerald-400">subtitles.srt</code>.
                </p>
              </div>
              <div className="pt-1.5 border-t border-zinc-800">
                <strong className="text-white block mb-0.5">⚡ In Adobe Premiere Pro:</strong>
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  Import <code className="text-zinc-200">timeline.xml</code> via <strong>File &gt; Import</strong>.
                </p>
              </div>
              <div className="pt-1.5 border-t border-zinc-800">
                <strong className="text-white block mb-0.5">🎨 In DaVinci Resolve:</strong>
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  Import via <strong>File &gt; Import Timeline &gt; Import AAF, EDL, XML...</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 6. Cache Cleaner ────────────────────────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <HardDrive size={18} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-white">Clean Project Cache?</p>
            <p className="text-[10px] text-zinc-400">
              Frees intermediate scene images and cache.
            </p>
          </div>
        </div>
        {cleanedCache ? (
          <span className="text-[11px] text-emerald-400 font-medium px-2.5 py-1 bg-emerald-950/40 rounded-lg border border-emerald-800/40 flex items-center gap-1">
            <Check size={12} />
            Freed {freedSpaceMB > 0 ? `${(freedSpaceMB / 1024).toFixed(1)} GB` : 'Space'}
          </span>
        ) : (
          <button
            type="button"
            onClick={onCleanCache}
            className="btn-secondary text-[11px] py-1.5 px-2.5"
          >
            <Trash2 size={12} className="text-amber-400" />
            <span>Clean</span>
          </button>
        )}
      </div>
    </div>
  );
}
