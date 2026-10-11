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
  Repeat,
  Rewind,
  FastForward,
  Bookmark,
  Trash2,
  Lock,
  Plus,
  Volume2,
  X,
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

const AGE_GROUP_OPTIONS = [
  'All ages',
  'Child (3-6 yrs)',
  'Young Kid (7-12 yrs)',
  'Teenager (13-19 yrs)',
  'Young Adult (20-35 yrs)',
  'Middle-Aged (36-55 yrs)',
  'Senior / Elder (56+ yrs)',
];

const AGE_SAMPLE_TEXTS: Record<string, string> = {
  'Child (3-6 yrs)': 'Look Mommy, look at that giant colorful butterfly! Can we go play in the park right now?',
  'Young Kid (7-12 yrs)': 'Did you know that volcanoes can create entirely new islands in the middle of the ocean? It is so cool!',
  'Teenager (13-19 yrs)': 'Honestly, I didn’t think this was going to work at all, but it actually turned out pretty amazing.',
  'Young Adult (20-35 yrs)': 'Welcome back to the studio. Today, we are breaking down the biggest breakthroughs reshaping our future.',
  'Middle-Aged (36-55 yrs)': 'Throughout history, the greatest discoveries have emerged not from certainty, but from the courage to explore.',
  'Senior / Elder (56+ yrs)': 'I still remember when these quiet hills were covered in wild pines, long before the city came to be.',
};

const PITCH_OPTIONS = [
  'All pitches',
  'Low',
  'Medium',
  'High',
  'Very High (Childlike)',
];

const STYLE_OPTIONS = [
  'All styles',
  'Warm & Conversational',
  'Casual Everyday Human',
  'Childlike & Innocent',
  'Playful & Cute',
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
  'Conversational',
  'Kids & Animation',
  'Children Storytelling',
  'Narration',
  'Documentary',
  'Commercial',
  'Storytelling',
  'Audiobook',
  'Video Essay',
  'Podcast',
  'Movie Trailer',
];

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

  // Sidebar Controls & Dropdowns
  const [sidebarTab, setSidebarTab] = useState<'controls' | 'saved' | 'settings'>('controls');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom Voices Library
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [selectedCustomVoice, setSelectedCustomVoice] = useState<CustomVoice | null>(null);
  const [loadingCustomVoices, setLoadingCustomVoices] = useState(false);
  const [auditionPlayingId, setAuditionPlayingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Dedicated Voice Design Studio Modal States
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [modalVoiceName, setModalVoiceName] = useState('');
  const [modalConfig, setModalConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [modalPrompt, setModalPrompt] = useState(generateVoicePrompt(DEFAULT_VOICE_CONFIG));
  const [modalAuditionText, setModalAuditionText] = useState(
    'In a world shaped by endless questions, one voice emerges to tell the story.'
  );
  const [modalAuditioning, setModalAuditioning] = useState(false);
  const [modalAudioUrl, setModalAudioUrl] = useState<string | null>(null);
  const [modalAudioBase64, setModalAudioBase64] = useState<string | null>(null);
  const [modalAudioDuration, setModalAudioDuration] = useState<number>(0);
  const [modalAudioCurrentTime, setModalAudioCurrentTime] = useState<number>(0);
  const [modalAudioPlaying, setModalAudioPlaying] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalEnhancingPrompt, setModalEnhancingPrompt] = useState(false);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);

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
      if (key === 'ageGroup') {
        if (value.includes('3-6')) {
          next.pitch = 'Very High (Childlike)';
          next.useCase = 'Kids & Animation';
        } else if (value.includes('7-12')) {
          next.pitch = 'High';
          next.useCase = 'Children Storytelling';
        } else if (value.includes('13-19')) {
          next.pitch = 'Medium';
          next.useCase = 'Conversational';
        } else if (value.includes('56+')) {
          if (next.pitch === 'High' || next.pitch === 'Very High (Childlike)') {
            next.pitch = 'Medium';
          }
          next.useCase = 'Storytelling';
        }
      }
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
    const stylePart = voiceConfig.style !== 'All styles' ? voiceConfig.style : 'Studio';
    const genderPart = voiceConfig.gender !== 'All genders' ? voiceConfig.gender : 'Voice';
    setModalVoiceName(`${stylePart} ${genderPart} ${customVoices.length + 1}`.trim());
    setModalConfig({ ...voiceConfig });
    setModalPrompt(voiceDescription || generateVoicePrompt(voiceConfig));
    setModalAudioPlaying(false);
    setModalAudioCurrentTime(0);

    if (targetBlob) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setModalAudioBase64(base64);
        const url = URL.createObjectURL(targetBlob);
        setModalAudioUrl(url);
        const dur = await getAudioDuration(targetBlob).catch(() => 4);
        setModalAudioDuration(dur);
      };
      reader.readAsDataURL(targetBlob);
    } else {
      if (modalAudioUrl) {
        URL.revokeObjectURL(modalAudioUrl);
      }
      setModalAudioUrl(null);
      setModalAudioBase64(null);
      setModalAudioDuration(0);
    }
    setDesignModalOpen(true);
  }, [voiceConfig, voiceDescription, customVoices.length, modalAudioUrl]);

  const handleOpenSaveModal = useCallback((blob?: Blob | null) => {
    handleOpenDesignModal(blob || resultBlob);
  }, [handleOpenDesignModal, resultBlob]);

  const handleModalConfigChange = useCallback((key: keyof VoiceConfig, value: string) => {
    setModalConfig((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'ageGroup') {
        if (value.includes('3-6')) {
          next.pitch = 'Very High (Childlike)';
          next.useCase = 'Kids & Animation';
          if (AGE_SAMPLE_TEXTS['Child (3-6 yrs)']) {
            setModalAuditionText(AGE_SAMPLE_TEXTS['Child (3-6 yrs)']);
          }
        } else if (value.includes('7-12')) {
          next.pitch = 'High';
          next.useCase = 'Children Storytelling';
          if (AGE_SAMPLE_TEXTS['Young Kid (7-12 yrs)']) {
            setModalAuditionText(AGE_SAMPLE_TEXTS['Young Kid (7-12 yrs)']);
          }
        } else if (value.includes('13-19')) {
          next.pitch = 'Medium';
          next.useCase = 'Conversational';
          if (AGE_SAMPLE_TEXTS['Teenager (13-19 yrs)']) {
            setModalAuditionText(AGE_SAMPLE_TEXTS['Teenager (13-19 yrs)']);
          }
        } else if (value.includes('20-35')) {
          if (AGE_SAMPLE_TEXTS['Young Adult (20-35 yrs)']) {
            setModalAuditionText(AGE_SAMPLE_TEXTS['Young Adult (20-35 yrs)']);
          }
        } else if (value.includes('36-55')) {
          if (AGE_SAMPLE_TEXTS['Middle-Aged (36-55 yrs)']) {
            setModalAuditionText(AGE_SAMPLE_TEXTS['Middle-Aged (36-55 yrs)']);
          }
        } else if (value.includes('56+')) {
          if (next.pitch === 'High' || next.pitch === 'Very High (Childlike)') {
            next.pitch = 'Medium';
          }
          next.useCase = 'Storytelling';
          if (AGE_SAMPLE_TEXTS['Senior / Elder (56+ yrs)']) {
            setModalAuditionText(AGE_SAMPLE_TEXTS['Senior / Elder (56+ yrs)']);
          }
        }
      }
      const generated = generateVoicePrompt(next);
      setModalPrompt(generated);
      return next;
    });
    if (modalAudioUrl) {
      URL.revokeObjectURL(modalAudioUrl);
      setModalAudioUrl(null);
      setModalAudioBase64(null);
      setModalAudioDuration(0);
      setModalAudioPlaying(false);
    }
  }, [modalAudioUrl]);

  const handleModalAudition = useCallback(async () => {
    const script = modalAuditionText.trim();
    if (!script) {
      showToast('Please enter an audition sentence.', 'error');
      return;
    }

    try {
      setModalAuditioning(true);
      if (modalAudioRef.current) {
        modalAudioRef.current.pause();
      }
      setModalAudioPlaying(false);

      const res = await fetch('/api/voice/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview: true,
          text: script.slice(0, 240),
          voicePrompt: modalPrompt.trim(),
          language: modalConfig.language,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate audition preview.');
      if (!data.audioBase64) throw new Error('No audio returned from server.');

      const bytes = base64ToBytes(data.audioBase64);
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const dur = await getAudioDuration(blob).catch(() => 4);

      setModalAudioBase64(data.audioBase64);
      setModalAudioUrl(url);
      setModalAudioDuration(dur);
      setModalAudioCurrentTime(0);

      setTimeout(() => {
        if (modalAudioRef.current) {
          modalAudioRef.current.currentTime = 0;
          modalAudioRef.current.play().then(() => setModalAudioPlaying(true)).catch(() => {});
        }
      }, 150);

      showToast('Audition sample ready! Listen below.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Audition failed.', 'error');
    } finally {
      setModalAuditioning(false);
    }
  }, [modalAuditionText, modalPrompt, modalConfig]);

  const toggleModalAudioPlay = useCallback(() => {
    const el = modalAudioRef.current;
    if (!el) return;
    if (modalAudioPlaying) {
      el.pause();
      setModalAudioPlaying(false);
    } else {
      el.play().then(() => setModalAudioPlaying(true)).catch(() => {});
    }
  }, [modalAudioPlaying]);

  const handleModalSaveVoice = useCallback(async () => {
    if (modalSaving) return;
    if (!modalVoiceName.trim()) {
      showToast('Please provide a name for your custom voice.', 'error');
      return;
    }

    if (!modalAudioBase64) {
      showToast('Please audition the voice first to hear it and generate its timbre anchor.', 'error');
      return;
    }

    try {
      setModalSaving(true);
      const res = await fetch('/api/voice/custom-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modalVoiceName.trim(),
          audioBase64: modalAudioBase64,
          voicePrompt: modalPrompt.trim(),
          language: modalConfig.language,
          gender: modalConfig.gender,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save voice.');

      showToast(`🎉 Custom voice "${data.voice.name}" saved! Locked timbre active.`, 'success');
      setCustomVoices((prev) => [data.voice, ...prev]);
      setSelectedCustomVoice(data.voice);
      setDesignModalOpen(false);

      if (modalAudioUrl) {
        URL.revokeObjectURL(modalAudioUrl);
        setModalAudioUrl(null);
      }
      setModalAudioBase64(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save custom voice.', 'error');
    } finally {
      setModalSaving(false);
    }
  }, [modalSaving, modalVoiceName, modalAudioBase64, modalPrompt, modalConfig, modalAudioUrl]);

  const handleModalEnhancePrompt = useCallback(async () => {
    if (modalEnhancingPrompt) return;
    setModalEnhancingPrompt(true);
    try {
      const res = await fetch('/api/voice/design-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enhance-prompt',
          prompt: modalPrompt,
          attributes: {
            gender: modalConfig.gender !== 'All genders' ? modalConfig.gender : undefined,
            ageGroup: modalConfig.ageGroup !== 'All ages' ? modalConfig.ageGroup : undefined,
            tone: modalConfig.style !== 'All styles' ? modalConfig.style : undefined,
            role: modalConfig.useCase !== 'All use cases' ? modalConfig.useCase : undefined,
            accent: modalConfig.language !== 'All languages' ? modalConfig.language : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enhancement failed');
      const enhanced = data.enhancedPrompt || data.voicePrompt;
      if (enhanced) {
        setModalPrompt(enhanced);
        showToast('Voice instructions calibrated with AI.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Enhancement failed', 'error');
    } finally {
      setModalEnhancingPrompt(false);
    }
  }, [modalEnhancingPrompt, modalPrompt, modalConfig]);

  const handleDeleteVoice = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved voice?')) return;

    try {
      const res = await fetch(`/api/voice/custom-voices?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete voice.');

      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      if (selectedCustomVoice?.id === id) {
        setSelectedCustomVoice(null);
      }
      showToast('Custom voice deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete voice.', 'error');
    }
  }, [selectedCustomVoice]);

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
      previewAudioRef.current.play().catch(() => {});
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

  // Audio Playback Helpers
  const toggleResultPlay = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setResultPlaying(true);
    } else {
      audioRef.current.pause();
      setResultPlaying(false);
    }
  }, []);

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
      audioRef.current.play().catch(() => {});
      setResultPlaying(true);
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
            onClick={() => setSidebarTab('saved')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              sidebarTab === 'saved'
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                : 'bg-[#131620] border-[#222736] text-slate-300 hover:text-white hover:border-[#2e3547]'
            }`}
            title="View your saved custom voices"
          >
            <Bookmark size={13} className="text-blue-400" />
            <span>My Voices</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {customVoices.length}
            </span>
          </button>

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

            {/* Output Stage: Enhanced Native Audio Player & Power Control Suite */}
            {phase === 'done' && resultUrl && (
              <div className="rounded-2xl border border-emerald-500/30 bg-[#0c1218]/90 backdrop-blur-md p-5 shadow-2xl space-y-4">
                {/* Header bar: Info & Download */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white tracking-wide">
                          Synthesized Voice Output
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          WAV · Lossless
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {resultChars.toLocaleString()} characters · {formatDuration(resultDurationSec)} duration
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSaveModal()}
                      className="px-3 py-1.5 rounded-lg bg-[#141b24] hover:bg-[#1c2734] border border-[#233345] text-emerald-300 hover:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Save this exact speaker voice to your library"
                    >
                      <Bookmark size={13} className="text-emerald-400" />
                      <span>Save Voice</span>
                    </button>

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
                    onPlay={() => setResultPlaying(true)}
                    onPause={() => setResultPlaying(false)}
                    onEnded={() => setResultPlaying(false)}
                  />
                </div>

                {/* Customizable Control Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#18232c]/80 text-xs text-slate-300">
                  {/* Quick Seek, Restart, and Loop Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="px-2.5 py-1 rounded-md bg-[#131b22] hover:bg-[#1a252f] border border-[#202d39] text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
                      title="Restart from beginning"
                    >
                      <RotateCcw size={12} />
                      <span>Restart</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSkip(-10)}
                      className="px-2.5 py-1 rounded-md bg-[#131b22] hover:bg-[#1a252f] border border-[#202d39] text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
                      title="Jump backward 10s"
                    >
                      <Rewind size={12} />
                      <span>-10s</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSkip(10)}
                      className="px-2.5 py-1 rounded-md bg-[#131b22] hover:bg-[#1a252f] border border-[#202d39] text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
                      title="Jump forward 10s"
                    >
                      <FastForward size={12} />
                      <span>+10s</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleLoop}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                        isLooping
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#131b22] hover:bg-[#1a252f] border-[#202d39] text-slate-400 hover:text-slate-200'
                      }`}
                      title="Toggle Repeat"
                    >
                      <Repeat size={12} />
                      <span>Loop</span>
                    </button>
                  </div>

                  {/* Playback Speed Quick Pills */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Speed:</span>
                    {[0.8, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => handleSpeedChange(spd)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                          playbackRate === spd
                            ? 'bg-emerald-500 text-black font-semibold'
                            : 'bg-[#131b22] hover:bg-[#1a252f] text-slate-400 hover:text-slate-200 border border-[#202d39]'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
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
              className={`pb-2.5 pt-3 transition-colors relative ${sidebarTab === 'controls' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Voice Designer
              {sidebarTab === 'controls' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => {
                setSidebarTab('saved');
                setOpenDropdown(null);
              }}
              className={`pb-2.5 pt-3 transition-colors relative flex items-center gap-1.5 ${sidebarTab === 'saved' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span>My Voices</span>
              {customVoices.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  {customVoices.length}
                </span>
              )}
              {sidebarTab === 'saved' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => {
                setSidebarTab('settings');
                setOpenDropdown(null);
              }}
              className={`pb-2.5 pt-3 transition-colors relative ${sidebarTab === 'settings' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Parameters
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

                  {/* Age Bracket Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'ageGroup' ? null : 'ageGroup')}
                      className={`h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${openDropdown === 'ageGroup'
                        ? 'bg-[#222736] border-blue-500 text-white'
                        : voiceConfig.ageGroup !== 'All ages'
                          ? 'bg-[#181d28] border-blue-500/40 text-blue-200'
                          : 'bg-[#161822] hover:bg-[#1f2230] border-[#262c3e] text-slate-300'
                        }`}
                    >
                      <span className="truncate max-w-[105px]">
                        {voiceConfig.ageGroup !== 'All ages' ? voiceConfig.ageGroup : 'Age Group'}
                      </span>
                      <ChevronDown size={11} className="text-slate-400 flex-shrink-0" />
                    </button>
                    {openDropdown === 'ageGroup' && (
                      <div className="absolute top-full left-0 mt-1 w-44 max-h-56 overflow-y-auto rounded-xl bg-[#13151f] border border-[#272e40] shadow-2xl p-1 z-30 space-y-0.5">
                        {AGE_GROUP_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleConfigChange('ageGroup', opt)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${voiceConfig.ageGroup === opt
                              ? 'bg-[#1f273b] text-white font-medium'
                              : 'text-slate-300 hover:text-white hover:bg-[#191d2a]'
                              }`}
                          >
                            <span>{opt}</span>
                            {voiceConfig.ageGroup === opt && <Check size={11} className="text-blue-400" />}
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

            {sidebarTab === 'saved' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bookmark size={13} className="text-emerald-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                      Saved Voice Profiles ({customVoices.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('controls')}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <Plus size={11} /> Design New
                  </button>
                </div>

                {loadingCustomVoices ? (
                  <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-blue-400" />
                    Loading your voice library...
                  </div>
                ) : customVoices.length === 0 ? (
                  <div className="p-6 rounded-xl border border-[#1d222e] bg-[#10131a] text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                      <Bookmark size={18} />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-white">No Saved Voices Yet</h5>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Design a voice in Voice Designer, generate a preview, and click &quot;Save Voice&quot; to lock its speaker timbre forever.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('controls')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                    >
                      Open Voice Designer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customVoices.map((voice) => {
                      const isSelected = selectedCustomVoice?.id === voice.id;
                      const isPlayingThis = auditionPlayingId === voice.id;
                      return (
                        <div
                          key={voice.id}
                          onClick={() => setSelectedCustomVoice(isSelected ? null : voice)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isSelected
                              ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-950/30 ring-1 ring-blue-500/30'
                              : 'bg-[#10131b] hover:bg-[#141822] border-[#1d2331]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => handleToggleAudition(voice, e)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                                  isPlayingThis
                                    ? 'bg-emerald-500 text-black shadow-md'
                                    : 'bg-[#1a202c] hover:bg-blue-500 text-slate-300 hover:text-black border border-[#2d3748]'
                                }`}
                                title={isPlayingThis ? 'Pause sample' : 'Listen to 5s voice sample'}
                              >
                                {isPlayingThis ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
                              </button>

                              <div>
                                <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                                  {voice.name}
                                  {isSelected && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                      Active
                                    </span>
                                  )}
                                </h5>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                  <span>{voice.language || 'English'}</span>
                                  <span>·</span>
                                  <span className="capitalize">{voice.gender || 'neutral'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleDeleteVoice(voice.id, e)}
                                className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                title="Delete saved voice"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {voice.voice_prompt && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 bg-[#090b10] p-2 rounded-lg border border-[#181c26] font-mono">
                              {voice.voice_prompt}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-[#1a1f2b] text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Lock size={10} /> Timbre Locked
                            </span>
                            <span className="text-blue-400 font-medium hover:underline">
                              {isSelected ? 'Click to deselect' : 'Use this voice →'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
      {/* ─── Voice Design Studio Modal ─── */}
      {designModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="max-w-2xl w-full bg-[#0d1017] border border-[#232b3d] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1b2230] bg-[#11141e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                  <Sparkles size={18} className="text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">Voice Design Studio</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Locked Timbre
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Design a signature acoustic persona, audition live, and lock permanent speaker timbre.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDesignModalOpen(false);
                  if (modalAudioUrl) {
                    URL.revokeObjectURL(modalAudioUrl);
                    setModalAudioUrl(null);
                  }
                  setModalAudioBase64(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1a202c] transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
              {/* 1. Voice Name */}
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                  Voice Profile Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalVoiceName}
                  onChange={(e) => setModalVoiceName(e.target.value)}
                  placeholder="e.g. Liam - Cinematic Tech Narrator"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#131620] border border-[#23293a] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* 2. Persona Controls Grid */}
              <div className="p-4 rounded-xl bg-[#10131c] border border-[#1d2331] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Acoustic Persona Attributes
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Configures MiMo acoustic conditioning
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Language</label>
                    <select
                      value={modalConfig.language}
                      onChange={(e) => handleModalConfigChange('language', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#161a24] border border-[#23293a] text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Gender</label>
                    <select
                      value={modalConfig.gender}
                      onChange={(e) => handleModalConfigChange('gender', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#161a24] border border-[#23293a] text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {GENDER_OPTIONS.filter((o) => o !== 'All genders').map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Age Bracket (Life Stage)</label>
                    <select
                      value={modalConfig.ageGroup}
                      onChange={(e) => handleModalConfigChange('ageGroup', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#161a24] border border-[#23293a] text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {AGE_GROUP_OPTIONS.filter((o) => o !== 'All ages').map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Pitch</label>
                    <select
                      value={modalConfig.pitch}
                      onChange={(e) => handleModalConfigChange('pitch', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#161a24] border border-[#23293a] text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {PITCH_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Style / Emotion</label>
                    <select
                      value={modalConfig.style}
                      onChange={(e) => handleModalConfigChange('style', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#161a24] border border-[#23293a] text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {STYLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">Use Case</label>
                    <select
                      value={modalConfig.useCase}
                      onChange={(e) => handleModalConfigChange('useCase', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#161a24] border border-[#23293a] text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {USE_CASE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. System Acoustic Instructions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    System Instructions (Voice Description Prompt)
                  </label>
                  <button
                    type="button"
                    onClick={handleModalEnhancePrompt}
                    disabled={modalEnhancingPrompt}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 border border-blue-900/40 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {modalEnhancingPrompt ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Enhance Prompt
                  </button>
                </div>
                <textarea
                  value={modalPrompt}
                  onChange={(e) => setModalPrompt(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl bg-[#11141e] border border-[#202737] text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 leading-relaxed"
                  placeholder="e.g. Authoritative male voice, with low pitch, speaking in fluent English (US)..."
                />
              </div>

              {/* 4. Audition & Live Preview */}
              <div className="p-4 rounded-xl bg-[#0e1119] border border-[#1e2433] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      Live Voice Audition
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Free Preview
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Audition before saving to verify timbre
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                    Audition Script (Sample sentence to speak)
                  </label>
                  <input
                    type="text"
                    value={modalAuditionText}
                    onChange={(e) => setModalAuditionText(e.target.value)}
                    maxLength={240}
                    placeholder="e.g. In a world shaped by endless questions, one voice emerges to tell the story."
                    className="w-full px-3 py-2 rounded-lg bg-[#141822] border border-[#222938] text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Audition Trigger & Player Display */}
                <div className="pt-1">
                  {!modalAudioUrl ? (
                    <button
                      type="button"
                      onClick={handleModalAudition}
                      disabled={modalAuditioning || !modalAuditionText.trim()}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                    >
                      {modalAuditioning ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Generating Voice Audition Sample (~3s)…</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} className="fill-white" />
                          <span>Audition Voice Now</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#121622] border border-[#232c3f] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                      {/* Hidden Audio Element */}
                      <audio
                        ref={modalAudioRef}
                        src={modalAudioUrl}
                        onTimeUpdate={() => setModalAudioCurrentTime(modalAudioRef.current?.currentTime || 0)}
                        onEnded={() => {
                          setModalAudioPlaying(false);
                          setModalAudioCurrentTime(0);
                        }}
                      />

                      {/* Left: Play/Pause button + Scrubber & Waveform */}
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={toggleModalAudioPlay}
                          className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                          title={modalAudioPlaying ? 'Pause' : 'Play Audition'}
                        >
                          {modalAudioPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5 fill-black" />}
                        </button>

                        <div className="flex flex-col gap-1 min-w-[130px]">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                            <span>{formatDuration(modalAudioCurrentTime)}</span>
                            <span className="text-slate-500">/</span>
                            <span>{formatDuration(modalAudioDuration)}</span>
                          </div>

                          {/* Animated Waveform Visualizer */}
                          <div className="flex items-center gap-0.5 h-4">
                            {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.3, 0.6, 0.9, 0.7, 0.4].map((h, i) => (
                              <div
                                key={i}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  modalAudioPlaying ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                style={{
                                  height: modalAudioPlaying
                                    ? `${Math.max(20, Math.floor(h * 100 * ((i % 3) + 1) * 0.33))}%`
                                    : '30%',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Re-audition button */}
                      <button
                        type="button"
                        onClick={handleModalAudition}
                        disabled={modalAuditioning}
                        className="px-3 py-1.5 rounded-lg bg-[#181d2a] hover:bg-[#202738] border border-[#2b3548] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors self-end sm:self-center"
                      >
                        {modalAuditioning ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RotateCcw size={12} />
                        )}
                        <span>Re-Audition</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Timbre Anchor Guarantee */}
              <div className="p-3.5 rounded-xl bg-blue-950/25 border border-blue-900/40 text-[11px] text-blue-200/90 leading-relaxed flex items-start gap-2.5">
                <span className="p-1 rounded-md bg-blue-500/20 text-blue-400 mt-0.5">
                  <Lock size={12} />
                </span>
                <div>
                  <strong className="text-white">Deterministic Consistency:</strong> When you save, the system registers this ~5-second audio anchor. Every synthesis with this voice will reproduce this exact speaker identity and timbre.
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-6 py-4 border-t border-[#1c2230] bg-[#090b10] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {modalAudioBase64 ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Audition sample ready to lock
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                    Audition recommended before saving
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDesignModalOpen(false);
                    if (modalAudioUrl) {
                      URL.revokeObjectURL(modalAudioUrl);
                      setModalAudioUrl(null);
                    }
                    setModalAudioBase64(null);
                  }}
                  disabled={modalSaving}
                  className="px-4 py-2 rounded-xl bg-[#141822] hover:bg-[#1c2230] text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleModalSaveVoice}
                  disabled={modalSaving || !modalVoiceName.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                    modalAudioBase64
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title={!modalAudioBase64 ? 'Audition the voice first to generate sample' : 'Save and lock voice timbre'}
                >
                  {modalSaving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Locking Timbre & Saving…</span>
                    </>
                  ) : (
                    <>
                      <Bookmark size={13} />
                      <span>Save & Lock Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
