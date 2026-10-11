'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Download,
  Loader2,
  Play,
  Wand2,
  Film,
  RotateCcw,
  Repeat,
  Rewind,
  FastForward,
  Bookmark,
  Lock,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { getAudioDuration } from '@/lib/media-storage';
import {
  MIMO_STYLE_TAGS,
  MIMO_INLINE_TAGS,
} from '@/lib/voice-catalog';
import { concatenateAudioParts } from '@/lib/audio-concat';
import { VoiceDesignModal } from './_components/voice-design-modal';
import { SidebarContent } from './_components/sidebar-content';

interface VoiceConfig {
  language: string;
  gender: string;
  ageGroup: string;
  pitch: string;
  style: string;
  useCase: string;
}

interface CustomVoice {
  id: string;
  name: string;
  deepinfra_voice_id: string;
  voice_prompt?: string;
  sample_audio_url?: string;
  gender?: string;
  language?: string;
  created_at: string;
}





const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  language: 'English (US)',
  gender: 'Male',
  ageGroup: 'Young Adult (20-35 yrs)',
  pitch: 'Medium',
  style: 'Warm & Conversational',
  useCase: 'Conversational',
};

function generateVoicePrompt(cfg: VoiceConfig): string {
  const parts: string[] = [];
  const age = cfg.ageGroup || 'Young Adult (20-35 yrs)';
  const genderLower = cfg.gender && cfg.gender !== 'All genders' ? cfg.gender.toLowerCase() : 'person';
  const hasStyle = cfg.style && cfg.style !== 'All styles';

  // 1. Biological Life-Stage Identity & Physical Vocal Tract Characteristics
  if (age.includes('3-6')) {
    const noun = genderLower === 'female' ? 'little girl' : genderLower === 'male' ? 'little boy' : 'child';
    parts.push(`A sweet and energetic 4 to 6 year old ${noun} with an innocent high-pitched voice, light and thin vocal cords, and playful childlike delivery`);
  } else if (age.includes('7-12')) {
    const noun = genderLower === 'female' ? 'schoolgirl' : genderLower === 'male' ? 'schoolboy' : 'young kid';
    parts.push(`A lively and vibrant 8 to 12 year old ${noun} with bright youthful energy, cheerful articulation, and bouncy rhythm`);
  } else if (age.includes('13-19')) {
    const noun = genderLower === 'female' ? 'teenage girl' : genderLower === 'male' ? 'teenage boy' : 'teenager';
    parts.push(`An expressive 15 to 18 year old ${noun} with modern conversational cadence, vibrant youthful inflection, and natural casual pacing`);
  } else if (age.includes('20-35')) {
    const noun = genderLower === 'female' ? 'woman' : genderLower === 'male' ? 'man' : 'adult';
    const stylePrefix = hasStyle ? `${cfg.style.toLowerCase()} ` : '';
    parts.push(`A ${stylePrefix}young adult ${noun} in their late 20s with crisp vocal resonance, clear projection, and dynamic contemporary delivery`);
  } else if (age.includes('36-55')) {
    const noun = genderLower === 'female' ? 'woman' : genderLower === 'male' ? 'man' : 'adult';
    const stylePrefix = hasStyle ? `${cfg.style.toLowerCase()} ` : '';
    parts.push(`A ${stylePrefix}middle-aged ${noun} in their 40s to 50s with rich grounded chest resonance, calm authoritative weight, and mature delivery`);
  } else if (age.includes('56+')) {
    const noun = genderLower === 'female' ? 'elderly woman' : genderLower === 'male' ? 'elderly gentleman' : 'senior';
    parts.push(`A warm and seasoned senior ${noun} with subtle weathered texture, grandfatherly or grandmotherly warmth, reflective cadence, and deliberate storytelling pacing`);
  } else {
    // Default fallback
    if (hasStyle && cfg.gender && cfg.gender !== 'All genders') {
      parts.push(`${cfg.style} ${cfg.gender.toLowerCase()} voice`);
    } else if (hasStyle) {
      parts.push(`${cfg.style} voice`);
    } else if (cfg.gender && cfg.gender !== 'All genders') {
      parts.push(`${cfg.gender} voice`);
    } else {
      parts.push('Natural clear voice');
    }
  }

  // 2. Pitch Specification
  if (cfg.pitch && cfg.pitch !== 'All pitches') {
    parts.push(`with ${cfg.pitch.toLowerCase()} pitch`);
  }

  // 3. Language
  if (cfg.language && cfg.language !== 'All languages') {
    parts.push(`speaking in fluent ${cfg.language}`);
  }

  // 4. Use Case
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


  // Custom Voices Library
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [selectedCustomVoice, setSelectedCustomVoice] = useState<CustomVoice | null>(null);
  const [loadingCustomVoices, setLoadingCustomVoices] = useState(false);
  const [auditionPlayingId, setAuditionPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [modalAudioUrl, setModalAudioUrl] = useState<string | null>(null);
  // Dedicated Voice Design Studio Modal States
  const [designModalOpen, setDesignModalOpen] = useState(false);

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
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
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


  const loadCustomVoices = useCallback(async () => {
    try {
      setLoadingCustomVoices(true);
      const res = await fetch('/api/voice/custom-voices');
      const data = await res.json();
      if (data.success && Array.isArray(data.voices)) {
        setCustomVoices(data.voices);
      }
    } catch (err) {
      console.warn('Failed to load custom voices:', err);
    } finally {
      setLoadingCustomVoices(false);
    }
  }, []);

  useEffect(() => {
    loadCustomVoices();
  }, [loadCustomVoices]);

  const handleOpenDesignModal = useCallback((blob?: Blob | null) => {
    const targetBlob = blob || null;



    if (targetBlob) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const url = URL.createObjectURL(targetBlob);
        setModalAudioUrl(url);

      };
      reader.readAsDataURL(targetBlob);
    } else {
      if (modalAudioUrl) {
        URL.revokeObjectURL(modalAudioUrl);
      }
      setModalAudioUrl(null);

    }
    setDesignModalOpen(true);
  }, [voiceConfig, voiceDescription, customVoices.length, modalAudioUrl]);

  const handleOpenSaveModal = useCallback((blob?: Blob | null) => {
    handleOpenDesignModal(blob || resultBlob);
  }, [handleOpenDesignModal, resultBlob]);





  const handleToggleAudition = useCallback((voice: CustomVoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!voice.sample_audio_url) return;

    if (auditionPlayingId === voice.id) {
      previewAudioRef.current?.pause();
      setAuditionPlayingId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      previewAudioRef.current = new Audio(voice.sample_audio_url);
      previewAudioRef.current.onended = () => setAuditionPlayingId(null);
      previewAudioRef.current.play().catch(() => { });
      setAuditionPlayingId(voice.id);
    }
  }, [auditionPlayingId]);



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
          attributes: {
            gender: voiceConfig.gender !== 'All genders' ? voiceConfig.gender : undefined,
            ageGroup: voiceConfig.ageGroup !== 'All ages' ? voiceConfig.ageGroup : undefined,
            tone: voiceConfig.style !== 'All styles' ? voiceConfig.style : undefined,
            role: voiceConfig.useCase !== 'All use cases' ? voiceConfig.useCase : undefined,
            accent: voiceConfig.language !== 'All languages' ? voiceConfig.language : undefined,
          },
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
                totalChunks: chunks.length,
                text: chunk.text,
                tone: chunk.tone,
                modelId: targetModelId,
                voicePrompt: selectedCustomVoice
                  ? (selectedCustomVoice.voice_prompt || voiceDescription.trim())
                  : voiceDescription.trim(),
                voiceId: selectedCustomVoice ? selectedCustomVoice.deepinfra_voice_id : undefined,
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



  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const handleSkip = useCallback((seconds: number) => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime || 0;
      const dur = audioRef.current.duration || 0;
      audioRef.current.currentTime = Math.max(0, Math.min(dur || 999999, cur + seconds));
    }
  }, []);

  const handleToggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.loop = next;
      }
      return next;
    });
  }, []);

  const handleRestart = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });

    }
  }, []);

  useEffect(() => {
    if (audioRef.current && resultUrl) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.loop = isLooping;
    }
  }, [resultUrl, playbackRate, isLooping]);

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

        {/* Top Right Header: My Voices counter + Flagship Design Voice Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenDesignModal()}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 border border-blue-400/30 flex items-center gap-2 transition-all active:scale-95"
            title="Design a custom voice, preview it, and lock its timbre"
          >
            <Sparkles size={14} className="text-amber-300 animate-pulse" />
            <span>Design Voice</span>
          </button>
        </div>
      </header>

      {/* ─── Main 2-Pane Workspace ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Center: Studio Prompt & Speech Canvas ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0b0e] overflow-hidden relative">
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-5 pb-28">

            {/* Active Saved Custom Voice Banner */}
            {selectedCustomVoice && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-950/40 border border-blue-500/40 text-xs shadow-md">
                <div className="flex items-center gap-2.5">
                  <span className="p-1 rounded-md bg-blue-500/20 text-blue-400">
                    <Lock size={13} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200">
                      Active Voice: <strong className="text-white font-semibold">{selectedCustomVoice.name}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      Locked Timbre
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Deterministic speaker consistency enabled
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomVoice(null)}
                    className="px-2.5 py-1 rounded-lg bg-[#141b29] hover:bg-[#1d273b] border border-blue-500/30 text-blue-300 hover:text-white transition-colors text-[11px] font-medium"
                  >
                    Switch to Designer
                  </button>
                </div>
              </div>
            )}

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

            {/* Output Stage: Enhanced Native Audio Player & Power Control Suite */}
            {phase === 'done' && resultUrl && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[#0c1218]/90 backdrop-blur-md p-5 shadow-2xl space-y-4">
                {/* Header bar: Info & Download */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white tracking-wide">
                          Voice Output
                        </span>

                      </div>

                    </div>
                  </div>

                  <div className="flex items-center gap-2">


                    <button
                      type="button"
                      onClick={handleDownloadResult}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                      <Download size={13} className="stroke-[2.5]" />
                      <span>Download WAV</span>
                    </button>
                  </div>
                </div>

                {/* Native HTML5 Audio Element with Native Controls & Dark Styling */}
                <div className="rounded-xl bg-[#070b0e] p-2.5 border border-[#1b2631] shadow-inner">
                  <audio
                    ref={audioRef}
                    controls
                    src={resultUrl}
                    className="w-full h-11 rounded-lg focus:outline-none"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>


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
        <SidebarContent

          customVoices={customVoices}
          selectedCustomVoice={selectedCustomVoice}
          setSelectedCustomVoice={setSelectedCustomVoice}
          loadingCustomVoices={loadingCustomVoices}
          handleToggleAudition={handleToggleAudition}

          auditionPlayingId={auditionPlayingId}
          setCustomVoices={setCustomVoices}
          charsPerCredit={charsPerCredit}
          insertTagIntoVoice={insertTagIntoVoice}
        />
      </div>
      {/* ─── Voice Design Studio Modal ─── */}
      {designModalOpen && (
        <VoiceDesignModal
          setCustomVoices={setCustomVoices}
          setSelectedCustomVoice={setSelectedCustomVoice}
          setDesignModalOpen={setDesignModalOpen}
        />
      )}
    </div>
  );
}
