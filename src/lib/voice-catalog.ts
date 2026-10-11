/**
 * voice-catalog.ts
 *
 * Curated voice presets for the /voice page, built for Chatterbox-style
 * zero-shot engines on DeepInfra.
 *
 * Chatterbox generates from a default voice (reference-audio cloning is a
 * future step); presets therefore bundle a language + delivery style. Each
 * preset maps to concrete synthesis params: language_id and a default
 * exaggeration level (0-1). Selecting a preset sets the page's language and
 * expressiveness controls, which the user can then fine-tune.
 */

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  /** Filter tags, e.g. "narration", "conversational", "character". */
  tags: string[];
  /** Display language name. */
  language: string;
  /** Chatterbox language_id code. */
  languageId: string;
  /** Optional gender persona. */
  gender?: 'male' | 'female' | 'neutral';
  /** Default exaggeration (0-1). Higher = more emotional/dramatic. */
  exaggeration: number;
  sampleAudioUrl?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export const VOICE_FILTERS = [
  'all',
  'narration',
  'conversational',
  'character',
  'advertising',
] as const;

export type VoiceFilter = (typeof VOICE_FILTERS)[number];

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'narrator-en',
    name: 'Narrator',
    description: 'Balanced, clear English voice for stories and explainers.',
    tags: ['narration', 'conversational'],
    language: 'English',
    languageId: 'en',
    exaggeration: 0.5,
  },
  {
    id: 'documentary-en',
    name: 'Documentary',
    description: 'Steady, authoritative delivery for long-form narration.',
    tags: ['narration'],
    language: 'English',
    languageId: 'en',
    exaggeration: 0.35,
  },
  {
    id: 'storyteller-en',
    name: 'Storyteller',
    description: 'Warm and expressive — fairy tales, drama, character pieces.',
    tags: ['narration', 'character'],
    language: 'English',
    languageId: 'en',
    exaggeration: 0.75,
  },
  {
    id: 'host-en',
    name: 'Podcast Host',
    description: 'Friendly, conversational energy for talk-style content.',
    tags: ['conversational'],
    language: 'English',
    languageId: 'en',
    exaggeration: 0.6,
  },
  {
    id: 'promo-en',
    name: 'Promo',
    description: 'Bright, punchy delivery for ads and announcements.',
    tags: ['advertising'],
    language: 'English',
    languageId: 'en',
    exaggeration: 0.7,
  },
  {
    id: 'villain-en',
    name: 'Dramatic',
    description: 'Intense, theatrical voice for trailers and villains.',
    tags: ['character', 'advertising'],
    language: 'English',
    languageId: 'en',
    exaggeration: 0.85,
  },
  {
    id: 'narrator-hi',
    name: 'Narrator (Hindi)',
    description: 'Clear Hindi narration with natural cadence.',
    tags: ['narration'],
    language: 'Hindi',
    languageId: 'hi',
    exaggeration: 0.5,
  },
  {
    id: 'narrator-es',
    name: 'Narrator (Spanish)',
    description: 'Natural Spanish voice for narration and explainers.',
    tags: ['narration', 'conversational'],
    language: 'Spanish',
    languageId: 'es',
    exaggeration: 0.5,
  },
  {
    id: 'narrator-fr',
    name: 'Narrator (French)',
    description: 'Smooth French delivery for stories and guides.',
    tags: ['narration'],
    language: 'French',
    languageId: 'fr',
    exaggeration: 0.5,
  },
  {
    id: 'narrator-ar',
    name: 'Narrator (Arabic)',
    description: 'Clear Arabic narration voice.',
    tags: ['narration'],
    language: 'Arabic',
    languageId: 'ar',
    exaggeration: 0.5,
  },
];

/** Languages supported by Chatterbox Multilingual (code + display name). */
export const VOICE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'da', name: 'Danish' },
  { code: 'el', name: 'Greek' },
  { code: 'fi', name: 'Finnish' },
  { code: 'he', name: 'Hebrew' },
  { code: 'ms', name: 'Malay' },
  { code: 'no', name: 'Norwegian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
];

/**
 * Paralinguistic / direction tags the user can insert into their script.
 * Chatterbox natively performs these inline tags.
 */
export const EMOTION_TAGS = [
  'whisper',
  'laugh',
  'sigh',
  'gasp',
  'chuckle',
  'excited',
  'serious',
  'dramatic',
  'calm',
  'sad',
];

/**
 * MiMo-V2.5-TTS Audio Tags for fine-grained style & emotional control.
 * Can be placed at the start of text (Style tags) or inline (Action tags).
 */
export const MIMO_STYLE_TAGS = [
  '(Magnetic)',
  '(Whisper)',
  '(Sighing)',
  '(singing)',
  '(Lazy)',
  '(Cold)',
  '(Lively)',
  '(Serious)',
  '(Relieved)',
  '(Sweet)',
  '(Deep)',
];

export const MIMO_INLINE_TAGS = [
  '(takes a deep breath)',
  '(sighs deeply)',
  '(speaking faster)',
  '(forced smile)',
  '(softly)',
  '[pause]',
  '[chuckle]',
  '[cough]',
  '[sigh]',
];

export interface VoiceDesignTemplate {
  id: string;
  title: string;
  category: 'character' | 'narration' | 'commercial' | 'cinematic' | 'asmr';
  gender: 'male' | 'female' | 'neutral';
  description: string;
  sampleScript: string;
  tags: string[];
}

export const VOICE_DESIGN_PRESETS: VoiceDesignTemplate[] = [
  {
    id: 'russian-gruff-male',
    title: 'Russian Gruff Male',
    category: 'character',
    gender: 'male',
    description: 'Heavy Russian accent, gruff middle-aged male, blunt and matter-of-fact.',
    sampleScript: 'Yes, I had a sandwich. And tomorrow, we finish the job on time.',
    tags: ['character', 'accent', 'gruff'],
  },
  {
    id: 'asmr-binaural-whisper',
    title: 'Binaural ASMR Whisper',
    category: 'asmr',
    gender: 'female',
    description: 'Young female, extreme close-up with a binaural, ear-to-ear ASMR feel. Audible breathing, subtle swallowing, and soft natural lip sounds. She speaks very slowly, creating a deeply relaxing and immersive experience.',
    sampleScript: '(whispers, takes a deep breath) Close your eyes... breathe out slowly... you are completely safe here.',
    tags: ['asmr', 'whisper', 'relaxing'],
  },
  {
    id: 'wisdom-storyteller-elder',
    title: 'Weathered Storyteller Elder',
    category: 'narration',
    gender: 'male',
    description: 'An elderly gentleman, speaking slowly and steadily, his voice slightly hoarse and weathered, as if an old and seasoned grandfather were telling a story, full of the wisdom of years.',
    sampleScript: '(sighs softly) Many winters have come and gone since I stood on that hill... yet some memories never fade.',
    tags: ['storytelling', 'elderly', 'warm'],
  },
  {
    id: 'noir-detective-1940s',
    title: '1940s Noir Detective',
    category: 'cinematic',
    gender: 'male',
    description: 'Cynical mid-40s male detective from 1940s film noir, low gravelly pitch, relaxed vocal tract, deliberate pauses, speaking as if under dim neon streetlights in the rain.',
    sampleScript: '(Cold, lighting a cigarette) The city never sleeps... (sighs) and neither do the mistakes people leave behind in the dark.',
    tags: ['cinematic', 'noir', 'cynical'],
  },
  {
    id: 'epic-blockbuster-trailer',
    title: 'Epic Blockbuster Trailer',
    category: 'cinematic',
    gender: 'male',
    description: 'Deep and imposing masculine trailer narrator, rich chest resonance, commanding authority, deliberate dramatic pacing with profound weight in every syllable.',
    sampleScript: 'In a world divided by shadow and steel... one hero must rise before the dawn is lost forever.',
    tags: ['cinematic', 'epic', 'trailer'],
  },
  {
    id: 'warm-tech-explainer',
    title: 'Modern Tech Explainer',
    category: 'commercial',
    gender: 'female',
    description: 'Friendly young woman in her late 20s, bright, energetic and articulate, confident modern conversational tone with an engaging cadence.',
    sampleScript: '(cheerful) Imagine building your entire production pipeline in minutes instead of weeks. Let me show you how it works.',
    tags: ['commercial', 'tech', 'upbeat'],
  },
  {
    id: 'late-night-radio-dj',
    title: 'Midnight Radio DJ',
    category: 'narration',
    gender: 'male',
    description: 'Magnetic, mellow and velvety smooth late-night radio DJ, intimate cadence, relaxed delivery, warm resonance that wraps around the listener.',
    sampleScript: '(Magnetic) The night is already deep, but the city is still breathing. I am right here with you on Midnight Radio.',
    tags: ['radio', 'magnetic', 'smooth'],
  },
  {
    id: 'director-century-noble',
    title: 'Director Mode: Noble Heir',
    category: 'cinematic',
    gender: 'female',
    description: 'Role: Head of a century-old noble dynasty, molded into an emotionless family totem.\nScene: In the ancestral shadows, extinguishing an elopement attempt.\nGuidance: Cold, languid yet imposing deep voice. Extremely slow pacing, chilling pauses, heavy full voice with subtle breathy final sounds.',
    sampleScript: '(Cold, slow pauses) You crossed a thousand miles to come here... (sighs coldly) only to realize you are standing outside gates that will never open.',
    tags: ['director-mode', 'drama', 'cinematic'],
  },
  {
    id: 'playful-prankster-teen',
    title: 'Playful Teenager',
    category: 'character',
    gender: 'male',
    description: 'Bright and lively teenage voice, carrying pride and playfulness after a successful prank, speaking at a relatively fast pace with light enunciation and rising tone.',
    sampleScript: '(laughing, speaking faster) Did you see the look on his face? I told you it would work! You owe me five bucks!',
    tags: ['character', 'playful', 'fast'],
  },
  {
    id: 'exhausted-overtime-worker',
    title: 'Exhausted Night Owl',
    category: 'character',
    gender: 'neutral',
    description: 'Exhausted worker in their 30s, speaking in a low, tired murmur with long pauses, heavy sighs, and sluggish articulation.',
    sampleScript: '(extremely exhausted, listless) Wake me up when we get there... (sighs deeply) I will take a little nap first.',
    tags: ['tired', 'relatable', 'weary'],
  },
];
