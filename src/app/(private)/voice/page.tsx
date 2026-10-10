'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Download,
  X,
  Loader2,
  Play,
  Pause,
  ChevronDown,
  Wand2,
} from 'lucide-react';
import VoiceBrowser from '@/components/voice/voice-browser';
import VoiceHistory, { type VoiceHistoryEntry } from '@/components/voice/voice-history';
import { showToast } from '@/lib/toast';
import { saveMediaBlob, getMediaBlob, getMediaBlobUrl, deleteMediaBlob, getAudioDuration } from '@/lib/media-storage';
import type { VoicePreset } from '@/lib/voice-catalog';

interface VoiceEngine {
  id: string;
  name: string;
  modelId: string;
  description?: string;
  charsPerCredit: number;
  isDefault: boolean;
}

interface PlanChunk {
  index: number;
  text: string;
  tone: string | null;
}

type Phase = 'idle' | 'planning' | 'generating' | 'done' | 'error';

const HISTORY_KEY = 'voice-history-v1';
const MAX_HISTORY = 20;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function estimateCredits(chars: number, charsPerCredit: number): number {
  const per = Math.max(1, Math.floor(charsPerCredit));
  return Math.max(1, Math.ceil(Math.max(0, chars) / per));
}

function loadHistory(): VoiceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export default function VoicePage() {
  // Script
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'clip' | 'longform'>('clip');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voices & engines
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([
    { code: 'en', name: 'English' },
  ]);
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoicePreset | null>(null);
  const [engines, setEngines] = useState<VoiceEngine[]>([]);
  const [engineId, setEngineId] = useState('');
  const [languageId, setLanguageId] = useState('en');
  const [expressiveness, setExpressiveness] = useState(50);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generation
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultEntry, setResultEntry] = useState<VoiceHistoryEntry | null>(null);
  const [resultPlaying, setResultPlaying] = useState(false);
  const cancelRef = useRef(false);
  const planRef = useRef<{ planId: string; charsDone: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Preview
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // History
  const [history, setHistory] = useState<VoiceHistoryEntry[]>([]);
  const [historyPlayingId, setHistoryPlayingId] = useState<string | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);

  const engine = useMemo(
    () => engines.find((e) => e.id === engineId) || engines.find((e) => e.isDefault) || engines[0],
    [engines, engineId]
  );

  const charLimit = mode === 'longform' ? 500_000 : 5_000;
  const creditEstimate = engine ? estimateCredits(text.trim().length, engine.charsPerCredit) : 1;

  useEffect(() => {
    setHistory(loadHistory());
    fetch('/api/voice/voices')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setVoices(d.voices || []);
          setLanguages(d.languages || [{ code: 'en', name: 'English' }]);
          setEmotionTags(d.emotionTags || []);
          const first = (d.voices || [])[0] || null;
          setSelectedVoice(first);
          if (first) {
            setLanguageId(first.languageId || 'en');
            setExpressiveness(Math.round((first.exaggeration ?? 0.5) * 100));
          }
        }
      })
      .catch(() => {});
    fetch('/api/voice/models')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.models) && d.models.length > 0) {
          setEngines(d.models);
          const def = d.models.find((m: VoiceEngine) => m.isDefault) || d.models[0];
          setEngineId(def.id);
        }
      })
      .catch(() => {});
  }, []);

  const persistHistory = useCallback((entries: VoiceHistoryEntry[]) => {
    setHistory(entries);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
    } catch {
      /* storage full — keep in memory */
    }
  }, []);

  // ─── Voice preview ─────────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPreviewingId(null);
  }, []);

  /** Selecting a preset also adopts its language + delivery style (tweakable after). */
  const handleSelectVoice = useCallback((voice: VoicePreset) => {
    setSelectedVoice(voice);
    setLanguageId(voice.languageId || 'en');
    setExpressiveness(Math.round((voice.exaggeration ?? 0.5) * 100));
  }, []);

  const handlePreview = useCallback(
    async (voice: VoicePreset) => {
      if (previewingId === voice.id) {
        stopPreview();
        return;
      }
      stopPreview();
      setPreviewingId(voice.id);
      try {
        const res = await fetch('/api/voice/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preview: true,
            voiceId: voice.id,
            modelId: engine?.id,
            languageId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.audioBase64) throw new Error(data.error || 'Preview failed.');
        const blob = new Blob([base64ToBytes(data.audioBase64)], {
          type: data.mimeType || 'audio/mpeg',
        });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setPreviewingId(null);
        };
        await audio.play();
      } catch (err) {
        stopPreview();
        showToast(err instanceof Error ? err.message : 'Preview failed.', 'error');
      }
    },
    [previewingId, stopPreview, engine, languageId]
  );

  // ─── Tag inserter ──────────────────────────────────────────────────────────
  const insertTag = useCallback((tag: string) => {
    const el = textareaRef.current;
    const token = `[${tag}] `;
    if (!el) {
      setText((t) => (t ? t + '\n' + token : token));
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }, [text]);

  // ─── Generation loop (client-driven chunking; UI shows % only) ─────────────
  const cancelGeneration = useCallback(async () => {
    cancelRef.current = true;
    const plan = planRef.current;
    if (plan) {
      try {
        await fetch('/api/voice/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.planId, charsDone: plan.charsDone }),
        });
      } catch {
        /* best effort */
      }
      planRef.current = null;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    const script = text.trim();
    if (!script || !selectedVoice || !engine) return;
    if (script.length > charLimit) {
      showToast(`Script exceeds the ${charLimit.toLocaleString()}-character limit.`, 'error');
      return;
    }

    stopPreview();
    setError('');
    setResultUrl(null);
    setResultEntry(null);
    setProgress(0);
    setPhase('planning');
    cancelRef.current = false;

    try {
      // 1. Plan: chunking + credit deduction happen server-side.
      const planRes = await fetch('/api/voice/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, modelId: engine.id, mode }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error || 'Planning failed.');
      if (cancelRef.current) throw new Error('cancelled');

      const chunks: PlanChunk[] = planData.chunks;
      planRef.current = { planId: planData.planId, charsDone: 0 };

      // 2. Synthesize chunk by chunk.
      setPhase('generating');
      const parts: BlobPart[] = [];
      let charsDone = 0;

      for (let i = 0; i < chunks.length; i++) {
        if (cancelRef.current) throw new Error('cancelled');
        const chunk = chunks[i];

        let attempt = 0;
        let audioB64: string | null = null;
        let mimeType = 'audio/mpeg';
        while (attempt < 3 && !audioB64) {
          try {
            const r = await fetch('/api/voice/chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: planData.planId,
                index: chunk.index,
                text: chunk.text,
                tone: chunk.tone,
                voiceId: selectedVoice.id,
                modelId: engine.id,
                languageId,
                expressiveness,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || `Chunk ${chunk.index + 1} failed.`);
            audioB64 = d.audioBase64;
            mimeType = d.mimeType || mimeType;
          } catch (err) {
            attempt += 1;
            if (attempt >= 3) throw err;
            await new Promise((res) => setTimeout(res, 1000 * attempt));
          }
        }

        parts.push(base64ToBytes(audioB64 as string));
        charsDone += chunk.text.length;
        planRef.current = { planId: planData.planId, charsDone };
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      if (cancelRef.current) throw new Error('cancelled');

      // 3. Assemble, persist, and present.
      const blob = new Blob(parts, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const durationSec = await getAudioDuration(blob).catch(() => 0);

      const entry: VoiceHistoryEntry = {
        id: `v_${Date.now().toString(36)}`,
        text: script.slice(0, 90) + (script.length > 90 ? '…' : ''),
        voiceName: selectedVoice.name,
        engineName: engine.name,
        createdAt: Date.now(),
        durationSec,
        chars: script.length,
      };
      await saveMediaBlob(`voice_${entry.id}`, blob).catch(() => {});
      persistHistory([entry, ...loadHistory()].slice(0, MAX_HISTORY));

      planRef.current = null;
      setResultUrl(url);
      setResultEntry(entry);
      setPhase('done');
      setProgress(100);
      showToast('Narration ready.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed.';
      if (message === 'cancelled') {
        setPhase('idle');
        setProgress(0);
        showToast('Generation cancelled. Unused credits refunded.', 'info');
      } else {
        // Refund the undone portion on failure too.
        await cancelGeneration();
        setPhase('error');
        setError(message);
        showToast(message, 'error');
      }
    }
  }, [text, selectedVoice, engine, mode, charLimit, languageId, expressiveness, stopPreview, persistHistory, cancelGeneration]);

  // Keyboard: Cmd/Ctrl+Enter to generate.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'idle' || phase === 'done' || phase === 'error') handleGenerate();
      }
    },
    [phase, handleGenerate]
  );

  const busy = phase === 'planning' || phase === 'generating';

  // ─── Result + history playback ─────────────────────────────────────────────
  const toggleResultPlay = useCallback(() => {
    if (!resultUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(resultUrl);
      audioRef.current.onended = () => setResultPlaying(false);
    }
    if (resultPlaying) {
      audioRef.current.pause();
      setResultPlaying(false);
    } else {
      audioRef.current.play();
      setResultPlaying(true);
    }
  }, [resultUrl, resultPlaying]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  const handleDownloadResult = useCallback(async () => {
    if (!resultEntry) return;
    const blob = await getMediaBlob(`voice_${resultEntry.id}`);
    if (blob) downloadBlob(blob, `narration-${resultEntry.voiceName.toLowerCase()}-${resultEntry.id}.mp3`);
    else showToast('Audio not found locally.', 'error');
  }, [resultEntry, downloadBlob]);

  const handleHistoryPlay = useCallback(
    async (entry: VoiceHistoryEntry) => {
      if (historyPlayingId === entry.id) {
        historyAudioRef.current?.pause();
        setHistoryPlayingId(null);
        return;
      }
      historyAudioRef.current?.pause();
      const url = await getMediaBlobUrl(`voice_${entry.id}`);
      if (!url) {
        showToast('Audio not found locally.', 'error');
        return;
      }
      const audio = new Audio(url);
      historyAudioRef.current = audio;
      audio.onended = () => setHistoryPlayingId(null);
      setHistoryPlayingId(entry.id);
      await audio.play().catch(() => setHistoryPlayingId(null));
    },
    [historyPlayingId]
  );

  const handleHistoryDelete = useCallback(
    async (id: string) => {
      await deleteMediaBlob(`voice_${id}`).catch(() => {});
      if (historyPlayingId === id) {
        historyAudioRef.current?.pause();
        setHistoryPlayingId(null);
      }
      persistHistory(history.filter((e) => e.id !== id));
    },
    [history, historyPlayingId, persistHistory]
  );

  const canGenerate = text.trim().length > 0 && selectedVoice && engine && !busy;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 lg:px-8 py-5 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Voice</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Turn scripts into natural narration — clips or full hour-long voiceovers.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <Sparkles size={13} className="text-indigo-400" />
            {engine ? engine.name : 'Loading engine…'}
          </div>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ─── Left: script panel ─── */}
        <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-bg-border">
          <div className="flex-1 flex flex-col min-h-0 p-6 lg:p-8 overflow-y-auto">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 mb-4 bg-bg-surface border border-bg-border rounded-lg p-1 w-fit">
              {(['clip', 'longform'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={busy}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-indigo-500/20 text-indigo-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'clip' ? 'Clip' : 'Long-form'}
                </button>
              ))}
              {mode === 'longform' && (
                <span className="text-[11px] text-slate-500 pr-2">up to 1 hour</span>
              )}
            </div>

            {/* Script box */}
            <div className="relative flex-1 flex flex-col min-h-[240px]">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={busy}
                placeholder={
                  mode === 'longform'
                    ? 'Paste your full script here — chapters, dialogue, everything. Section breaks and [emotion tags] keep each part sounding right…'
                    : 'Type or paste what you want narrated…'
                }
                className="flex-1 w-full min-h-[240px] bg-bg-surface/60 border border-bg-border rounded-2xl p-5 text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none disabled:opacity-60"
              />
              <div className="absolute bottom-3 right-4 text-xs text-slate-500 pointer-events-none">
                {text.length.toLocaleString()} / {charLimit.toLocaleString()}
              </div>
            </div>

            {/* Emotion tag inserter */}
            {emotionTags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                  <Wand2 size={12} /> Direct:
                </span>
                {emotionTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => insertTag(tag)}
                    disabled={busy}
                    className="px-2 py-0.5 rounded-full text-xs bg-bg-surface border border-bg-border text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 transition-colors disabled:opacity-50"
                  >
                    [{tag}]
                  </button>
                ))}
              </div>
            )}

            {/* Progress (percentage only) */}
            {busy && (
              <div className="mt-4 p-4 rounded-2xl bg-bg-surface/60 border border-bg-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-400" />
                    {phase === 'planning' ? 'Preparing your script…' : 'Generating narration…'}
                  </span>
                  <span className="text-sm font-semibold text-white tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-border/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  onClick={cancelGeneration}
                  className="mt-3 text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <X size={12} /> Cancel (unused credits refunded)
                </button>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && error && (
              <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Result player */}
            {phase === 'done' && resultUrl && resultEntry && (
              <div className="mt-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/40">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleResultPlay}
                    aria-label={resultPlaying ? 'Pause' : 'Play'}
                    className="flex-shrink-0 w-11 h-11 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-400 transition-colors"
                  >
                    {resultPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Narration ready</p>
                    <p className="text-xs text-slate-400">
                      {resultEntry.voiceName} · {resultEntry.chars.toLocaleString()} characters
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadResult}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-surface border border-bg-border text-sm text-slate-200 hover:border-indigo-500/50 transition-colors"
                  >
                    <Download size={14} /> MP3
                  </button>
                </div>
              </div>
            )}

            {/* History */}
            <VoiceHistory
              entries={history}
              playingId={historyPlayingId}
              onPlay={handleHistoryPlay}
              onDownload={async (entry) => {
                const blob = await getMediaBlob(`voice_${entry.id}`);
                if (blob) downloadBlob(blob, `narration-${entry.id}.mp3`);
                else showToast('Audio not found locally.', 'error');
              }}
              onDelete={handleHistoryDelete}
            />
          </div>

          {/* Sticky generate bar */}
          <div className="border-t border-bg-border bg-bg-surface/70 backdrop-blur-sm px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">
                  {selectedVoice ? (
                    <>Voice: <span className="font-medium text-white">{selectedVoice.name}</span></>
                  ) : (
                    'Select a voice'
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {engine
                    ? `${creditEstimate} credit${creditEstimate === 1 ? '' : 's'} · ${engine.charsPerCredit.toLocaleString()} chars per credit`
                    : 'Loading…'}
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex-shrink-0 px-8 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm transition-colors flex items-center gap-2"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {busy ? 'Generating…' : `Generate · ${creditEstimate} credit${creditEstimate === 1 ? '' : 's'}`}
              </button>
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5 hidden sm:block">
              Tip: press ⌘/Ctrl + Enter to generate
            </p>
          </div>
        </div>

        {/* ─── Right: voices + controls ─── */}
        <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col min-h-0 bg-bg-surface/20">
          <div className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">
            {/* Now using */}
            <div className="mb-4 p-3 rounded-xl bg-bg-surface/60 border border-bg-border">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Now using</p>
              <p className="text-sm font-medium text-white">
                {selectedVoice?.name || '—'}
                <span className="text-slate-500 font-normal"> · {engine?.name || '—'}</span>
              </p>
            </div>

            {/* Voice browser */}
            <div className="flex-1 flex flex-col min-h-[200px]">
              {selectedVoice ? (
                <VoiceBrowser
                  voices={voices}
                  selectedId={selectedVoice.id}
                  onSelect={handleSelectVoice}
                  onPreview={handlePreview}
                  previewingId={previewingId}
                />
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">Loading voices…</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="border-t border-bg-border p-5 space-y-4 bg-bg-surface/40">
            {/* Engine */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Engine</label>
              <select
                value={engine?.id || ''}
                onChange={(e) => setEngineId(e.target.value)}
                disabled={busy}
                className="w-full bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 disabled:opacity-60"
              >
                {engines.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.charsPerCredit.toLocaleString()} chars/credit
                  </option>
                ))}
              </select>
            </div>

            {/* Expressiveness → Chatterbox exaggeration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Expressiveness</label>
                <span className="text-xs text-slate-300 tabular-nums">{expressiveness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={expressiveness}
                onChange={(e) => setExpressiveness(Number(e.target.value))}
                disabled={busy}
                className="w-full accent-indigo-500"
              />
              <p className="text-[11px] text-slate-600 mt-1">
                Low = calm and restrained, high = dramatic and emotional.
              </p>
            </div>

            {/* Advanced */}
            <div>
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Advanced
                <ChevronDown
                  size={13}
                  className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>
              {showAdvanced && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    Language
                  </label>
                  <select
                    value={languageId}
                    onChange={(e) => setLanguageId(e.target.value)}
                    disabled={busy}
                    className="w-full bg-bg-surface border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 disabled:opacity-60"
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-600 mt-2">
                    The narration language. Some engines vary in quality by language.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
