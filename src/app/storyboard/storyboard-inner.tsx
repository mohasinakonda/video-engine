'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Wand2,
  PlayCircle,
  StopCircle,
  Loader2,
  Palette,
  AlertTriangle,
  CheckCircle2,
  Film,
  Clapperboard,
  ChevronLeft,
  Layers,
  Zap,
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import StoryboardGrid from '@/components/storyboard-grid';
import StylePresetModal from '@/components/style-preset-modal';
import {
  getProject,
  saveProject,
  getDefaultStylePreset,
  getStylePresets,
  getApiKey,
} from '@/lib/store';
import { extractScenes } from '@/lib/gemini';
import { ImageQueue } from '@/lib/image-queue';
import { MotionQueue } from '@/lib/ffmpeg';
import type {
  ProjectManifest,
  SceneItem,
  BaseStylePreset,
} from '@/types';

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id') ?? '';

  // ─── State ─────────────────────────────────────────────────────────────────

  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [stylePreset, setStylePreset] = useState<BaseStylePreset | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_stylePresets, setStylePresets] = useState<BaseStylePreset[]>([]);
  const [showStyleModal, setShowStyleModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Pipeline stages
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [extractError, setExtractError] = useState('');

  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingMotion, setGeneratingMotion] = useState(false);
  const [pauseMsg, setPauseMsg] = useState('');

  const imageQueueRef = useRef<ImageQueue | null>(null);
  const motionQueueRef = useRef<MotionQueue | null>(null);

  // Keep a ref to current project/preset for use inside callbacks
  const projectRef = useRef<ProjectManifest | null>(null);
  const presetRef = useRef<BaseStylePreset | null>(null);

  // ─── Load project ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!projectId) { router.push('/'); return; }
    setLoading(true);
    try {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      projectRef.current = p;
      setProject(p);

      // Restore scenes (strip blob URLs which aren't persisted)
      if (p.scenes && p.scenes.length > 0) {
        setScenes(p.scenes.map((s) => ({ ...s, imageUrl: undefined })));
      }

      const apiKey = await getApiKey();
      setApiKeyMissing(!apiKey);

      const all = await getStylePresets();
      setStylePresets(all);

      // Restore or default style preset
      let preset: BaseStylePreset;
      if (p.baseStylePresetId) {
        preset = all.find((sp) => sp.id === p.baseStylePresetId) ?? await getDefaultStylePreset();
      } else {
        preset = await getDefaultStylePreset();
      }
      presetRef.current = preset;
      setStylePreset(preset);
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => { load(); }, [load]);

  // ─── Persist scenes ─────────────────────────────────────────────────────

  const persistScenes = useCallback(async (updatedScenes: SceneItem[]) => {
    const proj = projectRef.current;
    const preset = presetRef.current;
    if (!proj) return;
    const stripped = updatedScenes.map(({ imageUrl: _imageUrl, ...s }) => s);
    const updated: ProjectManifest = {
      ...proj,
      scenes: stripped,
      baseStylePresetId: preset?.id,
      updatedAt: Date.now(),
    };
    projectRef.current = updated;
    setProject(updated);
    await saveProject(updated);
  }, []);

  // ─── Step 1: Extract Scenes ──────────────────────────────────────────────

  async function handleExtractScenes() {
    const proj = projectRef.current;
    const preset = presetRef.current;
    if (!proj || !preset) return;

    const apiKey = await getApiKey();
    if (!apiKey) { setApiKeyMissing(true); return; }

    const totalDurationMs = proj.totalDurationMs;
    if (!totalDurationMs) {
      setExtractError('No audio timeline found. Please generate audio in Phase 1 first.');
      return;
    }

    setExtracting(true);
    setExtractError('');

    try {
      const extracted = await extractScenes(
        apiKey,
        proj.rawScript,
        totalDurationMs,
        preset.stylePrompt,
        (msg) => setExtractMsg(msg)
      );
      setScenes(extracted);
      await persistScenes(extracted);
      setExtractMsg(`${extracted.length} scenes ready. Start image generation below.`);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Scene extraction failed.');
    } finally {
      setExtracting(false);
    }
  }

  // ─── Step 2: Generate Images ─────────────────────────────────────────────

  async function handleGenerateImages(currentScenes: SceneItem[]) {
    const apiKey = await getApiKey();
    if (!apiKey) { setApiKeyMissing(true); return; }

    setGeneratingImages(true);
    setPauseMsg('');
    imageQueueRef.current = new ImageQueue();

    const preset = presetRef.current;

    await imageQueueRef.current.run({
      apiKey,
      projectId,
      scenes: currentScenes.filter((s) => s.status === 'PENDING' || s.status === 'FAILED'),
      negativePrompt: preset?.negativePrompt,
      concurrency: 3,
      callbacks: {
        onSceneUpdate: (sceneId, update) => {
          setScenes((prev) => {
            const next = prev.map((s) =>
              s.sceneId === sceneId ? { ...s, ...update } : s
            );
            persistScenes(next);
            return next;
          });
        },
        onComplete: () => {
          setGeneratingImages(false);
          setPauseMsg('');
        },
        onError: (sceneId, error) => {
          console.warn(`Scene ${sceneId} failed:`, error);
        },
        onPause: (reason, resumeInMs) => {
          setPauseMsg(`${reason} — resuming in ${resumeInMs / 1000}s`);
        },
      },
    });
  }

  // ─── Step 3: Generate Motion Clips ───────────────────────────────────────

  async function handleGenerateMotion(currentScenes: SceneItem[]) {
    const readyScenes = currentScenes.filter((s) => s.status === 'IMAGE_READY');
    if (readyScenes.length === 0) return;

    setGeneratingMotion(true);
    motionQueueRef.current = new MotionQueue();

    await motionQueueRef.current.run({
      projectId,
      scenes: readyScenes,
      callbacks: {
        onSceneUpdate: (sceneId, update) => {
          setScenes((prev) => {
            const next = prev.map((s) =>
              s.sceneId === sceneId ? { ...s, ...update } : s
            );
            persistScenes(next);
            return next;
          });
        },
        onComplete: () => setGeneratingMotion(false),
        onError: (sceneId, error) => console.warn(`Motion scene ${sceneId} failed:`, error),
      },
    });
  }

  // ─── Stop ─────────────────────────────────────────────────────────────────

  function handleStop() {
    imageQueueRef.current?.cancel();
    motionQueueRef.current?.cancel();
    setGeneratingImages(false);
    setGeneratingMotion(false);
    setPauseMsg('');
    setScenes((prev) =>
      prev.map((s) => {
        if (s.status === 'GENERATING_IMAGE') return { ...s, status: 'PENDING' as const };
        if (s.status === 'GENERATING_MOTION') return { ...s, status: 'IMAGE_READY' as const };
        return s;
      })
    );
  }

  // ─── Per-scene actions ────────────────────────────────────────────────────

  async function handleRegenerate(scene: SceneItem, newPrompt?: string) {
    const apiKey = await getApiKey();
    if (!apiKey) return;

    const preset = presetRef.current;
    let targetScene = scene;
    if (newPrompt && newPrompt !== scene.visualPrompt) {
      targetScene = {
        ...scene,
        visualPrompt: newPrompt,
        fullPrompt: `${newPrompt}. ${preset?.stylePrompt ?? ''}`,
        status: 'PENDING',
      };
      setScenes((prev) => prev.map((s) => s.sceneId === scene.sceneId ? targetScene : s));
    } else {
      setScenes((prev) => prev.map((s) => s.sceneId === scene.sceneId ? { ...s, status: 'PENDING' as const } : s));
    }

    if (!imageQueueRef.current) imageQueueRef.current = new ImageQueue();

    await imageQueueRef.current.retryScene(targetScene, {
      apiKey,
      projectId,
      negativePrompt: preset?.negativePrompt,
      callbacks: {
        onSceneUpdate: (sceneId, update) => {
          setScenes((prev) => {
            const next = prev.map((s) => s.sceneId === sceneId ? { ...s, ...update } : s);
            persistScenes(next);
            return next;
          });
        },
        onComplete: () => {},
        onError: () => {},
        onPause: () => {},
      },
    });
  }

  async function handleUpload(scene: SceneItem, file: File) {
    const imageUrl = URL.createObjectURL(file);
    setScenes((prev) => {
      const next = prev.map((s) =>
        s.sceneId === scene.sceneId
          ? { ...s, imageUrl, status: 'IMAGE_READY' as const }
          : s
      );
      persistScenes(next);
      return next;
    });
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const hasAudio = (project?.totalDurationMs ?? 0) > 0;
  const pendingImages = scenes.filter((s) => s.status === 'PENDING' || s.status === 'FAILED').length;
  const readyForMotion = scenes.filter((s) => s.status === 'IMAGE_READY').length;
  const allImagesReady = scenes.length > 0 && pendingImages === 0 && !scenes.some((s) => s.status === 'GENERATING_IMAGE');
  const isWorking = generatingImages || generatingMotion || extracting;

  const totalDurationSec = (project?.totalDurationMs ?? 0) / 1000;
  const estimatedScenes = totalDurationSec > 0 ? Math.round(totalDurationSec / 3.5) : 0;

  // ─── Render ──────────────────────────────────────────────────────────────

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

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="px-6 py-4 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => router.push(`/project/new?id=${projectId}`)}
            className="btn-ghost p-1.5"
            title="Back to Phase 1"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 border border-accent-purple/30 flex items-center justify-center">
              <Film size={13} className="text-accent-purple-light" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">{project?.title}</h1>
              <p className="text-[10px] text-slate-500">Phase 2 · Image Engine & Storyboard</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {apiKeyMissing && (
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-1.5 text-xs text-amber-400 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 hover:bg-amber-900/40 transition-colors"
              >
                <AlertTriangle size={12} />
                Set API Key
              </button>
            )}
          </div>
        </header>

        {/* ── Main layout ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Control Panel */}
          <div className="w-80 flex-shrink-0 border-r border-bg-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Audio summary */}
              <div className="card space-y-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Audio Timeline</p>
                {hasAudio ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Total Duration</span>
                      <span className="text-white font-mono">
                        {Math.floor(totalDurationSec / 60)}m {Math.round(totalDurationSec % 60)}s
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Audio Chunks</span>
                      <span className="text-white font-mono">{project?.audioChunks?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Est. Scenes (~3.5s each)</span>
                      <span className="text-white font-mono">~{estimatedScenes}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/30">
                    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-400">
                      No audio timeline. Generate audio in Phase 1 first.
                    </p>
                  </div>
                )}
              </div>

              {/* Base Style Preset */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={13} className="text-slate-500" />
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Base Style
                  </label>
                </div>

                {stylePreset ? (
                  <div
                    className="card-elevated cursor-pointer hover:border-accent-purple/40 transition-all duration-150 group"
                    onClick={() => setShowStyleModal(true)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{stylePreset.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{stylePreset.aspectRatio}</p>
                      </div>
                      <Palette size={12} className="text-slate-600 group-hover:text-accent-purple-light transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {stylePreset.stylePrompt}
                    </p>
                    <p className="text-[10px] text-accent-purple-light/70 hover:text-accent-purple-light mt-2 transition-colors">
                      Change style →
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowStyleModal(true)}
                    className="btn-secondary w-full justify-center text-xs"
                  >
                    <Palette size={13} />
                    Choose Style Preset
                  </button>
                )}
              </div>

              {/* Scene count info */}
              {scenes.length > 0 && (
                <div className="card space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scenes</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Scenes</span>
                    <span className="text-white font-mono">{scenes.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Images Ready</span>
                    <span className="text-emerald-400 font-mono">
                      {scenes.filter((s) => ['IMAGE_READY', 'GENERATING_MOTION', 'MOTION_READY'].includes(s.status)).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Motion Clips</span>
                    <span className="text-cyan-400 font-mono">
                      {scenes.filter((s) => s.status === 'MOTION_READY').length}
                    </span>
                  </div>
                </div>
              )}

              {/* Rate limit pause msg */}
              {pauseMsg && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-950/30 border border-amber-800/30 animate-fade-in">
                  <Loader2 size={12} className="text-amber-400 animate-spin flex-shrink-0" />
                  <p className="text-xs text-amber-400">{pauseMsg}</p>
                </div>
              )}

              {/* Extract message */}
              {(extracting || extractMsg) && !extractError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-800/30 animate-fade-in">
                  {extracting
                    ? <Loader2 size={12} className="text-blue-400 animate-spin flex-shrink-0" />
                    : <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
                  <p className="text-xs text-blue-400">{extractMsg}</p>
                </div>
              )}

              {/* Extract error */}
              {extractError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800/30 animate-fade-in">
                  <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{extractError}</p>
                </div>
              )}
            </div>

            {/* ── Action Buttons ─────────────────────────────────────────── */}
            <div className="p-5 border-t border-bg-border space-y-3 flex-shrink-0">

              {/* Step 1: Extract Scenes */}
              {scenes.length === 0 && (
                <button
                  id="extract-scenes-btn"
                  onClick={handleExtractScenes}
                  disabled={extracting || !hasAudio || apiKeyMissing}
                  className="btn-primary w-full justify-center"
                >
                  {extracting
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Wand2 size={15} />}
                  {extracting ? 'Extracting Scenes…' : 'Extract Scenes from Script'}
                </button>
              )}

              {/* Re-extract option */}
              {scenes.length > 0 && !isWorking && (
                <button
                  onClick={() => { setScenes([]); setExtractMsg(''); }}
                  className="btn-secondary w-full justify-center text-xs"
                >
                  <Layers size={13} />
                  Re-Extract Scenes
                </button>
              )}

              {/* Step 2: Generate Images */}
              {scenes.length > 0 && pendingImages > 0 && !generatingImages && !generatingMotion && (
                <button
                  id="generate-images-btn"
                  onClick={() => handleGenerateImages(scenes)}
                  disabled={apiKeyMissing}
                  className="btn-primary w-full justify-center"
                >
                  <PlayCircle size={15} />
                  {pendingImages < scenes.length
                    ? `Resume Images (${pendingImages} left)`
                    : `Generate ${scenes.length} Images`}
                </button>
              )}

              {/* Stop button */}
              {isWorking && (
                <button
                  id="stop-btn"
                  onClick={handleStop}
                  className="btn-danger w-full justify-center"
                >
                  <StopCircle size={15} />
                  Stop
                </button>
              )}

              {/* Step 3: Generate Motion */}
              {readyForMotion > 0 && !generatingMotion && !generatingImages && (
                <button
                  id="generate-motion-btn"
                  onClick={() => handleGenerateMotion(scenes)}
                  className="btn-primary w-full justify-center"
                  style={{ background: 'linear-gradient(135deg, #0e7490, #06b6d4)' }}
                >
                  <Clapperboard size={15} />
                  {`Animate ${readyForMotion} Clips (Ken Burns)`}
                </button>
              )}

              {/* All complete or ready for export */}
              {scenes.length > 0 && (readyForMotion > 0 || scenes.some((s) => s.status === 'MOTION_READY' || s.status === 'IMAGE_READY')) && !isWorking && (
                <button
                  id="proceed-export-btn"
                  onClick={() => router.push(`/export?id=${projectId}`)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white
                             bg-gradient-to-r from-amber-600 via-accent-purple to-accent-cyan
                             hover:shadow-lg hover:shadow-cyan-900/40 transition-all duration-200
                             flex items-center justify-center gap-2 glow-purple"
                >
                  <Zap size={15} />
                  Proceed to Final Export →
                </button>
              )}

              {allImagesReady && pendingImages === 0 && readyForMotion === 0 && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                  <Zap size={14} className="text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">All scenes complete!</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Storyboard Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <StoryboardGrid
              scenes={scenes}
              onRegenerate={handleRegenerate}
              onUpload={handleUpload}
              disabled={isWorking}
            />
          </div>
        </div>
      </main>

      {/* Style Preset Modal */}
      {showStyleModal && (
        <StylePresetModal
          onClose={() => setShowStyleModal(false)}
          onSelect={(preset) => {
            presetRef.current = preset;
            setStylePreset(preset);
            setShowStyleModal(false);
          }}
          selectedId={stylePreset?.id}
        />
      )}
    </div>
  );
}
