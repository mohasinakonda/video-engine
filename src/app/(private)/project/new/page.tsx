'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
  Wand2,
  Loader2,
  AlertTriangle,
  Mic,
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
import GenerationOverlay from './components/generation-overlay';
import ScriptInput from '@/components/script-input';
import StylePresetModal from '@/components/style-preset-modal';
import ModelSelectorDropdown from '@/components/storyboard/model-selector-dropdown';
import type { AIImageModel } from '@/types/subscription';
import {
  getProject,
  saveProject,
  getDefaultStylePreset,
  getStylePresets,
  saveUserPreferredStyleId,
  saveImageModel,
} from '@/lib/store';
import { breakdownRequirementToImageScenes } from '@/lib/scene-ai';
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
  const [genStage, setGenStage] = useState(0);
  const [generationError, setGenerationError] = useState('');

  // Custom Voiceover Upload state (Optional drawer)
  const [voiceMode, setVoiceMode] = useState<'script' | 'voice'>('script');
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
          setVoiceMode('voice');
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

  const genStages = hasVoice
    ? ['Saving your audio', 'Transcribing & aligning voice', 'Directing scenes', 'Saving storyboard']
    : ['Analyzing script & story world', 'Breaking into scenes', 'Saving storyboard'];

  const SAMPLE_SCRIPT =
    'Light travels at almost three hundred thousand kilometers every second. ' +
    'It crosses the distance from the Sun to Earth in just over eight minutes. ' +
    'Yet the stars we see tonight are sending us light that left them thousands of years ago. ' +
    'When we look up at the sky, we are not seeing the present. We are looking back in time. ' +
    'Every glimmer is a message from the past, and every telescope is a time machine.';

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
      ? 'Whisper sync (from voice pauses)'
      : isManualOverride
        ? `${customSceneCount} scenes (Manual Override)`
        : words > 0
          ? `~${autoScenes} scenes (estimate)`
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
    setGenStage(0);
    setGeneratingMsg('AI Director reading script narrative & deciding scenes…');

    try {
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
        pacingProfile,
        targetDurationSec: scriptAnalytics.estSec > 0 ? scriptAnalytics.estSec : undefined,
        onProgress: (msg) => setGeneratingMsg(msg),
        onWorldBibleReady: () => setGenStage(1),
      });
      setGenStage(2);
      setGeneratingMsg('Saving storyboard…');
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
        await saveImageModel(selectedAIModel.modelId);
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
    setGenStage(0);
    setGeneratingMsg('Saving custom voiceover…');

    try {
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
      setGenStage(1);
      setGeneratingMsg('Aligning audio with script…');
      const alignResult = await alignAudioWithScript(customAudioFile, script.trim(), {
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
      setGenStage(2);
      setGeneratingMsg('AI Director analyzing voice timing & deciding scenes…');
      const visualScenes = await directScenesFromAudioAndScript(spokenSegments, {
        userScript: effectiveScript,
        totalAudioDurationSec: targetDurationSec,
        pacingProfile,
        stylePrompt: effectiveStylePrompt,
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
      setGenStage(3);
      setGeneratingMsg('Saving storyboard…');
      const customChunk = {
        index: 0,
        text: `Custom Voice: ${customAudioFile.name}`,
        filePath: `projects/${activeProjectId}/audio/custom_voice.${customAudioFile.name.split('.').pop() || 'mp3'}`,
        durationMs: customAudioDurationMs,
        status: 'COMPLETED' as const,
        audioUrl,
      };

      if (selectedAIModel) {
        await saveImageModel(selectedAIModel.modelId);
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
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-bg-border flex items-center justify-center text-zinc-300">
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
            <p className="text-xs text-zinc-400 ml-2">
              Visual Storyboard Studio · {aspectRatio}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <ol className="hidden md:flex items-center gap-2 text-xs">
          {['Script', 'Storyboard', 'Export'].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 ${i === 0 ? 'text-white font-medium' : 'text-zinc-500'}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-mono border ${
                    i === 0 ? 'bg-white text-zinc-950 border-white' : 'border-bg-border'
                  }`}
                >
                  {i + 1}
                </span>
                {label}
              </span>
              {i < 2 && <span className="w-6 h-px bg-bg-border" />}
            </li>
          ))}
        </ol>


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
                <label className="text-xxs font-semibold text-zinc-400 uppercase tracking-wider">
                  Script / Story Concept
                </label>
                {scriptAnalytics.words === 0 && !generating && (
                  <button
                    type="button"
                    onClick={() => setScript(SAMPLE_SCRIPT)}
                    className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Try a sample script
                  </button>
                )}
                {scriptAnalytics.words > 0 && (
                  <div className="flex items-center gap-2 text-2xs text-zinc-400 font-mono">
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
                <label className="text-xxs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={12} className="text-zinc-400" />
                  Aspect Ratio
                </label>
                <span className="text-2xs text-zinc-400">
                  {aspectRatio === '16:9' ? 'Widescreen' : aspectRatio === '9:16' ? 'Vertical' : 'Square'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* 16:9 */}
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${aspectRatio === '16:9'
                    ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                    : 'bg-bg-surface border-bg-border text-zinc-400 hover:text-zinc-200 hover:bg-bg-elevated'
                    }`}
                >
                  <Monitor size={18} className={aspectRatio === '16:9' ? 'text-white' : 'text-zinc-400'} />
                  <span className="text-xs font-semibold mt-1.5">16:9</span>
                  <span className="text-2xs text-zinc-400">YouTube</span>
                </button>

                {/* 9:16 */}
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${aspectRatio === '9:16'
                    ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                    : 'bg-bg-surface border-bg-border text-zinc-400 hover:text-zinc-200 hover:bg-bg-elevated'
                    }`}
                >
                  <Smartphone size={18} className={aspectRatio === '9:16' ? 'text-white' : 'text-zinc-400'} />
                  <span className="text-xs font-semibold mt-1.5">9:16</span>
                  <span className="text-2xs text-zinc-400">Reels / Shorts</span>
                </button>

                {/* 1:1 */}
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${aspectRatio === '1:1'
                    ? 'bg-zinc-800 border-white/40 text-white shadow-md'
                    : 'bg-bg-surface border-bg-border text-zinc-400 hover:text-zinc-200 hover:bg-bg-elevated'
                    }`}
                >
                  <Square size={18} className={aspectRatio === '1:1' ? 'text-white' : 'text-zinc-400'} />
                  <span className="text-xs font-semibold mt-1.5">1:1</span>
                  <span className="text-2xs text-zinc-400">Instagram Feed</span>
                </button>
              </div>
            </div>

            {/* ─── Visual Art Style Preset ──────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xxs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={12} className="text-zinc-400" />
                  Visual Art Style
                </label>
                {isPromptCustomized && (
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Prompt Modified
                  </span>
                )}
              </div>

              {/* Active Selected Style Display Card */}
              <div className="p-3.5 rounded-xl bg-bg-surface border border-bg-border hover:border-bg-border-strong transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-sm">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {activeStyle.thumbnailUrl ? (
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-bg-border shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeStyle.thumbnailUrl}
                        alt={activeStyle.name}
                        className="w-full h-full object-cover"
                      />
                      {activeStyle.tag && (
                        <span className="absolute bottom-1 left-1 text-3xs font-mono uppercase px-1 py-0.5 rounded bg-black/80 text-zinc-300">
                          {activeStyle.tag}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-bg-elevated border border-bg-border flex items-center justify-center flex-shrink-0 text-zinc-300">
                      <Palette size={22} />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {activeStyle.name}
                      </span>
                      <span className="text-3xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    </div>
                    <p className="text-xxs text-zinc-400 font-mono line-clamp-2 leading-relaxed">
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
                  className="btn-secondary w-full sm:w-auto px-4 py-2 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 flex-shrink-0 shadow-sm"
                >
                  <Wand2 size={13} className="text-zinc-400" />
                  <span>Change Style</span>
                </button>
              </div>
            </div>

            {/* ─── AI Image Generation Engine & Automatic Pacing ─────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xxs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  Select Image Model
                </label>

              </div>

              <div className="p-3.5 rounded-xl bg-bg-surface border border-bg-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-bg-border-strong transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-bg-border flex items-center justify-center text-zinc-300 flex-shrink-0">
                    <Cpu size={18} />
                  </div>
                  <div className="min-w-0 space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {selectedAIModel?.name || 'Loading AI Engine...'}
                      </span>

                    </div>
                    <p className="text-xxs text-zinc-400 line-clamp-1 leading-snug">
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

            {/* ─── Voiceover ────────────────────────────────────────────────── */}
            <div className="pt-2 border-t border-bg-border/60 space-y-3">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mic size={12} className="text-zinc-400" />
                Voiceover
              </label>

              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-bg-base border border-bg-border">
                {([
                  { id: 'script', label: 'Script only' },
                  { id: 'voice', label: 'I have a voiceover' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setVoiceMode(opt.id);
                      if (opt.id === 'script') {
                        setCustomAudioFile(null);
                        setCustomAudioDurationMs(0);
                      }
                    }}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      voiceMode === opt.id
                        ? 'bg-zinc-800 text-white border border-white/20'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {voiceMode === 'script' ? (
                <p className="text-xs text-zinc-400">
                  AI reads your script, decides the scene cuts and gives each scene a natural duration.
                </p>
              ) : (
                <div className="p-3 rounded-xl bg-bg-surface border border-bg-border space-y-3 animate-fade-in">
                  <p className="text-xs text-zinc-400">
                    Upload your recorded MP3 or WAV. Whisper extracts word timestamps so every scene matches your speech.
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
                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-700/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileAudio size={16} className="text-emerald-400 flex-shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-medium text-white truncate">{customAudioFile.name}</p>
                            <p className="text-xs text-emerald-400 font-mono">
                              {formatDuration(customAudioDurationMs)} · Ready
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomAudioFile(null);
                            setCustomAudioDurationMs(0);
                          }}
                          className="text-zinc-400 hover:text-rose-400 p-1"
                          title="Remove audio"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="voicefileinput"
                      className="btn-secondary w-full justify-center text-xs text-zinc-200 cursor-pointer py-2"
                    >
                      {readingAudioDuration ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Reading audio…</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>Upload audio file (MP3 / WAV)</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {generationError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 animate-fade-in">
                <AlertTriangle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-400">{generationError}</p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-bg-border bg-bg-surface/90 space-y-2">
            <button
              id="generate-storyboard-btn"
              type="button"
              onClick={handleGenerateVisualStoryboard}
              disabled={generating || !script.trim() || (voiceMode === 'voice' && !customAudioFile)}
              className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{generatingMsg || 'Creating storyboard…'}</span>
                </>
              ) : hasVoice ? (
                <>
                  <Mic size={16} />
                  <span>Sync Voiceover &amp; Generate Storyboard</span>
                  <ArrowRight size={15} />
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Storyboard</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
            <p className="text-xs text-center text-zinc-400">
              {!script.trim()
                ? 'Paste your script to continue.'
                : voiceMode === 'voice' && !customAudioFile
                  ? 'Upload your voiceover file to continue.'
                  : hasVoice
                    ? 'Scene timings will follow your speech.'
                    : 'AI decides the scene cuts and durations.'}
            </p>
          </div>
        </div>

        {/* Right Column: real sample of the selected style, in the chosen aspect ratio */}
        <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-8 items-center justify-center bg-radial from-zinc-900/60 to-bg-base">
          <div className="max-w-xl w-full flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs font-mono font-medium">
                {aspectRatio === '16:9' ? '16:9 Widescreen' : aspectRatio === '9:16' ? '9:16 Vertical' : '1:1 Square'}
              </span>
            </div>

            <div
              className={`relative border border-bg-border rounded-xl bg-zinc-950 overflow-hidden shadow-2xl transition-all duration-300 ${
                aspectRatio === '16:9'
                  ? 'w-full aspect-video max-h-[360px]'
                  : aspectRatio === '9:16'
                    ? 'w-[260px] aspect-[9/16] max-h-[460px]'
                    : 'w-[340px] aspect-square max-h-[360px]'
              }`}
            >
              {activeStyle.thumbnailUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeStyle.thumbnailUrl}
                    alt={activeStyle.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                    <p className="text-sm font-semibold text-white">{activeStyle.name}</p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-black">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-bg-border flex items-center justify-center mb-3 text-zinc-300">
                    <Palette size={22} />
                  </div>
                  <p className="text-sm font-semibold text-white">{activeStyle.name}</p>
                  <p className="text-xs text-zinc-400 line-clamp-3 max-w-xs mt-1">{activeStylePrompt}</p>
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-500 text-center">
              Sample of the selected style
              {isPromptCustomized ? ' · your prompt edits apply to generated scenes' : ''}
            </p>
          </div>
        </div>
      </div>

      <GenerationOverlay
        open={generating}
        stages={genStages}
        currentStage={Math.min(genStage, genStages.length - 1)}
        detail={generatingMsg}
      />

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
