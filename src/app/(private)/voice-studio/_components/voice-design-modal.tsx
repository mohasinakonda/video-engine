import { getAudioDuration } from "@/lib/media-storage";
import { showToast } from "@/lib/toast";
import { Bookmark, Loader2, Lock, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";

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
type Phase = 'idle' | 'planning' | 'generating' | 'done' | 'error';

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

function formatDuration(sec: number): string {
    if (!sec || sec <= 0) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
    const clean = b64.replace(/^data:audio\/[^;]+;base64,/, '').trim();
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}
type Props = {
    setDesignModalOpen: Dispatch<SetStateAction<boolean>>
    setSelectedCustomVoice: Dispatch<SetStateAction<CustomVoice | null>>
    setCustomVoices: Dispatch<SetStateAction<CustomVoice[]>>
}

export const VoiceDesignModal = ({ setDesignModalOpen, setSelectedCustomVoice, setCustomVoices }: Props) => {

    const [modalVoiceName, setModalVoiceName] = useState('');
    const [modalAudioBase64, setModalAudioBase64] = useState<string | null>(null);
    const [modalAudioUrl, setModalAudioUrl] = useState<string | null>(null);
    const [modalConfig, setModalConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
    const [modalAuditionText, setModalAuditionText] = useState(
        'In a world shaped by endless questions, one voice emerges to tell the story.'
    );
    const [modalPrompt, setModalPrompt] = useState(generateVoicePrompt(DEFAULT_VOICE_CONFIG));

    const [modalAudioDuration, setModalAudioDuration] = useState<number>(0);
    const [modalAudioCurrentTime, setModalAudioCurrentTime] = useState<number>(0);
    const [modalAudioPlaying, setModalAudioPlaying] = useState(false);
    const [modalSaving, setModalSaving] = useState(false);
    const [modalEnhancingPrompt, setModalEnhancingPrompt] = useState(false);
    const modalAudioRef = useRef<HTMLAudioElement | null>(null);
    const [modalAuditioning, setModalAuditioning] = useState(false);

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

    const toggleModalAudioPlay = useCallback(() => {
        const el = modalAudioRef.current;
        if (!el) return;
        if (modalAudioPlaying) {
            el.pause();
            setModalAudioPlaying(false);
        } else {
            el.play().then(() => setModalAudioPlaying(true)).catch(() => { });
        }
    }, [modalAudioPlaying]);


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
                    modalAudioRef.current.play().then(() => setModalAudioPlaying(true)).catch(() => { });
                }
            }, 150);

            showToast('Audition sample ready! Listen below.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Audition failed.', 'error');
        } finally {
            setModalAuditioning(false);
        }
    }, [modalAuditionText, modalPrompt, modalConfig]);


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
    return (

        <div className="modal-overlay">
            <div className="modal-panel max-w-2xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-bg-border bg-bg-surface flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white shadow-sm">
                            <Sparkles size={18} className="text-zinc-200" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-white">Voice Design Studio</h3>
                                <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    Locked Timbre
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400">
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
                        className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Scrollable Content */}
                <div className="overflow-y-auto p-6 space-y-5 text-xs text-zinc-300">
                    {/* 1. Voice Name */}
                    <div>
                        <label className="text-xs font-semibold text-zinc-200 block mb-1.5">
                            Voice Profile Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={modalVoiceName}
                            onChange={(e) => setModalVoiceName(e.target.value)}
                            placeholder="e.g. Liam - Cinematic Tech Narrator"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-bg-surface border border-bg-border text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* 2. Persona Controls Grid */}
                    <div className="p-4 rounded-xl bg-bg-elevated border border-bg-border space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                                Acoustic Persona Attributes
                            </span>
                            <span className="text-xxs text-zinc-500">
                                Configures MiMo acoustic conditioning
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xxs text-zinc-400 block mb-1 font-medium">Language</label>
                                <select
                                    value={modalConfig.language}
                                    onChange={(e) => handleModalConfigChange('language', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-bg-border text-xs text-white focus:outline-none focus:border-zinc-600"
                                >
                                    {LANGUAGE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xxs text-zinc-400 block mb-1 font-medium">Gender</label>
                                <select
                                    value={modalConfig.gender}
                                    onChange={(e) => handleModalConfigChange('gender', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-bg-border text-xs text-white focus:outline-none focus:border-zinc-600"
                                >
                                    {GENDER_OPTIONS.filter((o) => o !== 'All genders').map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xxs text-zinc-400 block mb-1 font-medium">Age Bracket (Life Stage)</label>
                                <select
                                    value={modalConfig.ageGroup}
                                    onChange={(e) => handleModalConfigChange('ageGroup', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-bg-border text-xs text-white focus:outline-none focus:border-zinc-600"
                                >
                                    {AGE_GROUP_OPTIONS.filter((o) => o !== 'All ages').map((a) => (
                                        <option key={a} value={a}>
                                            {a}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xxs text-zinc-400 block mb-1 font-medium">Pitch</label>
                                <select
                                    value={modalConfig.pitch}
                                    onChange={(e) => handleModalConfigChange('pitch', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-bg-border text-xs text-white focus:outline-none focus:border-zinc-600"
                                >
                                    {PITCH_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xxs text-zinc-400 block mb-1 font-medium">Style / Emotion</label>
                                <select
                                    value={modalConfig.style}
                                    onChange={(e) => handleModalConfigChange('style', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-bg-border text-xs text-white focus:outline-none focus:border-zinc-600"
                                >
                                    {STYLE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xxs text-zinc-400 block mb-1 font-medium">Use Case</label>
                                <select
                                    value={modalConfig.useCase}
                                    onChange={(e) => handleModalConfigChange('useCase', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg-surface border border-bg-border text-xs text-white focus:outline-none focus:border-zinc-600"
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
                            <label className="text-xs font-semibold text-zinc-200">
                                System Instructions (Voice Description Prompt)
                            </label>
                            <button
                                type="button"
                                onClick={handleModalEnhancePrompt}
                                disabled={modalEnhancingPrompt}
                                className="px-2.5 py-1 rounded-md text-xxs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                                {modalEnhancingPrompt ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                Enhance Prompt
                            </button>
                        </div>
                        <textarea
                            value={modalPrompt}
                            onChange={(e) => setModalPrompt(e.target.value)}
                            rows={2}
                            className="w-full p-3 rounded-xl bg-bg-surface border border-bg-border text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-600 leading-relaxed"
                            placeholder="e.g. Authoritative male voice, with low pitch, speaking in fluent English (US)..."
                        />
                    </div>

                    {/* 4. Audition & Live Preview */}
                    <div className="p-4 rounded-xl bg-bg-elevated border border-bg-border space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                                    Live Voice Audition
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-2xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    Free Preview
                                </span>
                            </div>
                            <span className="text-xxs text-zinc-500">
                                Audition before saving to verify timbre
                            </span>
                        </div>

                        <div>
                            <label className="text-xxs text-zinc-400 block mb-1 font-medium">
                                Audition Script (Sample sentence to speak)
                            </label>
                            <input
                                type="text"
                                value={modalAuditionText}
                                onChange={(e) => setModalAuditionText(e.target.value)}
                                maxLength={240}
                                placeholder="e.g. In a world shaped by endless questions, one voice emerges to tell the story."
                                className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-bg-border text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                            />
                        </div>

                        {/* Audition Trigger & Player Display */}
                        <div className="pt-1">
                            {!modalAudioUrl ? (
                                <button
                                    type="button"
                                    onClick={handleModalAudition}
                                    disabled={modalAuditioning || !modalAuditionText.trim()}
                                    className="btn-primary w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                                >
                                    {modalAuditioning ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Generating Voice Audition Sample (~3s)…</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play size={14} className="fill-current" />
                                            <span>Audition Voice Now</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="p-3.5 rounded-xl bg-bg-surface border border-bg-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
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
                                            className="w-10 h-10 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 flex items-center justify-center flex-shrink-0 shadow-md active:scale-95 transition-all"
                                            title={modalAudioPlaying ? 'Pause' : 'Play Audition'}
                                        >
                                            {modalAudioPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5 fill-zinc-950" />}
                                        </button>

                                        <div className="flex flex-col gap-1 min-w-[130px]">
                                            <div className="flex items-center justify-between text-xxs font-mono text-zinc-300">
                                                <span>{formatDuration(modalAudioCurrentTime)}</span>
                                                <span className="text-zinc-500">/</span>
                                                <span>{formatDuration(modalAudioDuration)}</span>
                                            </div>

                                            {/* Animated Waveform Visualizer */}
                                            <div className="flex items-center gap-0.5 h-4">
                                                {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.3, 0.6, 0.9, 0.7, 0.4].map((h, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1 rounded-full transition-all duration-150 ${modalAudioPlaying ? 'bg-white' : 'bg-zinc-700'
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
                                        className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 self-end sm:self-center"
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
                    <div className="p-3.5 rounded-xl bg-bg-surface border border-bg-border text-xxs text-zinc-300 leading-relaxed flex items-start gap-2.5">
                        <span className="p-1 rounded-md bg-zinc-800 text-zinc-300 mt-0.5">
                            <Lock size={12} />
                        </span>
                        <div>
                            <strong className="text-white">Deterministic Consistency:</strong> When you save, the system registers this ~5-second audio anchor. Every synthesis with this voice will reproduce this exact speaker identity and timbre.
                        </div>
                    </div>
                </div>

                {/* Modal Sticky Footer */}
                <div className="px-6 py-4 border-t border-bg-border bg-bg-surface flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                        {modalAudioBase64 ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Audition sample ready to lock
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-zinc-500">
                                <span className="w-2 h-2 rounded-full bg-zinc-600" />
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
                            className="btn-secondary px-4 py-2 rounded-xl text-xs font-medium"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleModalSaveVoice}
                            disabled={modalSaving || !modalVoiceName.trim()}
                            className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
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
    )
}