'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Film,
  Clapperboard,
  ChevronLeft,
  Layers,
  Zap,
  Download,
  Plus,
  Images,
  Info,
} from 'lucide-react';
import StoryboardGrid from '@/components/storyboard-grid';
import InfoDrawer from './components/info-drawer';
import NextStepButton from './components/next-step-button';
import {
  getProject,
  saveProject,
  getDefaultStylePreset,
  getStylePresets,
  getImageModel,
} from '@/lib/store';
import { extractScenes } from '@/lib/gemini';
import JSZip from 'jszip';
import { ImageQueue } from '@/lib/image-queue';
import { MotionQueue } from '@/lib/ffmpeg';
import { getMediaBlobUrl, getMediaBlob } from '@/lib/media-storage';
import { hasEnoughCredits, deductUserCredits, grantUserCredits, getUserCreditsRemaining } from '@/lib/subscription-store';
import type {
  ProjectManifest,
  SceneItem,
  SceneStatus,
  AudioChunk,
  BaseStylePreset,
} from '@/types';
import type { AIImageModel } from '@/types/subscription';

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
  const [selectedAIModel, setSelectedAIModel] = useState<AIImageModel | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState('');

  const headerBtn =
    'flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg bg-bg-elevated border border-bg-border hover:border-bg-border-strong text-xs text-zinc-300 hover:text-white transition-colors disabled:opacity-50';

  // Pipeline stages
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [extractError, setExtractError] = useState('');

  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingMotion, setGeneratingMotion] = useState(false);
  const [pauseMsg, setPauseMsg] = useState('');
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [requiredCreditsNeeded, setRequiredCreditsNeeded] = useState(0);

  // Voiceover audio preview & upload state
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayVoice = useCallback(() => {
    if (!audioPlayerRef.current || !voiceAudioUrl) return;
    if (isPlayingVoice) {
      audioPlayerRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      audioPlayerRef.current.play().catch(console.warn);
      setIsPlayingVoice(true);
    }
  }, [isPlayingVoice, voiceAudioUrl]);

  const imageQueueRef = useRef<ImageQueue | null>(null);
  const motionQueueRef = useRef<MotionQueue | null>(null);
  const autoStartedRef = useRef(false);

  // Keep a ref to current project/preset for use inside callbacks
  const projectRef = useRef<ProjectManifest | null>(null);
  const presetRef = useRef<BaseStylePreset | null>(null);

  // In-flight guard to prevent duplicate or rapid clicks on scenes
  const generatingSceneIdsRef = useRef<Set<number>>(new Set());

  // ─── Step 2: Generate Images ─────────────────────────────────────────────

  const handleGenerateImages = useCallback(async (currentScenes: SceneItem[]) => {
    const pendingScenes = currentScenes.filter((s) => s.status === 'PENDING' || s.status === 'FAILED');
    if (pendingScenes.length === 0) return;

    const unitCost = selectedAIModel?.creditCost ?? 2;
    const availableCredits = getUserCreditsRemaining();

    if (availableCredits < unitCost) {
      setRequiredCreditsNeeded(pendingScenes.length * unitCost);
      setCreditModalOpen(true);
      return;
    }

    // Process up to available credits
    const maxScenesAffordable = Math.floor(availableCredits / unitCost);
    const scenesToProcess = pendingScenes.slice(0, maxScenesAffordable);
    const count = scenesToProcess.length;
    const totalCreditsNeeded = count * unitCost;

    const deducted = deductUserCredits(totalCreditsNeeded, `Batch generate ${count} scenes (${selectedAIModel?.name || 'DeepInfra'})`);
    if (!deducted) {
      setRequiredCreditsNeeded(totalCreditsNeeded);
      setCreditModalOpen(true);
      return;
    }

    const chosenModel = selectedAIModel?.modelId || (await getImageModel());

    setGeneratingImages(true);
    setPauseMsg('');
    imageQueueRef.current = new ImageQueue();

    const preset = presetRef.current;

    await imageQueueRef.current.run({
      projectId,
      scenes: scenesToProcess,
      stylePrompt: preset?.stylePrompt,
      negativePrompt: preset?.negativePrompt,
      aspectRatio: projectRef.current?.aspectRatio || preset?.aspectRatio || '16:9',
      model: chosenModel,
      creditCost: selectedAIModel?.creditCost,
      inferenceSteps: selectedAIModel?.inferenceSteps,
      guidanceScale: selectedAIModel?.guidanceScale,
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
          setScenes((latest) => {
            persistScenes(latest);
            return latest;
          });
          // If there are still pending scenes remaining after exhausting credits, prompt with remaining count
          if (pendingScenes.length > count) {
            setRequiredCreditsNeeded((pendingScenes.length - count) * unitCost);
            setCreditModalOpen(true);
          }
        },
        onError: (sceneId, error) => {
          console.warn(`Scene ${sceneId} failed:`, error);
          grantUserCredits(unitCost, `Refund: Scene ${sceneId} batch generation failed`);
        },
        onPause: (reason, resumeInMs) => {
          setPauseMsg(`${reason} — resuming in ${resumeInMs / 1000}s`);
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ─── Load project ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!projectId) {
      console.warn('[Storyboard] Missing projectId in URL searchParams.');
      router.push('/');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      let p = await getProject(projectId);
      if (!p) {
        // Wait 350ms and retry once in case of storage write latency
        await new Promise((resolve) => setTimeout(resolve, 350));
        p = await getProject(projectId);
      }
      if (!p) {
        console.error(`[Storyboard] Project "${projectId}" could not be loaded from storage.`);
        setLoadError(`Project "${projectId}" could not be found.`);
        return;
      }
      projectRef.current = p;
      setProject(p);

      // Restore scenes and fetch image blobs from IndexedDB
      let restoredScenes: SceneItem[] = [];
      let hadUnmarkedReadyImages = false;

      if (p.scenes && p.scenes.length > 0) {
        restoredScenes = await Promise.all(
          p.scenes.map(async (s) => {
            // Never trust an ephemeral session blob: URL from a previous page load
            const isDeadBlob = typeof s.imageUrl === 'string' && s.imageUrl.startsWith('blob:');
            if (s.imageUrl && !isDeadBlob) return s;

            const url = await getMediaBlobUrl(`scene_${p.projectId}_${s.sceneId}`);
            if (url) {
              if (s.status === 'PENDING' || s.status === 'FAILED' || s.status === 'GENERATING_IMAGE') {
                hadUnmarkedReadyImages = true;
              }
              return {
                ...s,
                imageUrl: url,
                status: (s.status === 'PENDING' || s.status === 'FAILED' || s.status === 'GENERATING_IMAGE')
                  ? ('IMAGE_READY' as SceneStatus)
                  : s.status,
              };
            }

            // If image blob is not in IndexedDB, clear dead imageUrl and reset status to PENDING
            return {
              ...s,
              imageUrl: undefined,
              status: (s.status === 'IMAGE_READY' || s.status === 'MOTION_READY') ? ('PENDING' as SceneStatus) : s.status,
            };
          })
        );
        setScenes(restoredScenes);

        // If any scenes had their images saved in IndexedDB but were marked pending in manifest, update manifest now
        if (hadUnmarkedReadyImages) {
          const stripped = restoredScenes.map(({ imageUrl: _imageUrl, ...s }) => s);
          const updated: ProjectManifest = {
            ...p,
            scenes: stripped,
            updatedAt: Date.now(),
          };
          projectRef.current = updated;
          setProject(updated);
          await saveProject(updated);
        }
      }

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

      // Restore voice audio URL from IndexedDB or first chunk
      const audioUrl = await getMediaBlobUrl(`audio_${p.projectId}_0`);
      if (audioUrl) {
        setVoiceAudioUrl(audioUrl);
      } else if (p.audioChunks && p.audioChunks.length > 0 && p.audioChunks[0].audioUrl) {
        setVoiceAudioUrl(p.audioChunks[0].audioUrl);
      }
      if (p.totalDurationMs && p.totalDurationMs > 0) {
        setVoiceDuration(p.totalDurationMs / 1000);
      }

      // Auto-start image generation if requested via query param
      const isAutoGenerate = searchParams.get('autoGenerate') === 'true';
      if (isAutoGenerate) {
        // Strip autoGenerate from URL so refreshing, bookmarking or reopening will NEVER trigger generation again
        if (typeof window !== 'undefined') {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('autoGenerate');
          window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
        }

        if (!autoStartedRef.current) {
          const pending = restoredScenes.filter((s) => s.status === 'PENDING' || s.status === 'FAILED');
          if (pending.length > 0) {
            autoStartedRef.current = true;
            setTimeout(() => {
              handleGenerateImages(restoredScenes);
            }, 350);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, router, searchParams, handleGenerateImages]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let isMounted = true;
    async function loadActiveModel() {
      try {
        const storedModelId = await getImageModel();
        const targetModelId = projectRef.current?.imageModel || storedModelId;
        const res = await fetch('/api/models');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.models)) {
            const match =
              data.models.find((m: AIImageModel) => m.modelId === targetModelId || m.id === targetModelId) ||
              data.models.find((m: AIImageModel) => m.modelId === storedModelId || m.id === storedModelId) ||
              data.models.find((m: AIImageModel) => m.isDefault) ||
              data.models[0];
            if (isMounted && match) setSelectedAIModel(match);
          }
        }
      } catch (err) {
        console.error('Failed to load initial active model in storyboard:', err);
      }
    }
    loadActiveModel();

    const handleGlobalModelUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<AIImageModel>;
      if (customEvt.detail) {
        setSelectedAIModel(customEvt.detail);
      }
    };
    window.addEventListener('ai_model_updated', handleGlobalModelUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('ai_model_updated', handleGlobalModelUpdate);
    };
  }, []);

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


    // If project has no audio duration, calculate reasonable fallback based on script words
    const words = proj.rawScript?.trim().split(/\s+/).filter(Boolean).length || 0;
    const wordEstMs = Math.max(15000, Math.round((words / 135) * 60 * 1000));
    const totalDurationMs =
      proj.totalDurationMs && proj.totalDurationMs > 0
        ? proj.totalDurationMs
        : (scenes.length > 0 ? scenes[scenes.length - 1].audioEndSec * 1000 : wordEstMs);

    setExtracting(true);
    setExtractError('');

    try {
      const pacingProfile = proj.pacingProfile || 'balanced';
      const extracted = await extractScenes(
        proj.rawScript,
        totalDurationMs,
        preset.stylePrompt,
        (msg) => setExtractMsg(msg),
        pacingProfile
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

  // ─── Sync Scene Durations to Voice Audio ──────────────────────────────────

  async function handleSyncTimelineToAudio(forcedDurationSec?: number) {
    const proj = projectRef.current;
    if (!proj || scenes.length === 0) return;

    const words = proj.rawScript?.trim().split(/\s+/).filter(Boolean).length || 0;
    const wordEstSec = Math.max(15, Math.round((words / 135) * 60));
    const targetDurationSec =
      forcedDurationSec && forcedDurationSec > 0
        ? forcedDurationSec
        : (proj.totalDurationMs && proj.totalDurationMs > 0
          ? proj.totalDurationMs / 1000
          : wordEstSec);

    const currentDurations = scenes.map((s) => {
      const lineWords = (s.narrationLine || '').split(/\s+/).filter(Boolean).length;
      const naturalWeight = lineWords > 0 ? lineWords / 2.5 : 3.5;
      const existingDur = Math.max(1.0, s.audioEndSec - s.audioStartSec);
      return existingDur || naturalWeight;
    });
    const totalCurr = currentDurations.reduce((a, b) => a + b, 0);
    const scale = totalCurr > 0 ? targetDurationSec / totalCurr : 1;

    let cum = 0;
    const resynced = scenes.map((s, idx) => {
      const d = currentDurations[idx] * scale;
      const start = cum;
      const end = idx === scenes.length - 1 ? targetDurationSec : cum + d;
      cum = end;
      return {
        ...s,
        audioStartSec: parseFloat(start.toFixed(1)),
        audioEndSec: parseFloat(end.toFixed(1)),
      };
    });

    setScenes(resynced);
    await persistScenes(resynced);
    setExtractMsg(`Timeline synchronized: all ${scenes.length} scenes now span ${targetDurationSec.toFixed(1)}s.`);
  }

  // ─── Manual Adjust Scene Duration ─────────────────────────────────────────

  async function handleUpdateSceneDuration(sceneId: number, deltaSec: number) {
    if (scenes.length === 0) return;
    const targetIdx = scenes.findIndex((s) => s.sceneId === sceneId);
    if (targetIdx === -1) return;

    const currentDur = Math.max(1.0, scenes[targetIdx].audioEndSec - scenes[targetIdx].audioStartSec);
    const newDur = Math.max(1.0, Math.min(30.0, parseFloat((currentDur + deltaSec).toFixed(1))));
    if (Math.abs(newDur - currentDur) < 0.05) return;

    let cum = 0;
    const updated = scenes.map((s, idx) => {
      const sceneDur = idx === targetIdx ? newDur : Math.max(0.5, s.audioEndSec - s.audioStartSec);
      const start = cum;
      const end = parseFloat((cum + sceneDur).toFixed(1));
      cum = end;
      return {
        ...s,
        audioStartSec: parseFloat(start.toFixed(1)),
        audioEndSec: end,
      };
    });

    setScenes(updated);
    await persistScenes(updated);
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
    setScenes((prev) => {
      const cancelledCount = prev.filter((s) => s.status === 'GENERATING_IMAGE').length;
      if (cancelledCount > 0) {
        grantUserCredits(cancelledCount, `Refund: Batch generation stopped (${cancelledCount} scenes)`);
      }
      return prev.map((s) => {
        if (s.status === 'GENERATING_IMAGE') return { ...s, status: 'PENDING' as const };
        if (s.status === 'GENERATING_MOTION') return { ...s, status: 'IMAGE_READY' as const };
        return s;
      });
    });
  }

  // ─── Per-scene actions ────────────────────────────────────────────────────

  async function handleRegenerate(scene: SceneItem, newPrompt?: string) {
    if (generatingSceneIdsRef.current.has(scene.sceneId)) {
      console.warn(`[Storyboard] Scene ${scene.sceneId} is already generating.`);
      return;
    }

    const unitCost = selectedAIModel?.creditCost ?? 2;
    if (!hasEnoughCredits(unitCost)) {
      setRequiredCreditsNeeded(unitCost);
      setCreditModalOpen(true);
      return;
    }

    const deducted = deductUserCredits(unitCost, `Scene ${scene.sceneId} regenerate (${selectedAIModel?.name || 'DeepInfra'})`);
    if (!deducted) {
      setRequiredCreditsNeeded(unitCost);
      setCreditModalOpen(true);
      return;
    }

    generatingSceneIdsRef.current.add(scene.sceneId);

    const chosenModel = selectedAIModel?.modelId || (await getImageModel());

    const preset = presetRef.current;
    const effectiveVisual = newPrompt && newPrompt.trim() ? newPrompt.trim() : scene.visualPrompt;
    const targetScene: SceneItem = {
      ...scene,
      status: 'GENERATING_IMAGE' as const,
      visualPrompt: effectiveVisual,
      fullPrompt: preset?.stylePrompt ? `${effectiveVisual}. ${preset.stylePrompt}` : effectiveVisual,
    };
    setScenes((prev) => prev.map((s) => s.sceneId === scene.sceneId ? targetScene : s));
    persistScenes(scenes.map((s) => s.sceneId === scene.sceneId ? targetScene : s));

    if (!imageQueueRef.current) imageQueueRef.current = new ImageQueue();

    let completedSuccessfully = false;

    try {
      await imageQueueRef.current.retryScene(targetScene, {
        projectId,
        model: chosenModel,
        creditCost: selectedAIModel?.creditCost,
        inferenceSteps: selectedAIModel?.inferenceSteps,
        guidanceScale: selectedAIModel?.guidanceScale,
        stylePrompt: preset?.stylePrompt,
        negativePrompt: preset?.negativePrompt,
        aspectRatio: projectRef.current?.aspectRatio || preset?.aspectRatio || '16:9',
        callbacks: {
          onSceneUpdate: (sceneId, update) => {
            if (update.status === 'IMAGE_READY') {
              completedSuccessfully = true;
            }
            setScenes((prev) => {
              const next = prev.map((s) => s.sceneId === sceneId ? { ...s, ...update } : s);
              persistScenes(next);
              return next;
            });
          },
          onComplete: () => { },
          onError: (sceneId, err) => {
            console.error(`[Storyboard] Scene ${sceneId} regenerate error:`, err);
            grantUserCredits(unitCost, `Refund: Scene ${sceneId} regenerate failed`);
          },
          onPause: () => { },
        },
      });
    } catch (err) {
      console.error(`[Storyboard] retryScene error for scene ${scene.sceneId}:`, err);
      if (!completedSuccessfully) {
        grantUserCredits(unitCost, `Refund: Scene ${scene.sceneId} exception`);
      }
    } finally {
      generatingSceneIdsRef.current.delete(scene.sceneId);
    }
  }

  async function handleAddScene() {
    const nextId = scenes.length > 0 ? Math.max(...scenes.map((s) => s.sceneId)) + 1 : 1;
    const startSec = scenes.length > 0 ? scenes[scenes.length - 1].audioEndSec : 0;
    const endSec = parseFloat((startSec + 3.5).toFixed(1));
    const newScene: SceneItem = {
      sceneId: nextId,
      audioStartSec: startSec,
      audioEndSec: endSec,
      narrationLine: `Scene ${nextId}`,
      visualPrompt: `Detailed cinematic visual for scene ${nextId}`,
      fullPrompt: presetRef.current?.stylePrompt
        ? `Detailed cinematic visual for scene ${nextId}. ${presetRef.current.stylePrompt}`
        : `Detailed cinematic visual for scene ${nextId}`,
      status: 'PENDING',
    };
    const updated = [...scenes, newScene];
    setScenes(updated);
    await persistScenes(updated);
  }

  async function handleDownloadAllImages() {
    const readyScenes = scenes.filter((s) => !!s.imageUrl);
    if (readyScenes.length === 0) return;
    setDownloadingAll(true);
    setDownloadProgressMsg('Preparing ZIP…');

    try {
      const zip = new JSZip();
      const safeProjectTitle = (project?.title || 'storyboard')
        .trim()
        .replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 40) || 'scenes';

      const folder = zip.folder(safeProjectTitle) || zip;
      let packedCount = 0;

      for (let i = 0; i < readyScenes.length; i++) {
        const scene = readyScenes[i];
        setDownloadProgressMsg(`Packing ${i + 1}/${readyScenes.length}…`);

        let blob: Blob | null = null;

        // 1. Try local IndexedDB first (fastest & offline)
        if (project?.projectId) {
          try {
            const dbBlob = await getMediaBlob(`scene_${project.projectId}_${scene.sceneId}`);
            if (dbBlob && dbBlob.size > 0) {
              blob = dbBlob;
            }
          } catch (e) {
            console.warn(`[ZIP] IndexedDB error for scene ${scene.sceneId}:`, e);
          }
        }

        // 2. Fetch directly from imageUrl if not in IndexedDB
        if (!blob && scene.imageUrl) {
          try {
            const res = await fetch(scene.imageUrl);
            if (res.ok) {
              blob = await res.blob();
            }
          } catch (fetchErr) {
            console.warn(`[ZIP] Direct fetch failed for scene ${scene.sceneId}:`, fetchErr);
          }

          // 3. Fallback: Draw into canvas via Image object
          if (!blob) {
            try {
              blob = await new Promise<Blob | null>((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(null);
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
                  } catch {
                    resolve(null);
                  }
                };
                img.onerror = () => resolve(null);
                img.src = scene.imageUrl!;
              });
            } catch {
              blob = null;
            }
          }
        }

        if (blob) {
          let ext = 'jpg';
          if (blob.type.includes('png')) ext = 'png';
          else if (blob.type.includes('webp')) ext = 'webp';

          const fileName = `scene_${String(scene.sceneId).padStart(3, '0')}.${ext}`;
          folder.file(fileName, blob);
          packedCount++;
        }
      }

      if (packedCount === 0) {
        alert('Could not download image files to generate ZIP.');
        return;
      }

      setDownloadProgressMsg('Compressing ZIP…');
      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          setDownloadProgressMsg(`Compressing ${Math.round(metadata.percent)}%…`);
        }
      );

      const zipFileName = `${safeProjectTitle}_all_images.zip`;
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (err) {
      console.error('Failed to create ZIP package:', err);
      alert('Failed to package images as ZIP. Check console for details.');
    } finally {
      setDownloadingAll(false);
      setDownloadProgressMsg('');
    }
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

  const scriptWords = project?.rawScript?.trim().split(/\s+/).filter(Boolean).length || 0;
  const scriptEstSec = Math.max(15, Math.round((scriptWords / 135) * 60));
  const targetAudioSec = (project?.totalDurationMs ?? 0) > 0
    ? (project!.totalDurationMs / 1000)
    : scriptEstSec;

  const currentTimelineEndSec = scenes.length > 0 ? scenes[scenes.length - 1].audioEndSec : 0;
  const timelineNeedsSync = scenes.length > 0 && targetAudioSec > 0 && Math.abs(currentTimelineEndSec - targetAudioSec) >= 2;

  const totalDurationSec = targetAudioSec;
  const estimatedScenes = totalDurationSec > 0 ? Math.round(totalDurationSec / 4.5) : 0;

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-base p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Project Not Loaded</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">{loadError}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load()}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition"
          >
            Retry Loading
          </button>
          <button
            onClick={() => router.push('/project/new')}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition"
          >
            New Project
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

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
          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100">
            <Film size={13} className="text-zinc-200" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{project?.title}</h1>
            <p className="text-[10px] text-zinc-400">Phase 2 · Image Engine & Storyboard</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <NextStepButton
            variant="header"
            scenes={scenes}
            hasScript={!!project?.rawScript?.trim()}
            extracting={extracting}
            generatingImages={generatingImages}
            generatingMotion={generatingMotion}
            pendingImages={pendingImages}
            readyForMotion={readyForMotion}
            selectedAIModel={selectedAIModel}
            onExtract={handleExtractScenes}
            onGenerateImages={() => handleGenerateImages(scenes)}
            onGenerateMotion={() => handleGenerateMotion(scenes)}
            onStop={handleStop}
            onExport={() => router.push(`/export?id=${projectId}`)}
          />



          {/* Secondary actions — icon buttons, label shown on wide screens */}
          {readyForMotion > 0 && !isWorking && pendingImages > 0 && (
            <button
              onClick={() => handleGenerateMotion(scenes)}
              className={headerBtn}

              title={`Animate ${readyForMotion} clips`}
            >
              <Clapperboard size={14} />
              <span className="hidden xl:inline">Animate {readyForMotion}</span>
            </button>
          )}

          {scenes.some((s) => s.status === 'MOTION_READY' || s.status === 'IMAGE_READY') &&
            !isWorking &&
            (pendingImages > 0 || readyForMotion > 0) && (
              <button
                onClick={() => router.push(`/export?id=${projectId}`)}
                className={headerBtn}
                title="Go to Export"
              >
                <Zap size={14} />
                <span className="hidden xl:inline">Export</span>
              </button>
            )}

          <button
            onClick={handleAddScene}
            disabled={isWorking}
            className={headerBtn}
            title="Add a custom visual scene"
          >
            <Plus size={14} />

          </button>

          {scenes.some((s) => !!s.imageUrl) && (
            <button
              onClick={handleDownloadAllImages}
              disabled={downloadingAll}
              className={headerBtn}
              title="Download all generated scene images as a ZIP"
            >
              {downloadingAll ? (
                <Loader2 size={14} className="animate-spin text-amber-400" />
              ) : (
                <Download size={14} />
              )}

            </button>
          )}

          {scenes.length > 0 && !isWorking && (
            <button
              onClick={() => {
                setScenes([]);
                setExtractMsg('');
              }}
              className={headerBtn}
              title="Discard these scenes and extract again from the script"
            >
              <Layers size={14} />
              <span className="hidden xl:inline">Re-extract</span>
            </button>
          )}
          <button
            onClick={() => setInfoOpen(true)}
            className={headerBtn}
            title="Project info (voice, style, engine)"
          >
            <Info size={15} />
          </button>
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Right: Storyboard Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status messages (rate-limit pause, extraction progress, errors) */}
          {pauseMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/30">
              <Loader2 size={12} className="text-amber-400 animate-spin flex-shrink-0" />
              <p className="text-xs text-amber-400">{pauseMsg}</p>
            </div>
          )}
          {(extracting || extractMsg) && !extractError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-800/40 border border-bg-border">
              {extracting ? (
                <Loader2 size={12} className="text-zinc-400 animate-spin flex-shrink-0" />
              ) : (
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
              )}
              <p className="text-xs text-zinc-300">{extractMsg}</p>
            </div>
          )}
          {extractError && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/30">
              <AlertTriangle size={12} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-400">{extractError}</p>
            </div>
          )}

          {/* Voice player element (controlled from the info drawer) */}
          <audio
            ref={audioPlayerRef}
            src={voiceAudioUrl || undefined}
            onTimeUpdate={() => {
              if (audioPlayerRef.current) setVoiceCurrentTime(audioPlayerRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (audioPlayerRef.current) setVoiceDuration(audioPlayerRef.current.duration);
            }}
            onEnded={() => {
              setIsPlayingVoice(false);
              setVoiceCurrentTime(0);
            }}
            className="hidden"
          />

          {timelineNeedsSync && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 animate-fade-in text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle size={15} className="flex-shrink-0 text-amber-400" />
                <span>
                  Your {scenes.length} scenes currently cover <strong>{currentTimelineEndSec.toFixed(1)}s</strong>, but the voice narration length is <strong>{targetAudioSec.toFixed(1)}s</strong>.
                </span>
              </div>
              <button
                onClick={() => handleSyncTimelineToAudio()}
                disabled={isWorking}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition-colors flex-shrink-0 shadow disabled:opacity-50"
                title="Scale all scenes proportionally to cover full audio length"
              >
                Fit Scenes to Full Audio ({Math.round(targetAudioSec)}s)
              </button>
            </div>
          )}

          <StoryboardGrid
            projectId={projectId}
            scenes={scenes}
            aspectRatio={project?.aspectRatio || stylePreset?.aspectRatio || '16:9'}
            stylePrompt={stylePreset?.stylePrompt}
            onRegenerate={handleRegenerate}
            onUpload={handleUpload}
            onUpdateDuration={handleUpdateSceneDuration}
            disabled={isWorking}
          />
        </div>
      </div>

      <InfoDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        project={project}
        scenes={scenes}
        stylePreset={stylePreset}
        selectedAIModel={selectedAIModel}
        hasAudio={hasAudio}
        voiceAudioUrl={voiceAudioUrl}
        isPlayingVoice={isPlayingVoice}
        voiceCurrentTime={voiceCurrentTime}
        voiceDuration={voiceDuration}
        totalDurationSec={totalDurationSec}
        isWorking={isWorking}
        onTogglePlayVoice={togglePlayVoice}
        onSeekVoice={(t) => {
          setVoiceCurrentTime(t);
          if (audioPlayerRef.current) audioPlayerRef.current.currentTime = t;
        }}
        onSyncTimelineToAudio={() => handleSyncTimelineToAudio()}
      />

      {/* Insufficient Credits Modal */}
      {creditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-md text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Zap size={28} className="fill-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Insufficient Image Credits</h3>
              <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                You need <strong className="text-amber-400 font-bold">{requiredCreditsNeeded} credits</strong> to generate these images, but your current balance is lower.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-bg-base border border-bg-border text-xs text-zinc-400 leading-relaxed">
              Top up credits for as low as ৳50 or subscribe to Creator/Studio plans with instant bKash or Nagad payment!
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setCreditModalOpen(false)}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setCreditModalOpen(false);
                  router.push('/plan');
                }}
                className="btn-accent flex-1 py-2.5 text-xs font-bold"
              >
                Top-up Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
