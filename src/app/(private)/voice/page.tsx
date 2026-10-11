'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Download,
  Loader2,
  Play,
  Pause,
  Wand2,
  Film,
  Zap,
  Check,
  RotateCcw,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { getAudioDuration } from '@/lib/media-storage';
import {
  MIMO_STYLE_TAGS,
  MIMO_INLINE_TAGS,
} from '@/lib/voice-catalog';
import { concatenateAudioParts } from '@/lib/audio-concat';

interface VoiceConfig {
  language: string;
  gender: string;
  pitch: string;
  style: string;
  useCase: string;
}

const LANGUAGE_OPTIONS = [
  'All languages',
  'English (US)',
  'English (UK)',
  'French',
  'German',
  'Italian',
  'Korean',
  'Spanish',
  'Japanese',
  'Hindi',
  'Portuguese',
  'Chinese',
  'Bengali',
  'Russian',
  'Arabic',
];

const GENDER_OPTIONS = [
  'All genders',
  'Male',
  'Female',
];

const PITCH_OPTIONS = [
  'All pitches',
  'Low',
  'Medium',
  'High',
];

const STYLE_OPTIONS = [
  'All styles',
  'Approachable',
  'Articulate',
  'Authoritative',
  'Calm',
  'Casual',
  'Clear',
  'Confident',
  'Crisp',
  'Direct',
  'Empathetic',
  'Dramatic',
  'Energetic',
  'Whispery',
  'Storyteller',
];

const USE_CASE_OPTIONS = [
  'All use cases',
  'Narration',
  'Documentary',
  'Commercial',
  'Storytelling',
  'Audiobook',
  'Video Essay',
  'Podcast',
  'Movie Trailer',
  'Conversational',
];

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  language: 'English (US)',
  gender: 'Masculine',
  pitch: 'Low',
  style: 'Authoritative',
  useCase: 'Documentary',
};

function generateVoicePrompt(cfg: VoiceConfig): string {
  const parts: string[] = [];

  const hasStyle = cfg.style && cfg.style !== 'All styles';
  const hasGender = cfg.gender && cfg.gender !== 'All genders';

  if (hasStyle && hasGender) {
    parts.push(`${cfg.style} ${cfg.gender.toLowerCase()} voice`);
  } else if (hasStyle) {
    parts.push(`${cfg.style} voice`);
  } else if (hasGender) {
    parts.push(`${cfg.gender} voice`);
  } else {
    parts.push('Natural clear voice');
  }

  if (cfg.pitch && cfg.pitch !== 'All pitches') {
    parts.push(`with ${cfg.pitch.toLowerCase()} pitch`);
  }

  if (cfg.language && cfg.language !== 'All languages') {
    parts.push(`speaking in fluent ${cfg.language}`);
  }

  if (cfg.useCase && cfg.useCase !== 'All use cases') {
    parts.push(`crafted for ${cfg.useCase.toLowerCase()} delivery`);
  }

  let result = parts.join(', ');
  if (result) {
    result = result.charAt(0).toUpperCase() + result.slice(1) + '.';
  }
  return result;
}

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

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const clean = b64.replace(/^data:audio\/[^;]+;base64,/, '').trim();
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
}

export default function VoicePage() {
  // Engine State (dynamic from Supabase database)
  const [engine, setEngine] = useState<VoiceEngine | null>(null);

  // Playground Prompts
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [text, setText] = useState('Yes, I had a sandwich.');
  const [voiceDescription, setVoiceDescription] = useState(
    generateVoicePrompt(DEFAULT_VOICE_CONFIG)
  );
  const [mode, setMode] = useState<'clip' | 'longform'>('longform');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceDescRef = useRef<HTMLTextAreaElement>(null);

  // Sidebar Controls & Dropdowns
  const [sidebarTab, setSidebarTab] = useState<'controls' | 'settings'>('controls');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // AI Assistant States
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isMatchingScript, setIsMatchingScript] = useState(false);
  const [isMatchingVoice, setIsMatchingVoice] = useState(false);

  // Generation States
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultDurationSec, setResultDurationSec] = useState<number>(0);
  const [resultChars, setResultChars] = useState<number>(0);
  const [resultPlaying, setResultPlaying] = useState(false);
  const cancelRef = useRef(false);
  const planRef = useRef<{ planId: string; charsDone: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dynamic Credits
  const charsPerCredit = engine?.charsPerCredit ?? 1000;
  const charLimit = mode === 'longform' ? 500_000 : 5_000;
  const creditEstimate = useMemo(() => {
    const chars = text.trim().length;
    if (chars <= 0) return 0;
    const per = Math.max(1, Math.floor(charsPerCredit));
    return Math.max(1, Math.ceil(chars / per));
  }, [text, charsPerCredit]);

  useEffect(() => {
    fetch('/api/voice/models')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.models) && d.models.length > 0) {
          const found =
            d.models.find(
              (m: VoiceEngine) =>
                m.id.includes('voicedesign') || m.modelId.includes('voicedesign')
            ) ||
            d.models.find((m: VoiceEngine) => m.isDefault) ||
            d.models[0];
          if (found) setEngine(found);
        }
      })
      .catch(() => { });
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Update System Instructions whenever settings change
  const handleConfigChange = useCallback((key: keyof VoiceConfig, value: string) => {
    setVoiceConfig((prev) => {
      const next = { ...prev, [key]: value };
      const generated = generateVoicePrompt(next);
      setVoiceDescription(generated);
      return next;
    });
    setOpenDropdown(null);
  }, []);

  const handleResetConfig = useCallback(() => {
    setVoiceConfig(DEFAULT_VOICE_CONFIG);
    setVoiceDescription(generateVoicePrompt(DEFAULT_VOICE_CONFIG));
    setOpenDropdown(null);
    showToast('Reset voice settings to default.', 'info');
  }, []);



  // Tag Inserters
  const insertTagIntoText = useCallback((tag: string) => {
    const el = textareaRef.current;
    const token = `${tag} `;
    if (!el) {
      setText((t) => (t ? t + ' ' + token : token));
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

  const insertTagIntoVoice = useCallback((tag: string) => {
    const el = voiceDescRef.current;
    const token = `${tag}, `;
    if (!el) {
      setVoiceDescription((v) => (v ? v + ', ' + tag : tag));
      return;
    }
    const start = el.selectionStart ?? voiceDescription.length;
    const end = el.selectionEnd ?? voiceDescription.length;
    const next = voiceDescription.slice(0, start) + token + voiceDescription.slice(end);
    setVoiceDescription(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }, [voiceDescription]);

  // AI Prompt Helpers
  const handleEnhanceVoicePrompt = useCallback(async (directorMode = false) => {
    if (isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const res = await fetch('/api/voice/design-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enhance-prompt',
          prompt: voiceDescription,
          mode: directorMode ? 'director' : 'standard',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enhancement failed.');
      if (data.enhancedPrompt) {
        setVoiceDescription(data.enhancedPrompt);
        showToast(directorMode ? 'Director Mode prompt calibrated.' : 'Voice description refined.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to enhance prompt', 'error');
    } finally {
      setIsEnhancingPrompt(false);
    }
  }, [voiceDescription, isEnhancingPrompt]);

  const handleMatchScriptToVoice = useCallback(async () => {
    if (isMatchingScript || !voiceDescription.trim()) return;
    setIsMatchingScript(true);
    try {
      const res = await fetch('/api/voice/design-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match-script',
          voicePrompt: voiceDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate script.');
      if (Array.isArray(data.samples) && data.samples.length > 0) {
        setText(data.samples[0].text);
        showToast('Generated matching speech lines.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate matching script', 'error');
    } finally {
      setIsMatchingScript(false);
    }
  }, [voiceDescription, isMatchingScript]);

  const handleMatchVoiceToScript = useCallback(async () => {
    if (isMatchingVoice || !text.trim()) return;
    setIsMatchingVoice(true);
    try {
      const res = await fetch('/api/voice/design-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match-voice',
          script: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cast voice.');
      if (data.voicePrompt) {
        setVoiceDescription(data.voicePrompt);
        showToast('Voice persona matched to script tone.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to cast voice', 'error');
    } finally {
      setIsMatchingVoice(false);
    }
  }, [text, isMatchingVoice]);


  // Synthesis Loop
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
    if (!script) {
      showToast('Please enter speech text to synthesize.', 'error');
      return;
    }
    if (script.length > charLimit) {
      showToast(`Script exceeds ${charLimit.toLocaleString()} character limit.`, 'error');
      return;
    }

    setError('');
    setResultUrl(null);
    setResultBlob(null);
    setResultDurationSec(0);
    setResultChars(0);
    setProgress(0);
    setPhase('planning');
    cancelRef.current = false;

    try {
      const targetModelId = engine?.id || 'voice-mimo-v25-voicedesign';

      const planRes = await fetch('/api/voice/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: script,
          modelId: targetModelId,
          mode,
        }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error || 'Planning failed.');
      if (cancelRef.current) throw new Error('cancelled');

      const chunks: PlanChunk[] = planData.chunks;
      planRef.current = { planId: planData.planId, charsDone: 0 };

      setPhase('generating');
      const parts: Uint8Array[] = [];
      let charsDone = 0;
      let resultMimeType = 'audio/wav';

      for (let i = 0; i < chunks.length; i++) {
        if (cancelRef.current) throw new Error('cancelled');
        const chunk = chunks[i];

        let attempt = 0;
        let audioB64: string | null = null;
        let mimeType = 'audio/wav';
        while (attempt < 3 && !audioB64) {
          try {
            const response = await fetch('/api/voice/chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: planData.planId,
                index: chunk.index,
                text: chunk.text,
                tone: chunk.tone,
                modelId: targetModelId,
                voicePrompt: voiceDescription.trim(),
              }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Chunk ${chunk.index + 1} failed.`);
            audioB64 = data.audioBase64;
            mimeType = data.mimeType || mimeType;
          } catch (err) {
            attempt += 1;
            if (attempt >= 3) throw err;
            await new Promise((res) => setTimeout(res, 1000 * attempt));
          }
        }

        parts.push(base64ToBytes(audioB64 as string));
        if (mimeType) resultMimeType = mimeType;
        charsDone += chunk.text.length;
        planRef.current = { planId: planData.planId, charsDone };
        setProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      if (cancelRef.current) throw new Error('cancelled');

      const blob = concatenateAudioParts(parts, resultMimeType);
      const url = URL.createObjectURL(blob);
      const durationSec = await getAudioDuration(blob).catch(() => 0);

      planRef.current = null;
      setResultBlob(blob);
      setResultUrl(url);
      setResultDurationSec(durationSec);
      setResultChars(script.length);
      setPhase('done');
      setProgress(100);
      showToast('Speech synthesis complete.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed.';
      if (message === 'cancelled') {
        setPhase('idle');
        setProgress(0);
        showToast('Generation cancelled.', 'info');
      } else {
        await cancelGeneration();
        setPhase('error');
        setError(message);
        showToast(message, 'error');
      }
    }
  }, [
    text,
    voiceDescription,
    mode,
    charLimit,
    engine,
    cancelGeneration,
  ]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'idle' || phase === 'done' || phase === 'error') {
          handleGenerate();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [phase, handleGenerate]);

  const busy = phase === 'planning' || phase === 'generating';

  // Audio Playback Helpers
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

  const handleDownloadResult = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, `mimo-voice-${Date.now()}.wav`);
  }, [resultBlob, downloadBlob]);


  const canGenerate = text.trim().length > 0 && !busy;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0b0e] text-slate-100 font-sans selection:bg-blue-600/30 selection:text-white">
      {/* ─── Google AI Studio Header ─── */}
      <header className="h-14 flex-shrink-0 px-6 border-b border-[#1b1e26] bg-[#0e1015]/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">Voice Studio</span>
            <span className="text-[#3b4252]">/</span>
            <span className="text-xs text-slate-400 font-medium">Playground</span>
          </div>

        </div>
      </header>

      {/* ─── Main 2-Pane Workspace ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Center: Studio Prompt & Speech Canvas ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0b0e] overflow-hidden relative">
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-5 pb-28">

            {/* Frame 1: System Instructions / Voice Persona (Google AI Studio Style) */}
            <div className="rounded-xl border border-[#1e222d] bg-[#0e1017] transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20">
              <div className="px-4 py-2.5 border-b border-[#181c26] flex items-center justify-between bg-[#11141d]/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    System Instructions
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    · Voice description & acoustic persona
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEnhanceVoicePrompt(false)}
                    disabled={isEnhancingPrompt}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 border border-blue-900/40 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Calibrate voice description with AI"
                  >
                    {isEnhancingPrompt ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Enhance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnhanceVoicePrompt(true)}
                    disabled={isEnhancingPrompt}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 border border-purple-900/40 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Expand into Director Mode script directions"
                  >
                    <Film size={11} /> Director Mode
                  </button>
                  <button
                    type="button"
                    onClick={handleMatchVoiceToScript}
                    disabled={isMatchingVoice || !text.trim()}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#1a1f2b] transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Design voice to match script content"
                  >
                    {isMatchingVoice ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    Match to Script
                  </button>
                </div>
              </div>

              <div className="p-4">
                <textarea
                  ref={voiceDescRef}
                  value={voiceDescription}
                  onChange={(e) => setVoiceDescription(e.target.value)}
                  disabled={busy}
                  rows={3}
                  placeholder="e.g. Heavy Russian accent, gruff middle-aged male, blunt and matter-of-fact."
                  className="w-full bg-transparent text-[14px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none font-mono"
                />
              </div>
            </div>

            {/* Frame 2: Content / Spoken Dialogue Input (Google AI Studio Style) */}
            <div className="rounded-xl border border-[#1e222d] bg-[#0e1017] transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20">
              <div className="px-4 py-2.5 border-b border-[#181c26] flex items-center justify-between bg-[#11141d]/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Input Text
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    · Dialogue to convert to speech
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleMatchScriptToVoice}
                  disabled={isMatchingScript || !voiceDescription.trim()}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 border border-indigo-900/40 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isMatchingScript ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  Auto-generate script for voice
                </button>
              </div>

              <div className="p-4">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                  rows={5}
                  placeholder="Type or paste text to synthesize into natural speech…"
                  className="w-full bg-transparent text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none"
                />
              </div>

              {/* Expression Tags Bar (Compact, Google-style pills) */}
              <div className="px-4 py-2.5 border-t border-[#161922] bg-[#0b0c10]/40 flex items-center gap-2 flex-wrap rounded-b-xl">
                <span className="text-[11px] text-slate-500 font-medium">Insert tags:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {MIMO_STYLE_TAGS.slice(0, 6).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTagIntoText(tag)}
                      className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 hover:text-blue-300 hover:bg-blue-950/30 border border-[#202533] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                  {MIMO_INLINE_TAGS.slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTagIntoText(tag)}
                      className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 hover:text-purple-300 hover:bg-purple-950/30 border border-[#202533] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Synthesis Progress Bar (Google AI Studio pulse line) */}
            {busy && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-300 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-blue-400" />
                    {phase === 'planning' ? 'Preparing acoustic plan…' : 'Synthesizing voice audio…'}
                  </span>
                  <span className="text-blue-200 font-mono font-medium">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#161a26] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  onClick={cancelGeneration}
                  className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
                >
                  Cancel synthesis
                </button>
              </div>
            )}

            {/* Error Message */}
            {phase === 'error' && error && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Output Stage: Sleek Waveform Player Card */}
            {phase === 'done' && resultUrl && (
              <div className="rounded-xl border border-emerald-500/30 bg-[#0d1419] p-4 flex items-center gap-4 shadow-xl">
                <button
                  onClick={toggleResultPlay}
                  aria-label={resultPlaying ? 'Pause' : 'Play'}
                  className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-all flex-shrink-0 shadow-md"
                >
                  {resultPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white truncate">
                      Synthesized Voice Output
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDuration(resultDurationSec)}
                    </span>
                  </div>

                  {/* Waveform graphic placeholder bar */}
                  <div className="h-2 rounded-full bg-[#1b252f] overflow-hidden flex items-center px-1 gap-1">
                    <div className="h-1 w-full rounded-full bg-emerald-400/80" />
                  </div>

                  <p className="text-[11px] text-slate-400 truncate">
                    {resultChars.toLocaleString()} characters · WAV Audio Output
                  </p>
                </div>

                <button
                  onClick={handleDownloadResult}
                  className="px-3 py-2 rounded-lg bg-[#18232c] hover:bg-[#202e3a] border border-[#243442] text-xs font-medium text-emerald-300 flex items-center gap-1.5 transition-colors flex-shrink-0"
                >
                  <Download size={13} /> Download WAV
                </button>
              </div>
            )}
          </div>

          {/* ─── Google AI Studio Docked Action Bar ─── */}
          <div className="absolute bottom-0 left-0 right-0 h-16 px-6 lg:px-8 border-t border-[#1c202b] bg-[#0c0d12]/95 backdrop-blur-md flex items-center justify-between z-10">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setVoiceDescription('');
                }}
                disabled={busy}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#161a24] transition-colors"
                title="Clear inputs"
              >
                <RotateCcw size={14} />
              </button>

              <span className="text-slate-500">|</span>

              <span className="text-slate-400 font-mono">
                {text.length.toLocaleString()} / {charLimit.toLocaleString()} chars
              </span>

              <span className="text-slate-500">·</span>


            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-600 text-white font-semibold text-xs tracking-wide transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:shadow-none"
              >
                {busy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Play size={12} className="fill-current" />
                )}
                <span>
                  {busy
                    ? 'Synthesizing…'
                    : creditEstimate > 0
                      ? `Run (${creditEstimate} credit)`
                      : 'Run'}
                </span>
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-black/30 rounded border border-white/10 font-mono text-slate-300 font-normal">
                  ⌘↵
                </kbd>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Right: Studio Parameters & Presets Sidebar (Google AI Studio Style) ─── */}
        {/* ─── Right: Studio Parameters & Voice Controls Sidebar (Google AI Studio Style) ─── */}
        <div
          ref={dropdownRef}
          className="w-80 lg:w-96 flex-shrink-0 border-l border-[#1b1e26] bg-[#0c0e14] flex flex-col min-h-0"
        >
          {/* Sidebar Nav Tabs */}
          <div className="h-11 border-b border-[#1b1e26] flex items-center px-4 gap-4 text-xs font-medium">
            <button
              onClick={() => {
                setSidebarTab('controls');
                setOpenDropdown(null);
              }}
              className={`pb-2.5 pt-3 transition-colors relative ${sidebarTab === 'controls' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Voice Controls
              {sidebarTab === 'controls' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => {
                setSidebarTab('settings');
                setOpenDropdown(null);
              }}
              className={`pb-2.5 pt-3 transition-colors relative ${sidebarTab === 'settings' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Parameters & Guide
              {sidebarTab === 'settings' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sidebarTab === 'controls' && (
              <div className="space-y-4">
                {/* Header & Reset */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal size={13} className="text-blue-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                      Voice Persona Filters
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-[#1a1e2b]"
                    title="Reset to default persona"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>

                {/* Filter Dropdowns Bar (Matches screenshot layout) */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-[#11131a] border border-[#1e2330]">
                  {/* Language Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'language' ? null : 'language')}
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${openDropdown === 'language'
                        ? 'bg-[#222736] border-blue-500 text-white'
                        : voiceConfig.language !== 'All languages'
                          ? 'bg-[#181d28] border-blue-500/40 text-blue-200'
                          : 'bg-[#161822] hover:bg-[#1f2230] border-[#262c3e] text-slate-300'
                        }`}
                    >
                      <span className="truncate max-w-[100px]">
                        {voiceConfig.language !== 'All languages' ? voiceConfig.language : 'Language'}
                      </span>
                      <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {openDropdown === 'language' && (
                      <div className="absolute top-full left-0 mt-1 w-44 max-h-56 overflow-y-auto rounded-xl bg-[#13151f] border border-[#272e40] shadow-2xl p-1 z-30 space-y-0.5">
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleConfigChange('language', opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${voiceConfig.language === opt
                              ? 'bg-[#1f273b] text-white font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-[#191d2a]'
                              }`}
                          >
                            <span>{opt}</span>
                            {voiceConfig.language === opt && <Check size={11} className="text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gender Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'gender' ? null : 'gender')}
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${openDropdown === 'gender'
                        ? 'bg-[#222736] border-blue-500 text-white'
                        : voiceConfig.gender !== 'All genders'
                          ? 'bg-[#181d28] border-blue-500/40 text-blue-200'
                          : 'bg-[#161822] hover:bg-[#1f2230] border-[#262c3e] text-slate-300'
                        }`}
                    >
                      <span className="truncate max-w-[90px]">
                        {voiceConfig.gender !== 'All genders' ? voiceConfig.gender : 'Gender'}
                      </span>
                      <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {openDropdown === 'gender' && (
                      <div className="absolute top-full left-0 mt-1 w-36 max-h-56 overflow-y-auto rounded-xl bg-[#13151f] border border-[#272e40] shadow-2xl p-1 z-30 space-y-0.5">
                        {GENDER_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleConfigChange('gender', opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${voiceConfig.gender === opt
                              ? 'bg-[#1f273b] text-white font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-[#191d2a]'
                              }`}
                          >
                            <span>{opt}</span>
                            {voiceConfig.gender === opt && <Check size={11} className="text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pitch Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'pitch' ? null : 'pitch')}
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${openDropdown === 'pitch'
                        ? 'bg-[#222736] border-blue-500 text-white'
                        : voiceConfig.pitch !== 'All pitches'
                          ? 'bg-[#181d28] border-blue-500/40 text-blue-200'
                          : 'bg-[#161822] hover:bg-[#1f2230] border-[#262c3e] text-slate-300'
                        }`}
                    >
                      <span className="truncate max-w-[80px]">
                        {voiceConfig.pitch !== 'All pitches' ? voiceConfig.pitch : 'Pitch'}
                      </span>
                      <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {openDropdown === 'pitch' && (
                      <div className="absolute top-full left-0 mt-1 w-36 max-h-56 overflow-y-auto rounded-xl bg-[#13151f] border border-[#272e40] shadow-2xl p-1 z-30 space-y-0.5">
                        {PITCH_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleConfigChange('pitch', opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${voiceConfig.pitch === opt
                              ? 'bg-[#1f273b] text-white font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-[#191d2a]'
                              }`}
                          >
                            <span>{opt}</span>
                            {voiceConfig.pitch === opt && <Check size={11} className="text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Style Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'style' ? null : 'style')}
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${openDropdown === 'style'
                        ? 'bg-[#222736] border-blue-500 text-white'
                        : voiceConfig.style !== 'All styles'
                          ? 'bg-[#181d28] border-blue-500/40 text-blue-200'
                          : 'bg-[#161822] hover:bg-[#1f2230] border-[#262c3e] text-slate-300'
                        }`}
                    >
                      <span className="truncate max-w-[85px]">
                        {voiceConfig.style !== 'All styles' ? voiceConfig.style : 'Style'}
                      </span>
                      <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {openDropdown === 'style' && (
                      <div className="absolute top-full right-0 sm:left-0 mt-1 w-40 max-h-56 overflow-y-auto rounded-xl bg-[#13151f] border border-[#272e40] shadow-2xl p-1 z-30 space-y-0.5">
                        {STYLE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleConfigChange('style', opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${voiceConfig.style === opt
                              ? 'bg-[#1f273b] text-white font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-[#191d2a]'
                              }`}
                          >
                            <span>{opt}</span>
                            {voiceConfig.style === opt && <Check size={11} className="text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Use case Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'useCase' ? null : 'useCase')}
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${openDropdown === 'useCase'
                        ? 'bg-[#222736] border-blue-500 text-white'
                        : voiceConfig.useCase !== 'All use cases'
                          ? 'bg-[#181d28] border-blue-500/40 text-blue-200'
                          : 'bg-[#161822] hover:bg-[#1f2230] border-[#262c3e] text-slate-300'
                        }`}
                    >
                      <span className="truncate max-w-[95px]">
                        {voiceConfig.useCase !== 'All use cases' ? voiceConfig.useCase : 'Use case'}
                      </span>
                      <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {openDropdown === 'useCase' && (
                      <div className="absolute top-full right-0 mt-1 w-44 max-h-56 overflow-y-auto rounded-xl bg-[#13151f] border border-[#272e40] shadow-2xl p-1 z-30 space-y-0.5">
                        {USE_CASE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleConfigChange('useCase', opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${voiceConfig.useCase === opt
                              ? 'bg-[#1f273b] text-white font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-[#191d2a]'
                              }`}
                          >
                            <span>{opt}</span>
                            {voiceConfig.useCase === opt && <Check size={11} className="text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>



                {/* Quick Acoustic Nuance Chips */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Acoustic Modifiers
                    </span>
                    <span className="text-[10px] text-slate-500">Tap to append</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">Age & Demographics</span>
                      <div className="flex flex-wrap gap-1">
                        {['young woman in 20s', 'middle-aged in 50s', 'elderly storyteller', 'commanding host'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => insertTagIntoVoice(chip)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-[#141722] text-slate-300 hover:text-white hover:bg-blue-900/40 border border-[#222838] transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">Texture & Timbre</span>
                      <div className="flex flex-wrap gap-1">
                        {['deep and gravelly', 'silky and magnetic', 'breathy and soft', 'resonant and crisp'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => insertTagIntoVoice(chip)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-[#141722] text-slate-300 hover:text-white hover:bg-blue-900/40 border border-[#222838] transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">Pacing & Mood</span>
                      <div className="flex flex-wrap gap-1">
                        {['blunt and matter-of-fact', 'warm and confident', 'slow and deliberate', 'urgent and breathless'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => insertTagIntoVoice(chip)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-[#141722] text-slate-300 hover:text-white hover:bg-blue-900/40 border border-[#222838] transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {sidebarTab === 'settings' && (
              <div className="space-y-5">
                {/* Model Info Card */}
                <div className="p-3.5 rounded-xl border border-[#1c212d] bg-[#10131b] space-y-2">
                  <div className="text-xs font-semibold text-white flex items-center justify-between">
                    <span>Model Specs</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate">{engine?.modelId || 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign'}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Zero-shot prompt-guided speech synthesis via DeepInfra cloud inference.
                  </p>
                  <div className="pt-2 border-t border-[#181c26] flex items-center justify-between text-xs text-slate-400">
                    <span>Billing Rate</span>
                    <span className="font-mono text-slate-200">1 credit / {charsPerCredit.toLocaleString()} chars</span>
                  </div>
                </div>

                {/* Quick Acoustic Dimension Chips */}
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Acoustic Dimension Chips
                  </span>
                  <p className="text-[11px] text-slate-500">Click to append to your voice description:</p>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">Age & Gender</span>
                      <div className="flex flex-wrap gap-1">
                        {['young woman in 20s', 'middle-aged man in 50s', 'elderly gentleman'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => insertTagIntoVoice(chip)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-[#161a24] text-slate-300 hover:text-white hover:bg-blue-900/40 border border-[#222838] transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">Texture</span>
                      <div className="flex flex-wrap gap-1">
                        {['deep and gravelly', 'silky, mellow, and magnetic', 'breathy and soft'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => insertTagIntoVoice(chip)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-[#161a24] text-slate-300 hover:text-white hover:bg-blue-900/40 border border-[#222838] transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block mb-1">Mood</span>
                      <div className="flex flex-wrap gap-1">
                        {['blunt and matter-of-fact', 'warm and confident', 'gentle with weariness', 'slow and deliberate'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => insertTagIntoVoice(chip)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-[#161a24] text-slate-300 hover:text-white hover:bg-blue-900/40 border border-[#222838] transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Best Outcome Tips */}
                <div className="p-3.5 rounded-xl border border-[#1e2330] bg-[#0f1118] space-y-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 block">MiMo Acoustic Guidelines:</span>
                  <ul className="space-y-1 list-disc list-inside text-[11px] text-slate-400">
                    <li>Include [Gender] + [Texture] + [Mood] + [Pace].</li>
                    <li>Avoid audio terms like "reverb" or "EQ".</li>
                    <li>Use parentheses tags e.g. <code className="text-blue-300 font-mono">(whispers)</code> for emotion.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
