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
  /** Default exaggeration (0-1). Higher = more emotional/dramatic. */
  exaggeration: number;
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
