'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
  Wand2,
  PlayCircle,
  StopCircle,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mic2,
  Settings,
  RotateCcw,
  FileText,
  Images,
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import ScriptInput from '@/components/script-input';
import AudioTimeline from '@/components/audio-timeline';
import { getApiKey, getPresets, getProject, saveProject, getAllProjects, getDefaultStylePreset } from '@/lib/store';
import { chunkScript } from '@/lib/gemini';
import { breakdownRequirementToImageScenes } from '@/lib/pollinations';
import { AudioQueue } from '@/lib/queue';
import { getMediaBlobUrl } from '@/lib/media-storage';
import type { AudioChunk, VoicePreset, ProjectManifest, SceneItem } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTitle(): string {
  const now = new Date();
  return `Project ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── Stage Type ───────────────────────────────────────────────────────────────

type Stage = 'input' | 'chunks' | 'generating';

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────

function ProjectPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdParam = searchParams.get('id');

  // ─── State ─────────────────────────────────────────────────────────────────

  const [stage, setStage] = useState<Stage>('input');
  const [script, setScript] = useState('');
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [projectTitle, setProjectTitle] = useState('');

  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState('');
  const [splitError, setSplitError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [noPresets, setNoPresets] = useState(false);

  // Generate Only Images state
  const [generatingOnlyImages, setGeneratingOnlyImages] = useState(false);
  const [generatingOnlyImagesMsg, setGeneratingOnlyImagesMsg] = useState('');
  const [sceneCountChoice, setSceneCountChoice] = useState(5);

  const queueRef = useRef<AudioQueue | null>(null);

  // ─── Load on mount ──────────────────────────────────────────────────────────

  const initialize = useCallback(async () => {
    const allPresets = await getPresets();
    setPresets(allPresets);
    setNoPresets(allPresets.length === 0);

    const defaultPreset = allPresets.find((p) => p.isDefault) ?? allPresets[0];
    if (defaultPreset) setSelectedPresetId(defaultPreset.id);

    const apiKey = await getApiKey();
    setApiKeyMissing(!apiKey);

    if (projectIdParam) {
      const existing = await getProject(projectIdParam);
      if (existing) {
        setProjectId(existing.projectId);
        setProjectTitle(existing.title);
        setScript(existing.rawScript);
        setSelectedPresetId(existing.voicePresetId ?? defaultPreset?.id ?? '');

        // Restore audio blob URLs from IndexedDB so playback & export always work
        const restoredChunks = await Promise.all(
          (existing.audioChunks || []).map(async (c) => {
            if (c.audioUrl) return c;
            const url = await getMediaBlobUrl(`audio_${existing.projectId}_${c.index}`);
            return { ...c, audioUrl: url || undefined };
          })
        );
        setChunks(restoredChunks);
        if (restoredChunks.length > 0) setStage('chunks');
      }
    } else {
      const newId = generateId();
      const title = generateTitle();
      setProjectId(newId);
      setProjectTitle(title);
    }
  }, [projectIdParam]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // ─── Persist project ────────────────────────────────────────────────────────

  const persistProject = useCallback(
    async (updatedChunks: AudioChunk[]) => {
      const totalDurationMs = updatedChunks
        .filter((c) => c.status === 'COMPLETED')
        .reduce((acc, c) => acc + (c.durationMs ?? 0), 0);

      const manifest: ProjectManifest = {
        projectId,
        title: projectTitle,
        rawScript: script,
        voicePresetId: selectedPresetId,
        audioChunks: updatedChunks.map(({ audioUrl: _audioUrl, ...c }) => c), // don't persist blob URLs
        totalDurationMs,
        updatedAt: Date.now(),
      };
      await saveProject(manifest);
    },
    [projectId, projectTitle, script, selectedPresetId]
  );

  // ─── Step 1: Split Script ────────────────────────────────────────────────────

  async function handleSplitScript() {
    if (!script.trim()) return;

    const apiKey = await getApiKey();
    if (!apiKey) {
      setApiKeyMissing(true);
      return;
    }

    setSplitting(true);
    setSplitError('');
    setSplitMsg('Analyzing script…');

    try {
      const chunkTexts = await chunkScript(apiKey, script, (msg) => setSplitMsg(msg));
      const newChunks: AudioChunk[] = chunkTexts.map((text, index) => ({
        index,
        text,
        filePath: `projects/${projectId}/audio/chunk_${index}.wav`,
        durationMs: 0,
        status: 'PENDING',
      }));

      setChunks(newChunks);
      setStage('chunks');
      await persistProject(newChunks);

      // Update URL to include project ID
      router.replace(`/project/new?id=${projectId}`);
    } catch (err) {
      setSplitError(err instanceof Error ? err.message : 'Script splitting failed.');
    } finally {
      setSplitting(false);
      setSplitMsg('');
    }
  }

  // ─── Image Only Mode: Direct to Storyboard ─────────────────────────────────

  async function handleGenerateOnlyImages() {
    if (!script.trim()) return;

    setGeneratingOnlyImages(true);
    setSplitError('');
    setGeneratingOnlyImagesMsg('Extracting visual scenes…');

    try {
      const apiKey = await getApiKey();
      const stylePreset = await getDefaultStylePreset();
      const breakdown = await breakdownRequirementToImageScenes(script.trim(), {
        sceneCount: sceneCountChoice,
        stylePrompt: stylePreset.stylePrompt,
        apiKey,
      });

      const newScenes: SceneItem[] = breakdown.map((item, idx) => ({
        sceneId: idx + 1,
        audioStartSec: parseFloat((idx * 3.5).toFixed(1)),
        audioEndSec: parseFloat(((idx + 1) * 3.5).toFixed(1)),
        narrationLine: item.narration,
        visualPrompt: item.visual_prompt,
        fullPrompt: `${item.visual_prompt}. ${stylePreset.stylePrompt}`,
        status: 'PENDING',
      }));

      const manifest: ProjectManifest = {
        projectId,
        title: projectTitle || 'Image Storyboard',
        rawScript: script,
        voicePresetId: selectedPresetId,
        audioChunks: [],
        totalDurationMs: newScenes.length * 3500,
        scenes: newScenes,
        baseStylePresetId: stylePreset.id,
        updatedAt: Date.now(),
      };

      await saveProject(manifest);
      router.push(`/storyboard?id=${projectId}&autoGenerate=true`);
    } catch (err) {
      setSplitError(err instanceof Error ? err.message : 'Scene extraction failed.');
      setGeneratingOnlyImages(false);
      setGeneratingOnlyImagesMsg('');
    }
  }

  // ─── Step 2: Generate Audio ───────────────────────────────────────────────

  async function handleGenerate() {
    if (chunks.length === 0) return;

    const apiKey = await getApiKey();
    if (!apiKey) { setApiKeyMissing(true); return; }

    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) { return; }

    setGenerating(true);
    queueRef.current = new AudioQueue();

    await queueRef.current.run({
      apiKey,
      preset,
      projectId,
      chunks: chunks.filter((c) => c.status === 'PENDING' || c.status === 'FAILED'),
      callbacks: {
        onChunkUpdate: (index, update) => {
          setChunks((prev) => {
            const next = prev.map((c) =>
              c.index === index ? { ...c, ...update } : c
            );
            // Persist after each update (debounced via side effect)
            persistProject(next);
            return next;
          });
        },
        onComplete: () => {
          setGenerating(false);
          setStage('chunks');
        },
        onError: (index, error) => {
          console.warn(`Chunk ${index} failed:`, error);
        },
      },
    });
  }

  function handleStop() {
    queueRef.current?.cancel();
    setGenerating(false);
    // Reset PROCESSING chunks back to PENDING
    setChunks((prev) =>
      prev.map((c) => (c.status === 'PROCESSING' ? { ...c, status: 'PENDING' } : c))
    );
  }

  async function handleRetryChunk(chunk: AudioChunk) {
    const apiKey = await getApiKey();
    if (!apiKey) return;
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    if (!queueRef.current) queueRef.current = new AudioQueue();

    setChunks((prev) =>
      prev.map((c) => (c.index === chunk.index ? { ...c, status: 'PENDING', error: undefined } : c))
    );

    await queueRef.current.retryChunk(chunk, {
      apiKey,
      preset,
      projectId,
      callbacks: {
        onChunkUpdate: (index, update) => {
          setChunks((prev) => {
            const next = prev.map((c) => (c.index === index ? { ...c, ...update } : c));
            persistProject(next);
            return next;
          });
        },
        onComplete: () => { },
        onError: () => { },
      },
    });
  }

  function handleTextChange(index: number, text: string) {
    setChunks((prev) => {
      const next = prev.map((c) => (c.index === index ? { ...c, text } : c));
      persistProject(next);
      return next;
    });
  }

  // ─── Derived state ──────────────────────────────────────────────────────────

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);
  const pendingOrFailed = chunks.filter((c) => c.status === 'PENDING' || c.status === 'FAILED').length;
  const allDone = chunks.length > 0 && chunks.every((c) => c.status === 'COMPLETED');

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <input
              className="text-base font-bold text-white bg-transparent border-none outline-none
                         hover:bg-bg-elevated/50 focus:bg-bg-elevated px-2 py-0.5 rounded-md
                         transition-colors w-full max-w-sm"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Project name…"
            />
            <p className="text-xs text-slate-600 ml-2 mt-0.5">
              {projectId ? `ID: ${projectId.slice(0, 16)}…` : ''}
            </p>
          </div>

          {/* Warnings */}
          <div className="flex items-center gap-3">
            {apiKeyMissing && (
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-1.5 text-xs text-amber-400 px-3 py-1.5 rounded-lg
                           bg-amber-950/40 border border-amber-800/40 hover:bg-amber-900/40 transition-colors"
              >
                <AlertTriangle size={12} />
                Set API Key
              </button>
            )}
            {noPresets && (
              <button
                onClick={() => router.push('/voice-studio')}
                className="flex items-center gap-1.5 text-xs text-purple-400 px-3 py-1.5 rounded-lg
                           bg-purple-950/40 border border-purple-800/40 hover:bg-purple-900/40 transition-colors"
              >
                <Mic2 size={12} />
                Create Voice Preset
              </button>
            )}
          </div>
        </header>

        {/* Two-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Script Input + Controls */}
          <div className="w-96 flex-shrink-0 border-r border-bg-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Script Input */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <FileText size={14} className="text-slate-500" />
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Script</h2>
                </div>
                <ScriptInput
                  value={script}
                  onChange={setScript}
                  disabled={stage !== 'input' || splitting || generating}
                />
              </div>

              {/* Split error */}
              {splitError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-800/40 animate-fade-in">
                  <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{splitError}</p>
                </div>
              )}

              {/* Split progress */}
              {splitting && splitMsg && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 animate-fade-in">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
                  <p className="text-xs text-blue-400">{splitMsg}</p>
                </div>
              )}

              {/* Voice Preset Selector */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mic2 size={13} className="text-slate-500" />
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Voice Preset
                  </label>
                </div>
                {presets.length === 0 ? (
                  <button
                    onClick={() => router.push('/voice-studio')}
                    className="w-full btn-secondary text-xs"
                  >
                    <Mic2 size={12} />
                    Create a Voice Preset
                  </button>
                ) : (
                  <div className="relative">
                    <select
                      id="voice-preset-select"
                      className="input pr-8 appearance-none"
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                      disabled={generating}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                )}

                {/* Preset summary */}
                {selectedPreset && (
                  <div className="mt-2 p-2.5 rounded-lg bg-bg-base/50 border border-bg-border text-[11px] text-slate-500 space-y-0.5 animate-fade-in">
                    <div className="flex gap-2">
                      <span className="text-slate-600">Voice:</span>
                      <span className="text-slate-400">{selectedPreset.voiceCharacter}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-600">Pace:</span>
                      <span className="text-slate-400">{selectedPreset.pace.toFixed(2)}×</span>
                    </div>
                    {selectedPreset.scene && (
                      <div className="flex gap-2">
                        <span className="text-slate-600">Scene:</span>
                        <span className="text-slate-400 truncate">{selectedPreset.scene}</span>
                      </div>
                    )}
                    <button
                      onClick={() => router.push('/voice-studio')}
                      className="flex items-center gap-1 text-accent-purple-light/70 hover:text-accent-purple-light transition-colors pt-1"
                    >
                      <Settings size={10} />
                      Edit presets
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5 border-t border-bg-border space-y-3">
              {/* Step 1: Split */}
              {stage === 'input' && (
                <>
                  <button
                    id="split-script-btn"
                    onClick={handleSplitScript}
                    disabled={splitting || !script.trim() || apiKeyMissing}
                    className="btn-primary w-full justify-center"
                  >
                    {splitting
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Wand2 size={15} />}
                    {splitting ? 'Splitting…' : 'Split Script & Voice'}
                  </button>

                  {/* Generate Only Images Option */}
                  <div className="pt-3 border-t border-bg-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Images size={13} className="text-purple-400" />
                        Images-Only Mode
                      </span>
                      <span className="text-[10px] text-purple-400/80 bg-purple-950/60 border border-purple-800/40 px-1.5 py-0.5 rounded font-mono">
                        Pollinations AI
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mb-2.5 bg-bg-base/60 p-1.5 rounded-lg border border-bg-border/50">
                      <span className="text-[11px] text-slate-400 pl-1">Scene count:</span>
                      <div className="flex gap-1">
                        {[3, 5, 8, 10].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setSceneCountChoice(count)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                              sceneCountChoice === count
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-bg-elevated'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      id="generate-only-images-btn"
                      type="button"
                      onClick={handleGenerateOnlyImages}
                      disabled={generatingOnlyImages || splitting || !script.trim()}
                      className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:via-indigo-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98]"
                    >
                      {generatingOnlyImages ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{generatingOnlyImagesMsg || 'Extracting Scenes…'}</span>
                        </>
                      ) : (
                        <>
                          <Images size={14} />
                          <span>Generate Only Images</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                      Directly creates visual storyboard &amp; generates images with Pollinations AI (free, skips voice)
                    </p>
                  </div>
                </>
              )}

              {/* Re-split option */}
              {stage === 'chunks' && !generating && (
                <button
                  id="re-split-btn"
                  onClick={() => { setStage('input'); setChunks([]); }}
                  className="btn-secondary w-full justify-center text-xs"
                >
                  <RotateCcw size={13} />
                  Re-Split Script
                </button>
              )}

              {/* Step 2: Generate */}
              {stage === 'chunks' && !allDone && (
                generating ? (
                  <button
                    id="stop-generation-btn"
                    onClick={handleStop}
                    className="btn-danger w-full justify-center"
                  >
                    <StopCircle size={15} />
                    Stop Generation
                  </button>
                ) : (
                  <button
                    id="generate-audio-btn"
                    onClick={handleGenerate}
                    disabled={!selectedPresetId || apiKeyMissing || pendingOrFailed === 0}
                    className="btn-primary w-full justify-center"
                  >
                    <PlayCircle size={15} />
                    {pendingOrFailed < chunks.length
                      ? `Resume Generation (${pendingOrFailed} remaining)`
                      : 'Generate Audio'}
                  </button>
                )
              )}

              {/* All done */}
              {allDone && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">All chunks complete!</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Chunk Timeline */}
          <div className="flex-1 overflow-y-auto p-6">
            {stage === 'input' && chunks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center min-h-[300px]">
                <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center mb-4">
                  <Wand2 size={28} className="text-slate-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-400 mb-1">Ready to split</h3>
                <p className="text-sm text-slate-600 max-w-xs">
                  Paste your script on the left, select a voice preset, then click{' '}
                  <strong className="text-slate-500">Split Script</strong>.
                </p>
              </div>
            )}

            {chunks.length > 0 && (
              <AudioTimeline
                chunks={chunks}
                onRetry={handleRetryChunk}
                onTextChange={handleTextChange}
                editingEnabled={!generating}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Exported Page (wrapped in Suspense for useSearchParams) ──────────────────

export default function ProjectPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <Loader2 size={24} className="animate-spin text-accent-purple" />
      </div>
    }>
      <ProjectPageInner />
    </Suspense>
  );
}
