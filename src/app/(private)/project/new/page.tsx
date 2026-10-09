'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
  Wand2,
  Loader2,
  AlertTriangle,
  Mic,
  Images,
  Gauge,
  Upload,
  X,
  FileAudio,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  Palette,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Plus,
  Minus,
  Edit3,
  Cpu,
  Zap,
} from 'lucide-react';
import ScriptInput from '@/components/script-input';
import StylePresetModal from '@/components/style-preset-modal';
import ModelSelectorDropdown from '@/components/storyboard/model-selector-dropdown';
import type { AIImageModel } from '@/types/subscription';
import {
  getPollinationsApiKey,
  getProject,
  saveProject,
  getDefaultStylePreset,
  getStylePresets,
  saveUserPreferredStyleId,
  savePollinationsImageModel,
} from '@/lib/store';
import { breakdownRequirementToImageScenes } from '@/lib/pollinations';
import {
  alignAudioWithScript,
  transcribeAudioWithWhisper,
  directScenesFromAudioAndScript,
  extractOrganicThoughtUnits,
  SpokenSegment,
  TimedWord,
} from '@/lib/audio-transcriber';
import { saveMediaBlob, getAudioDuration } from '@/lib/media-storage';
import type { ProjectManifest, SceneItem, PacingProfile, BaseStylePreset } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTitle(): string {
  const now = new Date();
  return `Project ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDuration(ms: number): string {
  if (!ms) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}


// ─── Inner Component ──────────────────────────────────────────────────────────

function ProjectPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdParam = searchParams.get('id');

  const [projectId, setProjectId] = useState<string>(() => generateId());
  const [projectTitle, setProjectTitle] = useState('');
  const [script, setScript] = useState('');

  // Aspect Ratio State
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  // Visual Style Presets State
  const [stylePresets, setStylePresets] = useState<BaseStylePreset[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isPromptCustomized, setIsPromptCustomized] = useState<boolean>(false);
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [showStyleModal, setShowStyleModal] = useState<boolean>(false);
  const [modalInitialTab, setModalInitialTab] = useState<'catalog' | 'architect' | 'library'>('catalog');

  // AI Model Selection State
  const [selectedAIModel, setSelectedAIModel] = useState<AIImageModel | null>(null);

  // Automatic AI Directed Pacing Profile
  const [pacingProfile, setPacingProfile] = useState<PacingProfile>('transcript');
  const [customSceneCount, setCustomSceneCount] = useState<number | null>(null);

  // Generation status
  const [generating, setGenerating] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState('');
  const [generationError, setGenerationError] = useState('');

  // Custom Voiceover Upload state (Optional drawer)
  const [showVoiceDrawer, setShowVoiceDrawer] = useState(false);
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioDurationMs, setCustomAudioDurationMs] = useState<number>(0);
  const [readingAudioDuration, setReadingAudioDuration] = useState(false);

  const voiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const existingProjectRef = useRef<ProjectManifest | null>(null);

  // ─── Load Initial Data ──────────────────────────────────────────────────────

  const initialize = useCallback(async () => {
    // 1. Fetch visual style presets
    const allStyles = await getStylePresets();
    setStylePresets(allStyles);
    const defaultStyle = await getDefaultStylePreset();
    if (defaultStyle) {
      setSelectedStyleId(defaultStyle.id);
      setCustomPrompt(defaultStyle.stylePrompt);
      if (defaultStyle.aspectRatio) {
        setAspectRatio(defaultStyle.aspectRatio);
      }
    }

    // 2. Load existing project or generate a fresh one
    if (projectIdParam) {
      const existing = await getProject(projectIdParam);
      if (existing) {
        if (existing.scenes && existing.scenes.length > 0 && !searchParams.get('forceNew')) {
          router.replace(`/storyboard?id=${existing.projectId}`);
          return;
        }
        existingProjectRef.current = existing;
        setProjectId(existing.projectId);
        setProjectTitle(existing.title);
        setScript(existing.rawScript);
        if (existing.aspectRatio) setAspectRatio(existing.aspectRatio);
        if (existing.baseStylePresetId) setSelectedStyleId(existing.baseStylePresetId);
        if (existing.customStylePrompt) {
          setCustomPrompt(existing.customStylePrompt);
          setIsPromptCustomized(true);
          setShowPromptEditor(true);
        } else if (existing.baseStylePresetId) {
          const match = allStyles.find((s) => s.id === existing.baseStylePresetId);
          if (match) setCustomPrompt(match.stylePrompt);
        }
        if (existing.pacingProfile) setPacingProfile(existing.pacingProfile);
        if (existing.hasCustomVoice && existing.customAudioFileName) {
          setShowVoiceDrawer(true);
        }
      }
    } else {
      const newId = generateId();
      const title = generateTitle();
      setProjectId(newId);
      setProjectTitle(title);

      const pendingScript =
        searchParams.get('script') ||
        (typeof window !== 'undefined' ? localStorage.getItem('pending_script') : null);
      if (pendingScript) {
        setScript(pendingScript);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pending_script');
        }
      }
    }
  }, [projectIdParam, searchParams]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // ─── Script Analytics Calculations ──────────────────────────────────────────

  const hasVoice = !!customAudioFile;

  const scriptAnalytics = useMemo(() => {
    const trimmed = script.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = trimmed.length;

    // Speaking pace estimate based on profile (for rough estimate only)
    const wpm = pacingProfile === 'fast' ? 145 : pacingProfile === 'cinematic' ? 115 : 130;
    const wordEstSec = words > 0 ? Math.max(12, Math.round((words / wpm) * 60)) : 0;
    const effectiveSec = customAudioDurationMs > 0 ? customAudioDurationMs / 1000 : wordEstSec;

    // Directorial scene estimation:
    let autoScenes = 0;
    if (pacingProfile === 'transcript') {
      const organicThoughts = extractOrganicThoughtUnits(trimmed);
      autoScenes = organicThoughts.length > 0
        ? organicThoughts.length
        : (effectiveSec > 0 ? Math.max(1, Math.round(effectiveSec / 5.2)) : 0);
    } else {
      const targetSceneSec = pacingProfile === 'fast' ? 3.8 : pacingProfile === 'documentary' ? 5.2 : pacingProfile === 'cinematic' ? 12.0 : 6.5;
      autoScenes = effectiveSec > 0 ? Math.max(1, Math.round(effectiveSec / targetSceneSec)) : 0;
    }

    const isManualOverride = typeof customSceneCount === 'number' && customSceneCount > 0;
    const targetScenes = isManualOverride ? customSceneCount : autoScenes;
    const avgCutSec = (effectiveSec > 0 && targetScenes > 0) ? (effectiveSec / targetScenes).toFixed(1) : '5.2';

    const estScenesDisplay = hasVoice
      ? '🎙️ Whisper Sync (Acoustic Pauses)'
      : isManualOverride
        ? `${customSceneCount} scenes (Manual Override)`
        : words > 0
          ? `AI Decides (~${autoScenes} scene beats)`
          : '0 scenes';

    return { words, chars, estSec: effectiveSec, estScenes: targetScenes, autoScenes, estScenesDisplay, avgCutSec, isManualOverride };
  }, [script, pacingProfile, customAudioDurationMs, customSceneCount, hasVoice]);

  const activeStyle = useMemo(() => {
    return (
      stylePresets.find((s) => s.id === selectedStyleId) ??
      stylePresets[0] ?? {
        id: 'builtin_cinematic',
        name: 'Dark Cinematic Documentary',
        stylePrompt: 'Cinematic 35mm anamorphic photography, photorealistic 8k, dramatic lighting',
      }
    );
  }, [stylePresets, selectedStyleId]);

  const activeStylePrompt = useMemo(() => {
    return isPromptCustomized && customPrompt.trim()
      ? customPrompt.trim()
      : activeStyle.stylePrompt;
  }, [isPromptCustomized, customPrompt, activeStyle]);



  // ─── Generate Visual Storyboard (Primary Action) ───────────────────────────

  async function handleGenerateVisualStoryboard() {
    if (customAudioFile) {
      await handleCreateWithCustomVoice();
      return;
    }
    if (!script.trim()) return;

    setGenerating(true);
    setGenerationError('');
    setGeneratingMsg('AI Director reading script narrative & deciding scenes…');

    try {
      const apiKey = (await getPollinationsApiKey()) || '';
      const chosenStyle = activeStyle;
      const effectiveStylePrompt = activeStylePrompt;

      // In Script-Only Mode:
      // If user provided a manual override (customSceneCount), pass it.
      // Otherwise pass undefined so the AI Director decides based on narrative beats!
      const userSceneCount = customSceneCount && customSceneCount > 0 ? customSceneCount : undefined;

      setGeneratingMsg(
        userSceneCount
          ? `AI Director extracting ~${userSceneCount} visual scenes & pacing…`
          : 'AI Director analyzing script beats & deciding scene count & pacing…'
      );

      const breakdown = await breakdownRequirementToImageScenes(script.trim(), {
        sceneCount: userSceneCount,
        stylePrompt: effectiveStylePrompt,
        apiKey,
        pacingProfile,
        targetDurationSec: scriptAnalytics.estSec > 0 ? scriptAnalytics.estSec : undefined,
        onProgress: (msg) => setGeneratingMsg(msg),
      });
      console.log('breakdown', breakdown)
      // NO mathematical scaling formula!
      // In Script-Only mode, the AI Director determines the natural durationSec for each visual beat.
      // Scene start and end times are simply accumulated from the AI's natural durations.
      let cumSec = 0;
      const newScenes: SceneItem[] = breakdown.map((item, idx) => {
        const dur = typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 5.0;
        const start = cumSec;
        const end = cumSec + dur;
        cumSec = end;

        return {
          sceneId: idx + 1,
          audioStartSec: parseFloat(start.toFixed(1)),
          audioEndSec: parseFloat(end.toFixed(1)),
          narrationLine: item.narration,
          visualPrompt: item.visual_prompt,
          fullPrompt: `${item.visual_prompt}. ${effectiveStylePrompt}`,
          shotType: item.shot_type,
          bRollFocus: item.b_roll_focus,
          visualType: item.visual_type,
          cameraMotion: item.camera_motion,
          status: 'PENDING',
        };
      });

      const totalDurationSec = cumSec;
      const activeProjectId = projectId || existingProjectRef.current?.projectId || generateId();
      if (projectId !== activeProjectId) setProjectId(activeProjectId);

      if (selectedAIModel) {
        await savePollinationsImageModel(selectedAIModel.modelId);
      }

      const manifest: ProjectManifest = {
        projectId: activeProjectId,
        title: projectTitle || 'Visual Storyboard',
        rawScript: script,
        voicePresetId: '',
        pacingProfile,
        aspectRatio,
        imageModel: selectedAIModel?.modelId,
        audioChunks: [],
        totalDurationMs: Math.round(totalDurationSec * 1000),
        scenes: newScenes,
        baseStylePresetId: chosenStyle.id,
        customStylePrompt: isPromptCustomized ? customPrompt.trim() : undefined,
        updatedAt: Date.now(),
      };

      await saveProject(manifest);
      router.push(`/storyboard?id=${activeProjectId}&autoGenerate=true`);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Scene extraction failed.');
      setGenerating(false);
      setGeneratingMsg('');
    }
  }

  // ─── Custom Voiceover Handlers ─────────────────────────────────────────────

  async function handleCustomVoiceSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReadingAudioDuration(true);
    setGenerationError('');
    try {
      const durSec = await getAudioDuration(file);
      setCustomAudioFile(file);
      setCustomAudioDurationMs(Math.round(durSec * 1000));
      setPacingProfile('transcript');
    } catch (err) {
      console.error('Failed to read audio duration:', err);
      setGenerationError('Could not read audio file. Please upload an MP3, WAV, or M4A file.');
    } finally {
      setReadingAudioDuration(false);
      if (voiceFileInputRef.current) voiceFileInputRef.current.value = '';
    }
  }

  async function handleCreateWithCustomVoice() {
    if (!customAudioFile) return;

    setGenerating(true);
    setGenerationError('');
    setGeneratingMsg('Saving custom voiceover…');

    try {
      const apiKey = (await getPollinationsApiKey()) || '';
      const chosenStyle = activeStyle;
      const effectiveStylePrompt = activeStylePrompt;
      const activeProjectId = projectId || existingProjectRef.current?.projectId || generateId();
      if (projectId !== activeProjectId) setProjectId(activeProjectId);

      await saveMediaBlob(`audio_${activeProjectId}_0`, customAudioFile);
      const audioUrl = URL.createObjectURL(customAudioFile);
      const targetDurationSec = customAudioDurationMs / 1000;

      let spokenSegments: SpokenSegment[] = [];
      let transcriptionText = '';
      let timedWords: TimedWord[] = [];

      const detectedLang = /[\u0980-\u09FF]/.test(script) ? 'bn' : 'en';
      setGeneratingMsg('Aligning audio with script (zero hallucination)…');
      const alignResult = await alignAudioWithScript(customAudioFile, script.trim(), {
        pollinationsApiKey: apiKey,
        language: detectedLang,
        scriptPrompt: script.trim(),
        onProgress: (msg) => setGeneratingMsg(msg),
      });
      spokenSegments = alignResult.segments;
      transcriptionText = alignResult.fullText;
      timedWords = alignResult.words;

      if (!spokenSegments || spokenSegments.length === 0) {
        throw new Error('No speech detected in this audio file. Please verify audio content.');
      }

      const effectiveScript = script.trim() || transcriptionText;
      if (!script.trim()) setScript(effectiveScript);

      // Scene count is NOT forced here — the AI Director decides it from the real
      // transcript's narrative beats, topic shifts, and speech pauses. Scene duration
      // comes from Whisper's actual word/sentence timestamps, never a guess.
      setGeneratingMsg('AI Director analyzing voice timing & deciding scenes…');
      const visualScenes = await directScenesFromAudioAndScript(spokenSegments, {
        userScript: effectiveScript,
        totalAudioDurationSec: targetDurationSec,
        pacingProfile,
        stylePrompt: effectiveStylePrompt,
        apiKey,
        words: timedWords,
        onProgress: (msg) => setGeneratingMsg(msg),
      });

      const newScenes: SceneItem[] = visualScenes.map((item, idx) => ({
        sceneId: idx + 1,
        audioStartSec: item.audioStartSec,
        audioEndSec: item.audioEndSec,
        narrationLine: item.narrationLine,
        visualPrompt: item.visualPrompt || `Visual frame capturing: ${item.narrationLine.trim()}`,
        fullPrompt: `${item.visualPrompt || ''}. ${effectiveStylePrompt}`,
        shotType: item.shotType,
        bRollFocus: item.bRollFocus,
        cutPace: item.cutPace,
        visualType: item.visualType,
        cameraMotion: item.cameraMotion,
        status: 'PENDING',
      }));
      console.log('visualScenes', visualScenes);
      const customChunk = {
        index: 0,
        text: `Custom Voice: ${customAudioFile.name}`,
        filePath: `projects/${activeProjectId}/audio/custom_voice.${customAudioFile.name.split('.').pop() || 'mp3'}`,
        durationMs: customAudioDurationMs,
        status: 'COMPLETED' as const,
        audioUrl,
      };

      if (selectedAIModel) {
        await savePollinationsImageModel(selectedAIModel.modelId);
      }

      const manifest: ProjectManifest = {
        projectId: activeProjectId,
        title: projectTitle || `Voice: ${customAudioFile.name.replace(/\.[^/.]+$/, '')}`,
        rawScript: effectiveScript,
        voicePresetId: '',
        pacingProfile,
        aspectRatio,
        imageModel: selectedAIModel?.modelId,
        hasCustomVoice: true,
        customAudioFileName: customAudioFile.name,
        audioChunks: [customChunk],
        totalDurationMs: customAudioDurationMs,
        scenes: newScenes,
        baseStylePresetId: chosenStyle.id,
        customStylePrompt: isPromptCustomized ? customPrompt.trim() : undefined,
        updatedAt: Date.now(),
      };

      await saveProject(manifest);
      router.push(`/storyboard?id=${activeProjectId}&autoGenerate=true`);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Custom voice sync failed.');
      setGenerating(false);
      setGeneratingMsg('');
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg-base">
      {/* Header */}
      <header className="px-6 py-3.5 border-b border-bg-border bg-bg-surface/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <Film size={16} />
          </div>
          <div className="min-w-0">
            <input
              className="text-sm font-semibold text-white bg-transparent border-none outline-none
                         hover:bg-bg-elevated/60 focus:bg-bg-elevated px-2 py-0.5 rounded-md
                         transition-colors w-72 truncate"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Project name…"
            />
            <p className="text-[11px] text-slate-500 ml-2">
              Visual Storyboard Studio · {aspectRatio}
            </p>
          </div>
        </div>


      </header>

      {/* Main Workspace: 2-Column Studio */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Script & Creative Controls */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 border-r border-bg-border flex flex-col bg-bg-surface/40 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Quick Template Starters */}

            {/* Script Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Script / Story Concept
                </label>
                {scriptAnalytics.words > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span>{scriptAnalytics.words} words</span>
                    <span>·</span>
                    <span>~{scriptAnalytics.estSec}s duration</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">{scriptAnalytics.estScenesDisplay}</span>
                  </div>
                )}
              </div>
              <ScriptInput
                value={script}
                onChange={setScript}
                disabled={generating}
                placeholder="Paste your video narration, voiceover script, or visual story concept here…&#10;&#10;AI Director will automatically generate visual scene prompts, camera angles, and art styles."
              />
            </div>

            {/* ─── Aspect Ratio Selector ────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={12} className="text-blue-400" />
                  Aspect Ratio
                </label>
                <span className="text-[10px] text-slate-500">
                  {aspectRatio === '16:9' ? 'Widescreen (1920×1080)' : aspectRatio === '9:16' ? 'Vertical (1080×1920)' : 'Square (1080×1080)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* 16:9 */}
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${aspectRatio === '16:9'
                    ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                    }`}
                >
                  <Monitor size={18} className={aspectRatio === '16:9' ? 'text-white' : 'text-zinc-400'} />
                  <span className="text-xs font-semibold mt-1.5">16:9</span>
                  <span className="text-[10px] text-zinc-400">YouTube</span>
                </button>

                {/* 9:16 */}
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${aspectRatio === '9:16'
                    ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                    }`}
                >
                  <Smartphone size={18} className={aspectRatio === '9:16' ? 'text-white' : 'text-zinc-400'} />
                  <span className="text-xs font-semibold mt-1.5">9:16</span>
                  <span className="text-[10px] text-zinc-400">Reels / Shorts</span>
                </button>

                {/* 1:1 */}
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${aspectRatio === '1:1'
                    ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                    }`}
                >
                  <Square size={18} className={aspectRatio === '1:1' ? 'text-white' : 'text-zinc-400'} />
                  <span className="text-xs font-semibold mt-1.5">1:1</span>
                  <span className="text-[10px] text-zinc-400">Instagram Feed</span>
                </button>
              </div>
            </div>

            {/* ─── Visual Art Style Preset ──────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={12} className="text-emerald-400" />
                  Visual Art Style
                </label>
                {isPromptCustomized && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Prompt Modified
                  </span>
                )}
              </div>

              {/* Active Selected Style Display Card */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-sm">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {activeStyle.thumbnailUrl ? (
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-700/60 shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeStyle.thumbnailUrl}
                        alt={activeStyle.name}
                        className="w-full h-full object-cover"
                      />
                      {activeStyle.tag && (
                        <span className="absolute bottom-1 left-1 text-[8px] font-mono uppercase px-1 py-0.5 rounded bg-black/80 text-zinc-300">
                          {activeStyle.tag}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 text-emerald-400">
                      <Palette size={22} />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {activeStyle.name}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono line-clamp-2 leading-relaxed">
                      {isPromptCustomized ? customPrompt : activeStyle.stylePrompt}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModalInitialTab('catalog');
                    setShowStyleModal(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/80 font-semibold text-xs transition-colors flex items-center justify-center gap-2 flex-shrink-0 shadow-sm"
                >
                  <Wand2 size={13} className="text-amber-400" />
                  <span>Change Style</span>
                </button>
              </div>
            </div>

            {/* ─── AI Image Generation Engine & Automatic Pacing ─────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  Select Image Model
                </label>

              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <Cpu size={18} />
                  </div>
                  <div className="min-w-0 space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {selectedAIModel?.name || 'Loading AI Engine...'}
                      </span>

                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-1 leading-snug">
                      {selectedAIModel?.description || 'DeepInfra high-fidelity image synthesis engine'}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center justify-end">
                  <ModelSelectorDropdown
                    onModelSelect={setSelectedAIModel}
                    size="sm"
                    direction="down"
                    align="right"
                  />
                </div>
              </div>
            </div>

            {/* ─── Optional Custom Voiceover Drawer ─────────────────────────── */}
            <div className="pt-2 border-t border-bg-border/60">
              <button
                type="button"

                className="w-full flex items-center justify-between py-2 text-xs text-white transition-colors"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Mic size={13} className="text-emerald-400" />
                  Have recorded voiceover? (Optional)
                </span>

              </button>


              <div className="mt-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 animate-fade-in">
                <p className="text-[11px] text-slate-400">
                  Upload your recorded MP3 or WAV file. Whisper AI will extract word timestamps to align every scene automatically.
                </p>

                <input
                  ref={voiceFileInputRef}
                  type="file"
                  id="voicefileinput"
                  accept="audio/*,.mp3,.wav,.m4a"
                  className="hidden"
                  onChange={handleCustomVoiceSelected}
                />

                {customAudioFile ? (
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-700/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileAudio size={16} className="text-emerald-400 flex-shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-medium text-white truncate">{customAudioFile.name}</p>
                          <p className="text-[10px] text-emerald-400 font-mono">
                            {formatDuration(customAudioDurationMs)} · Uploaded
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomAudioFile(null);
                          setCustomAudioDurationMs(0);
                        }}
                        className="text-slate-400 hover:text-red-400 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateWithCustomVoice}
                      disabled={generating}
                      className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 flex items-center justify-center gap-2"
                    >
                      {generating ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>{generatingMsg || 'Syncing Voice…'}</span>
                        </>
                      ) : (
                        <>
                          <Wand2 size={13} />
                          <span>Sync Voiceover &amp; Create Storyboard</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="voicefileinput"
                    className="btn-secondary w-full justify-center text-xs text-emerald-300 border-emerald-800/40 hover:border-emerald-600/60 cursor-pointer py-2"
                  >
                    {readingAudioDuration ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Reading Audio…</span>
                      </>
                    ) : (
                      <>
                        <Upload size={13} />
                        <span>Upload Audio File (MP3 / WAV)</span>
                      </>
                    )}
                  </label>
                )}
              </div>

            </div>

            {/* Error Message */}
            {generationError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/40 animate-fade-in">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{generationError}</p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-bg-border bg-bg-surface/90 space-y-2">
            <button
              id="generate-storyboard-btn"
              type="button"
              onClick={handleGenerateVisualStoryboard}
              disabled={generating || !script.trim()}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{generatingMsg || 'Creating Storyboard…'}</span>
                </>
              ) : hasVoice ? (
                <>
                  <Mic size={16} className="text-emerald-600" />
                  <span>Sync Voiceover &amp; Generate Storyboard</span>
                  <ArrowRight size={15} />
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-amber-500" />
                  <span>
                    Generate Visual Storyboard (AI Decides Scenes)
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-zinc-400">
              {hasVoice
                ? '🎙️ Whisper AI extracts word timecodes for 100% accurate scene durations & speech sync.'
                : '📝 AI Director reads your script, decides scene cuts & assigns natural durations without voice.'}
            </p>
          </div>
        </div>

        {/* Right Column: Live Aspect Ratio & Project Studio Simulator */}
        <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-8 items-center justify-center bg-radial from-zinc-900/60 to-bg-base">
          <div className="max-w-xl w-full flex flex-col items-center gap-6">
            {/* Aspect Ratio Simulator Frame */}
            <div className="w-full flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs font-mono font-medium">
                  {aspectRatio === '16:9' ? '16:9 Widescreen' : aspectRatio === '9:16' ? '9:16 Vertical Reel' : '1:1 Square'}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 text-xs font-mono">
                  {aspectRatio === '16:9' ? '1920 × 1080' : aspectRatio === '9:16' ? '1080 × 1920' : '1080 × 1080'}
                </span>
              </div>

              {/* Dynamic Frame Display */}
              <div
                className={`relative border-2 border-zinc-700/80 rounded-2xl bg-zinc-950 overflow-hidden shadow-2xl transition-all duration-300 flex flex-col justify-between p-5 group ${aspectRatio === '16:9'
                  ? 'w-full aspect-video max-h-[360px]'
                  : aspectRatio === '9:16'
                    ? 'w-[260px] aspect-[9/16] max-h-[460px]'
                    : 'w-[340px] aspect-square max-h-[360px]'
                  }`}
              >
                {/* Background visual atmosphere */}
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-black pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top Overlay */}
                <div className="relative z-10 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-zinc-300 font-mono text-[10px]">
                    <Layers size={10} className="text-emerald-400" />
                    Scene #1 Preview
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-zinc-400 text-[10px]">
                    {pacingProfile}
                  </span>
                </div>

                {/* Center Cinematic Art Motif */}
                <div className="relative z-10 text-center my-auto px-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto mb-3 shadow-inner text-emerald-400">
                    <Images size={22} />
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <h4 className="text-xs font-semibold text-white tracking-wide">
                      {activeStyle.name}
                    </h4>
                    {isPromptCustomized && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Customized
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 max-w-xs mx-auto">
                    {activeStylePrompt}
                  </p>
                </div>

                {/* Bottom Subtitle / Script Excerpt */}
                <div className="relative z-10 bg-black/75 backdrop-blur-md rounded-xl p-2.5 border border-white/10 text-left">
                  <p className="text-[11px] text-zinc-200 line-clamp-2 italic leading-relaxed">
                    {script.trim()
                      ? `"${script.trim().slice(0, 120)}…"`
                      : '"Paste or write your script on the left to simulate scene breakdowns…"'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="w-full grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Scenes</span>
                <p className="text-sm font-bold text-white mt-0.5 truncate px-1">
                  {scriptAnalytics.estScenes > 0 ? scriptAnalytics.estScenesDisplay : '0'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Est. Video</span>
                <p className="text-base font-bold text-white mt-0.5">
                  {scriptAnalytics.estSec > 0 ? `~${scriptAnalytics.estSec}s` : '0s'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">AI Model</span>
                <p className="text-sm font-bold text-cyan-400 mt-0.5 truncate" title={selectedAIModel?.name}>
                  {selectedAIModel?.name || 'FLUX.1'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Style Preset Modal */}
      {showStyleModal && (
        <StylePresetModal
          initialTab={modalInitialTab}
          onClose={() => setShowStyleModal(false)}
          onSelect={async (preset) => {
            const allStyles = await getStylePresets();
            setStylePresets(allStyles);
            setSelectedStyleId(preset.id);
            setCustomPrompt(preset.stylePrompt);
            setIsPromptCustomized(false);
            setShowStyleModal(false);
          }}
          selectedId={selectedStyleId}
        />
      )}
    </div>
  );
}

// ─── Exported Page (wrapped in Suspense) ──────────────────────────────────────

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-base">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      }
    >
      <ProjectPageInner />
    </Suspense>
  );
}
