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
} from 'lucide-react';
import ScriptInput from '@/components/script-input';
import {
  getPollinationsApiKey,
  getProject,
  saveProject,
  getDefaultStylePreset,
  getStylePresets,
} from '@/lib/store';
import { breakdownRequirementToImageScenes } from '@/lib/pollinations';
import {
  transcribeAudioWithWhisper,
  directScenesFromAudioAndScript,
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

// ─── Sample Templates for Quick Launch ───────────────────────────────────────

const SAMPLE_TEMPLATES = [
  {
    title: '🌊 Deep Ocean Mysteries',
    ratio: '16:9' as const,
    styleId: 'builtin_cinematic',
    pacing: 'cinematic' as const,
    text: `Beneath five thousand meters of midnight ocean, a forgotten thermal trench pulses with bioluminescent life. Ghostly siphonophores float like living constellations through the abyssal cold. Ancient volcanic chimneys billow black mineral smoke into the current, illuminating alien mineral crusts and subterranean secrets undiscovered for ten million years.`,
  },
  {
    title: '🚀 Colony 3042',
    ratio: '9:16' as const,
    styleId: 'builtin_cinematic',
    pacing: 'fast' as const,
    text: `Orbiting Saturn's crystal rings, the orbital tether station wakes to artificial sunrise. Titanium cables hum under atmospheric tension as cargo freighters glide between atmospheric clouds. Neon navigation beacons pulse against purple ammonia storms, guiding autonomous drones across humanity's farthest outpost.`,
  },
  {
    title: '🏛️ Ancient Alexandria',
    ratio: '16:9' as const,
    styleId: 'builtin_artisan_linocut',
    pacing: 'balanced' as const,
    text: `In the shadow of the great lighthouse of Pharos, scrolls of lost geometry and celestial maps line cedar shelves. Scholars walk marbled colonnades as bronze astrolabes catch the Mediterranean dusk. The scent of papyrus, sea salt, and olive oil fills the air on the eve of the great fire.`,
  },
  {
    title: '⚡ Master Craftsman',
    ratio: '1:1' as const,
    styleId: 'builtin_conceptual_illustration',
    pacing: 'balanced' as const,
    text: `Every chisel stroke removes the unnecessary until only essence remains. Heated cherry-red steel meets anvil under rhythmic hammer strikes, sparks showering into the darkened workshop. Decades of discipline distilled into a single razor edge.`,
  },
];

// ─── Inner Component ──────────────────────────────────────────────────────────

function ProjectPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdParam = searchParams.get('id');

  const [projectId, setProjectId] = useState<string>('');
  const [projectTitle, setProjectTitle] = useState('');
  const [script, setScript] = useState('');

  // Aspect Ratio State
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  // Visual Style Presets State
  const [stylePresets, setStylePresets] = useState<BaseStylePreset[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');

  // Pacing Profile
  const [pacingProfile, setPacingProfile] = useState<PacingProfile>('balanced');

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

  const scriptAnalytics = useMemo(() => {
    const trimmed = script.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = trimmed.length;

    // Speaking pace estimate based on profile
    const wpm = pacingProfile === 'fast' ? 145 : pacingProfile === 'cinematic' ? 120 : 135;
    const estSec = words > 0 ? Math.max(12, Math.round((words / wpm) * 60)) : 0;

    // Cut duration based on profile
    const cutSec = pacingProfile === 'fast' ? 2.5 : pacingProfile === 'cinematic' ? 5.5 : 4.0;
    const estScenes = estSec > 0 ? Math.max(1, Math.round(estSec / cutSec)) : 0;

    return { words, chars, estSec, estScenes };
  }, [script, pacingProfile]);

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

  // ─── Generate Visual Storyboard (Primary Action) ───────────────────────────

  async function handleGenerateVisualStoryboard() {
    if (customAudioFile) {
      await handleCreateWithCustomVoice();
      return;
    }
    if (!script.trim()) return;

    setGenerating(true);
    setGenerationError('');
    setGeneratingMsg('AI Director extracting visual scenes & pacing…');

    try {
      const apiKey = (await getPollinationsApiKey()) || '';
      const chosenStyle = activeStyle;

      const words = script.trim().split(/\s+/).filter(Boolean).length;
      const wpm = pacingProfile === 'fast' ? 145 : pacingProfile === 'cinematic' ? 120 : 135;
      const wordEstSec = Math.max(15, Math.round((words / wpm) * 60));
      const targetDurationSec = customAudioDurationMs > 0 ? customAudioDurationMs / 1000 : wordEstSec;

      const breakdown = await breakdownRequirementToImageScenes(script.trim(), {
        targetDurationSec,
        stylePrompt: chosenStyle.stylePrompt,
        apiKey,
        pacingProfile,
        onProgress: (msg) => setGeneratingMsg(msg),
      });

      // Scale scenes to cover targetDurationSec perfectly
      const rawTotal = breakdown.reduce(
        (sum, item) => sum + (typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0),
        0
      );
      const scale = rawTotal > 0 ? targetDurationSec / rawTotal : 1;

      let cumSec = 0;
      const newScenes: SceneItem[] = breakdown.map((item, idx) => {
        const rawDur = typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0;
        const dur = rawDur * scale;
        const start = cumSec;
        const end = idx === breakdown.length - 1 ? targetDurationSec : cumSec + dur;
        cumSec = end;

        return {
          sceneId: idx + 1,
          audioStartSec: parseFloat(start.toFixed(1)),
          audioEndSec: parseFloat(end.toFixed(1)),
          narrationLine: item.narration,
          visualPrompt: item.visual_prompt,
          fullPrompt: `${item.visual_prompt}. ${chosenStyle.stylePrompt}`,
          shotType: item.shot_type,
          bRollFocus: item.b_roll_focus,
          status: 'PENDING',
        };
      });

      const manifest: ProjectManifest = {
        projectId,
        title: projectTitle || 'Visual Storyboard',
        rawScript: script,
        voicePresetId: '',
        pacingProfile,
        aspectRatio,
        audioChunks: [],
        totalDurationMs: Math.round(targetDurationSec * 1000),
        scenes: newScenes,
        baseStylePresetId: chosenStyle.id,
        updatedAt: Date.now(),
      };

      await saveProject(manifest);
      router.push(`/storyboard?id=${projectId}&autoGenerate=true`);
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

      await saveMediaBlob(`audio_${projectId}_0`, customAudioFile);
      const audioUrl = URL.createObjectURL(customAudioFile);
      const targetDurationSec = customAudioDurationMs / 1000;

      let spokenSegments: SpokenSegment[] = [];
      let transcriptionText = '';
      let timedWords: TimedWord[] = [];

      setGeneratingMsg('Transcribing audio with Whisper AI (word timestamps)…');
      const whisperResult = await transcribeAudioWithWhisper(customAudioFile, {
        pollinationsApiKey: apiKey,
        onProgress: (msg) => setGeneratingMsg(msg),
      });
      spokenSegments = whisperResult.segments;
      transcriptionText = whisperResult.fullText;
      timedWords = whisperResult.words;

      if (!spokenSegments || spokenSegments.length === 0) {
        throw new Error('No speech detected in this audio file. Please verify audio content.');
      }

      const effectiveScript = script.trim() || transcriptionText;
      if (!script.trim()) setScript(effectiveScript);

      setGeneratingMsg('AI Director aligning visual scenes to voice timestamps…');
      const visualScenes = await directScenesFromAudioAndScript(spokenSegments, {
        userScript: effectiveScript,
        totalAudioDurationSec: targetDurationSec,
        pacingProfile,
        stylePrompt: chosenStyle.stylePrompt,
        apiKey,
        words: timedWords,
        onProgress: (msg) => setGeneratingMsg(msg),
      });

      const newScenes: SceneItem[] = visualScenes.map((item, idx) => ({
        sceneId: idx + 1,
        audioStartSec: item.audioStartSec,
        audioEndSec: item.audioEndSec,
        narrationLine: item.narrationLine,
        visualPrompt: item.visualPrompt || `Cinematic frame capturing: ${item.narrationLine.slice(0, 100)}`,
        fullPrompt: `${item.visualPrompt || ''}. ${chosenStyle.stylePrompt}`,
        shotType: item.shotType,
        bRollFocus: item.bRollFocus,
        cutPace: item.cutPace,
        status: 'PENDING',
      }));

      const customChunk = {
        index: 0,
        text: `Custom Voice: ${customAudioFile.name}`,
        filePath: `projects/${projectId}/audio/custom_voice.${customAudioFile.name.split('.').pop() || 'mp3'}`,
        durationMs: customAudioDurationMs,
        status: 'COMPLETED' as const,
        audioUrl,
      };

      const manifest: ProjectManifest = {
        projectId,
        title: projectTitle || `Voice: ${customAudioFile.name.replace(/\.[^/.]+$/, '')}`,
        rawScript: effectiveScript,
        voicePresetId: '',
        pacingProfile,
        aspectRatio,
        hasCustomVoice: true,
        customAudioFileName: customAudioFile.name,
        audioChunks: [customChunk],
        totalDurationMs: customAudioDurationMs,
        scenes: newScenes,
        baseStylePresetId: chosenStyle.id,
        updatedAt: Date.now(),
      };

      await saveProject(manifest);
      router.push(`/storyboard?id=${projectId}&autoGenerate=true`);
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

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
            <Sparkles size={11} />
            Pollinations AI (Free Tier)
          </span>
        </div>
      </header>

      {/* Main Workspace: 2-Column Studio */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Script & Creative Controls */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 border-r border-bg-border flex flex-col bg-bg-surface/40 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Quick Template Starters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-400" />
                  Quick Starters
                </span>
                <span className="text-[10px] text-slate-500">1-click sample script</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SAMPLE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.title}
                    type="button"
                    onClick={() => {
                      setScript(tmpl.text);
                      setAspectRatio(tmpl.ratio);
                      setSelectedStyleId(tmpl.styleId);
                      setPacingProfile(tmpl.pacing);
                    }}
                    className="text-left px-2.5 py-2 rounded-lg bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all text-[11px] text-zinc-300 truncate"
                  >
                    {tmpl.title}
                  </button>
                ))}
              </div>
            </div>

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
                    <span className="text-emerald-400 font-semibold">~{scriptAnalytics.estScenes} scenes</span>
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
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    aspectRatio === '16:9'
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
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    aspectRatio === '9:16'
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
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    aspectRatio === '1:1'
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette size={12} className="text-emerald-400" />
                  Visual Art Style
                </label>
                <span className="text-[10px] text-emerald-400/90 font-mono truncate max-w-[180px]">
                  {activeStyle.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {stylePresets.map((preset) => {
                  const isSelected = preset.id === selectedStyleId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedStyleId(preset.id)}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-zinc-800/95 border-emerald-500/60 shadow-sm'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium truncate ${isSelected ? 'text-white font-semibold' : 'text-zinc-300'}`}>
                          {preset.name}
                        </span>
                        {isSelected && <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />}
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
                        {preset.stylePrompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Scene Pacing Profile ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge size={12} className="text-cyan-400" />
                  Directorial Pacing
                </label>
                <span className="text-[10px] font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                  {pacingProfile === 'fast' ? '~2.5s cuts' : pacingProfile === 'balanced' ? '~4.0s dynamic' : '~5.5s cinematic'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                {(['fast', 'balanced', 'cinematic'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPacingProfile(p)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                      pacingProfile === p
                        ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Optional Custom Voiceover Drawer ─────────────────────────── */}
            <div className="pt-2 border-t border-bg-border/60">
              <button
                type="button"
                onClick={() => setShowVoiceDrawer(!showVoiceDrawer)}
                className="w-full flex items-center justify-between py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Mic size={13} className="text-emerald-400" />
                  Have recorded voiceover? (Optional)
                </span>
                {showVoiceDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showVoiceDrawer && (
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
              )}
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
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>
                    Generate Visual Storyboard
                    {scriptAnalytics.estScenes > 0 ? ` (~${scriptAnalytics.estScenes} Scenes)` : ''}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Directly generates image prompts &amp; storyboard scenes with Pollinations AI
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
                className={`relative border-2 border-zinc-700/80 rounded-2xl bg-zinc-950 overflow-hidden shadow-2xl transition-all duration-300 flex flex-col justify-between p-5 group ${
                  aspectRatio === '16:9'
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
                  <h4 className="text-xs font-semibold text-white tracking-wide mb-1">
                    {activeStyle.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 max-w-xs mx-auto">
                    {activeStyle.stylePrompt}
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
                <p className="text-base font-bold text-white mt-0.5">
                  {scriptAnalytics.estScenes > 0 ? `~${scriptAnalytics.estScenes}` : '0'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Est. Video</span>
                <p className="text-base font-bold text-white mt-0.5">
                  {scriptAnalytics.estSec > 0 ? `~${scriptAnalytics.estSec}s` : '0s'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Pacing</span>
                <p className="text-base font-bold text-emerald-400 mt-0.5 capitalize">
                  {pacingProfile}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
