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
  Upload,
  SlidersHorizontal,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { TEXT_LIMITS, VOICE_CLIP_MAX_CHARS, scriptTooLongMessage } from '@/lib/input-limits';
import { useScriptCharLimit } from '@/hooks/use-script-limit';
import CharCounter from '@/components/char-counter';
import { getAudioDuration } from '@/lib/media-storage';
import {
  MIMO_STYLE_TAGS,
  MIMO_INLINE_TAGS,
} from '@/lib/voice-catalog';
import {
  getVoiceStyle,
  getUseCase,
  styleToParams,
  type StyleParams,
} from '@/lib/voice-styles';
import { concatenateAudioParts } from '@/lib/audio-concat';
import { VoiceDesignModal } from './_components/voice-design-modal';
import { VoiceCloneModal } from './_components/voice-clone-modal';
import { SidebarContent } from './_components/sidebar-content';
import StyleDrawer from './_components/style-drawer';

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
  const selectedCustomVoiceRef = useRef<CustomVoice | null>(null);
  selectedCustomVoiceRef.current = selectedCustomVoice;
  const [loadingCustomVoices, setLoadingCustomVoices] = useState(false);
  const [auditionPlayingId, setAuditionPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [modalAudioUrl, setModalAudioUrl] = useState<string | null>(null);
  // Dedicated Voice Design & Clone Modal States
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);

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

  // ─── Delivery style drawer (additive: null = existing behaviour) ───
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string | null>(null);
  // Slider values shown in the drawer; only sent when styleTouched is true.
  const [styleParams, setStyleParams] = useState<StyleParams>({ expressiveness: 50, cfgWeight: 0.5, temperature: 0.7 });
  const [styleTouched, setStyleTouched] = useState(false);
  const [previewingStyle, setPreviewingStyle] = useState(false);
  // Reuses the existing previewAudioRef declared below (voice audition previews).
  // Refs mirror style state for the async chunk loop (same pattern as sessionVoiceIdRef).
  const styleTouchedRef = useRef(false);
  const styleParamsRef = useRef<StyleParams>({ expressiveness: 50, cfgWeight: 0.5, temperature: 0.7 });
  styleTouchedRef.current = styleTouched;
  styleParamsRef.current = styleParams;

  const activeStyle = getVoiceStyle(selectedStyleId);
  // True when sliders were dragged away from the selected preset.
  const isStyleCustom = styleTouched && !!activeStyle && (
    styleParams.expressiveness !== Math.round(activeStyle.exaggeration * 100) ||
    styleParams.cfgWeight !== activeStyle.cfgWeight ||
    styleParams.temperature !== activeStyle.temperature
  );

  const handleSelectStyle = useCallback((id: string | null) => {
    setSelectedStyleId(id);
    setSelectedUseCaseId(null); // manual style pick clears the use-case shortcut
    const style = getVoiceStyle(id);
    if (style) {
      setStyleParams(styleToParams(style));
      setStyleTouched(true);
    } else {
      setStyleTouched(false);
    }
  }, []);

  const handleSelectUseCase = useCallback((id: string | null) => {
    setSelectedUseCaseId(id);
    const useCase = getUseCase(id);
    if (useCase) {
      const style = getVoiceStyle(useCase.styleId);
      setSelectedStyleId(useCase.styleId);
      if (style) {
        setStyleParams(styleToParams(style));
        setStyleTouched(true);
      }
    } else {
      setSelectedStyleId(null);
      setStyleTouched(false);
    }
  }, []);

  const handleStyleParamsChange = useCallback((p: StyleParams) => {
    setStyleParams(p);
    setStyleTouched(true);
  }, []);

  const handleResetStyle = useCallback(() => {
    setSelectedStyleId(null);
    setSelectedUseCaseId(null);
    setStyleParams({ expressiveness: 50, cfgWeight: 0.5, temperature: 0.7 });
    setStyleTouched(false);
  }, []);

  // Free style preview: short sample through the preview path with current drawer params.
  const handlePreviewStyle = useCallback(async () => {
    if (previewingStyle) return;
    const currentVoice = selectedCustomVoiceRef.current || selectedCustomVoice;
    setPreviewingStyle(true);
    try {
      const res = await fetch('/api/voice/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview: true,
          text: 'The city never truly sleeps — it only changes its rhythm, trading daylight noise for midnight whispers.',
          modelId: currentVoice
            ? 'ResembleAI/chatterbox-multilingual'
            : (engine?.modelId || engine?.id || 'ResembleAI/chatterbox-multilingual'),
          voicePrompt: currentVoice
            ? (currentVoice.voice_prompt || voiceDescription.trim())
            : voiceDescription.trim(),
          voiceId: currentVoice ? currentVoice.deepinfra_voice_id : undefined,
          expressiveness: styleParams.expressiveness,
          cfgWeight: styleParams.cfgWeight,
          temperature: styleParams.temperature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed.');
      const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        URL.revokeObjectURL(previewAudioRef.current.src);
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Preview failed.', 'error');
    } finally {
      setPreviewingStyle(false);
    }
  }, [previewingStyle, selectedCustomVoice, engine, voiceDescription, styleParams]);
  const cancelRef = useRef(false);
  const planRef = useRef<{ planId: string; charsDone: number } | null>(null);
  /** Session anchor voice ID (chunk 0's clone) — echoed to the server on later chunks for voice consistency. */
  const sessionVoiceIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dynamic Credits
  const charsPerCredit = engine?.charsPerCredit ?? 1000;
  const { limit: planCharLimit, nextTier } = useScriptCharLimit();
  const charLimit = mode === 'longform' ? planCharLimit : Math.min(VOICE_CLIP_MAX_CHARS, planCharLimit);
  const textTooLong = text.trim().length > charLimit;
  const descriptionTooLong = voiceDescription.trim().length > TEXT_LIMITS.voiceDescription;
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
            d.models.find((m: VoiceEngine) => m.isDefault) ||
            d.models.find(
              (m: VoiceEngine) =>
                m.id.includes('chatterbox') || m.modelId.includes('chatterbox')
            ) ||
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
      showToast(scriptTooLongMessage(script.length, charLimit), 'error');
      return;
    }
    if (voiceDescription.trim().length > TEXT_LIMITS.voiceDescription) {
      showToast(`Voice description must be ${TEXT_LIMITS.voiceDescription} characters or fewer.`, 'error');
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
    sessionVoiceIdRef.current = null;

    try {
      const activeCustomVoice = selectedCustomVoiceRef.current || selectedCustomVoice;
      // For custom voices and default narration, route to high-capacity Chatterbox Multilingual (5,000-char single pass)
      // so scripts up to 4,800 characters are never split into multiple chunks.
      let targetModelId = activeCustomVoice
        ? 'ResembleAI/chatterbox-multilingual'
        : (engine?.modelId || engine?.id || 'ResembleAI/chatterbox-multilingual');

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
      // Deterministic neural seed for this entire generation session —
      // locks timbre, pitch contour, and pacing so chunk 1, 2, 3 never drift in tone.
      const sessionSeed = Math.floor(Math.random() * 900000) + 100000;

      for (let i = 0; i < chunks.length; i++) {
        if (cancelRef.current) throw new Error('cancelled');
        const chunk = chunks[i];

        let attempt = 0;
        let audioB64: string | null = null;
        let mimeType = 'audio/wav';
        while (attempt < 3 && !audioB64) {
          try {
            const currentVoice = selectedCustomVoiceRef.current || selectedCustomVoice;
            const response: Response = await fetch('/api/voice/chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: planData.planId,
                index: chunk.index,
                totalChunks: chunks.length,
                text: chunk.text,
                tone: chunk.tone,
                seed: sessionSeed,
                modelId: targetModelId,
                voicePrompt: currentVoice
                  ? (currentVoice.voice_prompt || voiceDescription.trim())
                  : voiceDescription.trim(),
                voiceId: currentVoice ? currentVoice.deepinfra_voice_id : undefined,
                // Echo the session anchor voice so all chunks share chunk 0's voice,
                // even if requests land on different serverless instances.
                sessionVoiceId: sessionVoiceIdRef.current || undefined,
                // Delivery-style overrides — only when the user touched the style
                // drawer; otherwise the request is identical to before.
                ...(styleTouchedRef.current ? {
                  expressiveness: styleParamsRef.current.expressiveness,
                  cfgWeight: styleParamsRef.current.cfgWeight,
                  temperature: styleParamsRef.current.temperature,
                } : {}),
              }),
            });
            const data: any = await response.json();
            if (!response.ok) throw new Error(data.error || `Chunk ${chunk.index + 1} failed.`);
            if (typeof data.sessionVoiceId === 'string' && data.sessionVoiceId) {
              sessionVoiceIdRef.current = data.sessionVoiceId;
            }
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
    selectedCustomVoice,
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


  const canGenerate = text.trim().length > 0 && !textTooLong && !descriptionTooLong && !busy;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg-base text-zinc-100 font-sans selection:bg-white/20 selection:text-white">
      {/* ─── Google AI Studio Header ─── */}
      <header className="h-14 flex-shrink-0 px-6 border-b border-bg-border bg-bg-surface/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">Voice Studio</span>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-400 font-medium">Playground</span>
          </div>
        </div>

        {/* Top Right Header: Clone Voice + Flagship Design Voice Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCloneModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-xs text-white font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            title="Upload audio sample to clone a voice"
          >
            <Upload size={13} className="text-emerald-400" />
            <span>Clone Voice</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenDesignModal()}
            className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-2"
            title="Design a custom voice, preview it, and lock its timbre"
          >
            <Sparkles size={14} />
            <span>Design Voice</span>
          </button>
        </div>
      </header>

      {/* ─── Main 2-Pane Workspace ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Center: Studio Prompt & Speech Canvas ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-bg-base overflow-hidden relative">
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-5 pb-28">

            {/* Active Saved Custom Voice Banner */}
            {selectedCustomVoice && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="p-1 rounded-md bg-zinc-800 text-zinc-300">
                    <Lock size={13} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-200">
                      Active Voice: <strong className="text-white font-semibold">{selectedCustomVoice.name}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Locked Timbre
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xxs text-zinc-400 hidden sm:inline">
                    Deterministic speaker consistency enabled
                  </span>
                  {/* Delivery style: badge shows active style, button opens the drawer */}
                  {activeStyle && (
                    <span className="px-1.5 py-0.5 rounded text-2xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Style: {activeStyle.label}{isStyleCustom ? ' · Custom' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setStyleDrawerOpen(true)}
                    title="Delivery style settings"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-colors text-xxs font-medium"
                  >
                    <SlidersHorizontal size={12} />
                    Style
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomVoice(null)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-colors text-xxs font-medium"
                  >
                    Switch to Designer
                  </button>
                </div>
              </div>
            )}

            {/* Frame 1: System Instructions / Voice Persona (Google AI Studio Style) */}
            <div className="rounded-xl border border-bg-border bg-bg-surface transition-all focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-white/10">
              <div className="px-4 py-2.5 border-b border-bg-border flex items-center justify-between bg-bg-elevated/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    System Instructions
                  </span>
                  <span className="text-xxs text-zinc-500 font-normal">
                    · Voice description & acoustic persona
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEnhanceVoicePrompt(false)}
                    disabled={isEnhancingPrompt}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Calibrate voice description with AI"
                  >
                    {isEnhancingPrompt ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Enhance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnhanceVoicePrompt(true)}
                    disabled={isEnhancingPrompt}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="Expand into Director Mode script directions"
                  >
                    <Film size={11} /> Director Mode
                  </button>
                  <button
                    type="button"
                    onClick={handleMatchVoiceToScript}
                    disabled={isMatchingVoice || !text.trim()}
                    className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-1 disabled:opacity-50"
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
                  className="w-full bg-transparent text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none font-mono"
                />
                <CharCounter length={voiceDescription.trim().length} limit={TEXT_LIMITS.voiceDescription} />
              </div>
            </div>

            {/* Frame 2: Content / Spoken Dialogue Input (Google AI Studio Style) */}
            <div className="rounded-xl border border-bg-border bg-bg-surface transition-all focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-white/10">
              <div className="px-4 py-2.5 border-b border-bg-border flex items-center justify-between bg-bg-elevated/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Input Text
                  </span>
                  <span className="text-xxs text-zinc-500 font-normal">
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
                  className="w-full bg-transparent text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none"
                />
              </div>

              {/* Expression Tags Bar (Compact pills) */}
              <div className="px-4 py-2.5 border-t border-bg-border bg-bg-base/40 flex items-center gap-2 flex-wrap rounded-b-xl">
                <span className="text-xxs text-zinc-500 font-medium">Insert tags:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {MIMO_STYLE_TAGS.slice(0, 6).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTagIntoText(tag)}
                      className="px-2 py-0.5 rounded text-xxs font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                  {MIMO_INLINE_TAGS.slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTagIntoText(tag)}
                      className="px-2 py-0.5 rounded text-xxs font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Synthesis Progress Bar */}
            {busy && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-zinc-400" />
                    {phase === 'planning' ? 'Preparing acoustic plan…' : 'Synthesizing voice audio…'}
                  </span>
                  <span className="text-zinc-200 font-mono font-medium">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  onClick={cancelGeneration}
                  className="text-xxs text-zinc-400 hover:text-red-400 transition-colors"
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
              <div className="rounded-2xl border border-bg-border bg-bg-surface/90 backdrop-blur-md p-5 shadow-2xl space-y-4">
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
                      className="btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5"
                    >
                      <Download size={13} className="stroke-[2.5]" />
                      <span>Download WAV</span>
                    </button>
                  </div>
                </div>

                {/* Native HTML5 Audio Element with Native Controls & Dark Styling */}
                <div className="rounded-xl bg-bg-base p-2.5 border border-bg-border shadow-inner">
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
          <div className="absolute bottom-0 left-0 right-0 h-16 px-6 lg:px-8 border-t border-bg-border bg-bg-surface/95 backdrop-blur-md flex items-center justify-between z-10">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setVoiceDescription('');
                }}
                disabled={busy}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Clear inputs"
              >
                <RotateCcw size={14} />
              </button>

              <span className="text-zinc-600">|</span>

              <span className={`font-mono ${textTooLong ? 'text-rose-400' : 'text-zinc-400'}`}>
                {text.trim().length.toLocaleString()} / {charLimit.toLocaleString()} chars
              </span>
              {textTooLong && mode === 'longform' && nextTier && (
                <a href="/plan" className="text-rose-400 underline underline-offset-2 hover:text-rose-300">
                  Upgrade to {nextTier.label} for {nextTier.limit.toLocaleString()}
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="btn-primary px-6 py-2 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-2"
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
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-2xs bg-black/30 rounded border border-white/10 font-mono text-zinc-300 font-normal">
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
          onOpenCloneModal={() => setCloneModalOpen(true)}
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
      {/* ─── Voice Clone Modal ─── */}
      <VoiceCloneModal
        isOpen={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        existingCount={customVoices.length}
        onVoiceCreated={(newVoice) => {
          setCustomVoices((prev) => [newVoice, ...prev]);
          setSelectedCustomVoice(newVoice);
        }}
      />
      {/* ─── Delivery Style Drawer ─── */}
      <StyleDrawer
        open={styleDrawerOpen}
        onClose={() => setStyleDrawerOpen(false)}
        selectedStyleId={selectedStyleId}
        onSelectStyle={handleSelectStyle}
        selectedUseCaseId={selectedUseCaseId}
        onSelectUseCase={handleSelectUseCase}
        params={styleParams}
        onParamsChange={handleStyleParamsChange}
        isCustom={isStyleCustom}
        onReset={handleResetStyle}
        onPreview={handlePreviewStyle}
        previewing={previewingStyle}
      />
    </div>
  );
}
