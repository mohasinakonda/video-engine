/**
 * inworld-voices.ts
 *
 * Curated starter set of Inworld TTS voices for the /voice page.
 * Inworld ships 130+ preset voices; this list covers the most useful
 * archetypes for narration and can be extended freely — each entry is just
 * { id, name, description, tags, language } and the id is passed straight
 * through to the synthesis API.
 *
 * NOTE: voice ids below follow Inworld's public naming. If a voice id stops
 * resolving, remove/replace the entry — the page degrades gracefully.
 */

export interface InworldVoice {
  id: string;
  name: string;
  description: string;
  /** Filter tags, e.g. "narration", "conversational", "character". */
  tags: string[];
  language: string;
  gender: 'masculine' | 'feminine' | 'neutral';
}

export const VOICE_FILTERS = [
  'all',
  'narration',
  'conversational',
  'character',
  'advertising',
] as const;

export type VoiceFilter = (typeof VOICE_FILTERS)[number];

export const INWORLD_VOICES: InworldVoice[] = [
  {
    id: 'Sarah',
    name: 'Sarah',
    description: 'Warm, clear female narrator. Great for stories and explainers.',
    tags: ['narration', 'conversational'],
    language: 'English',
    gender: 'feminine',
  },
  {
    id: 'Dennis',
    name: 'Dennis',
    description: 'Deep, steady male voice. Documentaries and long-form narration.',
    tags: ['narration'],
    language: 'English',
    gender: 'masculine',
  },
  {
    id: 'Alex',
    name: 'Alex',
    description: 'Friendly neutral voice for tutorials and product videos.',
    tags: ['conversational', 'advertising'],
    language: 'English',
    gender: 'neutral',
  },
  {
    id: 'Maya',
    name: 'Maya',
    description: 'Expressive young female voice, great for character dialogue.',
    tags: ['character', 'conversational'],
    language: 'English',
    gender: 'feminine',
  },
  {
    id: 'Marcus',
    name: 'Marcus',
    description: 'Authoritative male voice for ads and announcements.',
    tags: ['advertising', 'narration'],
    language: 'English',
    gender: 'masculine',
  },
  {
    id: 'Priya',
    name: 'Priya',
    description: 'Warm South-Asian English narrator, natural Bangla-adjacent cadence.',
    tags: ['narration', 'conversational'],
    language: 'English',
    gender: 'feminine',
  },
  {
    id: 'Ravi',
    name: 'Ravi',
    description: 'Calm male narrator suited to educational content.',
    tags: ['narration'],
    language: 'English',
    gender: 'masculine',
  },
  {
    id: 'Lena',
    name: 'Lena',
    description: 'Bright, energetic female voice for promos and social clips.',
    tags: ['advertising', 'character'],
    language: 'English',
    gender: 'feminine',
  },
  {
    id: 'Omar',
    name: 'Omar',
    description: 'Smooth mid-range male voice, good for conversational pieces.',
    tags: ['conversational'],
    language: 'English',
    gender: 'masculine',
  },
  {
    id: 'Yuki',
    name: 'Yuki',
    description: 'Gentle female voice for calm narration and bedtime stories.',
    tags: ['narration', 'character'],
    language: 'English',
    gender: 'feminine',
  },
  {
    id: 'Diego',
    name: 'Diego',
    description: 'Rich, dramatic male voice for trailers and storytelling.',
    tags: ['character', 'advertising'],
    language: 'English',
    gender: 'masculine',
  },
  {
    id: 'Aisha',
    name: 'Aisha',
    description: 'Clear, confident female voice for news-style delivery.',
    tags: ['narration', 'advertising'],
    language: 'English',
    gender: 'feminine',
  },
];

/** Languages supported by Inworld TTS 1.5 (subset exposed in the UI). */
export const INWORLD_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Russian',
  'Turkish',
  'Hindi',
  'Bengali',
  'Japanese',
  'Korean',
  'Chinese',
];

/** Emotion/direction tags the user can insert into their script. */
export const EMOTION_TAGS = [
  'whispers',
  'excited',
  'calm',
  'serious',
  'cheerful',
  'sad',
  'angry',
  'sarcastic',
  'narrating',
  'dramatic pause',
];
