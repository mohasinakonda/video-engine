/**
 * Voice delivery styles & use-case presets for Chatterbox TTS.
 *
 * A cloned voice keeps the speaker's TIMBRE (identity) from the reference
 * audio; these presets control DELIVERY (pacing, emotion, variation) per
 * generation via Chatterbox-native params:
 *  - exaggeration (0-1): emotion/expression intensity
 *  - cfg_weight: pacing — lower (~0.3) = slower, more deliberate delivery
 *  - temperature: sampling variation between generations
 *
 * Tuning follows Resemble AI's guidance: higher exaggeration speeds speech
 * up; lowering cfg compensates with slower, more deliberate pacing.
 */

export interface VoiceStylePreset {
  id: string;
  label: string;
  /** Short UI hint shown under the dropdown. */
  hint: string;
  /** 0-1, maps to Chatterbox exaggeration. */
  exaggeration: number;
  /** Chatterbox cfg_weight. */
  cfgWeight: number;
  /** Chatterbox temperature. */
  temperature: number;
}

export const VOICE_STYLES: VoiceStylePreset[] = [
  { id: 'calm', label: 'Calm', hint: 'Slow, relaxed, even delivery', exaggeration: 0.25, cfgWeight: 0.4, temperature: 0.6 },
  { id: 'authoritative', label: 'Authoritative', hint: 'Commanding, assured, newsreader-like', exaggeration: 0.4, cfgWeight: 0.65, temperature: 0.5 },
  { id: 'informative', label: 'Informative', hint: 'Clear, neutral, easy to follow', exaggeration: 0.35, cfgWeight: 0.6, temperature: 0.5 },
  { id: 'friendly', label: 'Friendly', hint: 'Warm, conversational, approachable', exaggeration: 0.55, cfgWeight: 0.5, temperature: 0.8 },
  { id: 'confident', label: 'Confident', hint: 'Assured, polished, presentational', exaggeration: 0.5, cfgWeight: 0.6, temperature: 0.7 },
  { id: 'empathetic', label: 'Empathetic', hint: 'Warm, caring, story-driven', exaggeration: 0.45, cfgWeight: 0.45, temperature: 0.7 },
  { id: 'soothing', label: 'Soothing', hint: 'Soft, gentle, sleep-story calm', exaggeration: 0.2, cfgWeight: 0.35, temperature: 0.6 },
  { id: 'intimate', label: 'Intimate', hint: 'Close, whispery — ASMR style', exaggeration: 0.2, cfgWeight: 0.3, temperature: 0.6 },
  { id: 'energetic', label: 'Energetic', hint: 'Upbeat, punchy, high energy', exaggeration: 0.8, cfgWeight: 0.3, temperature: 0.9 },
  { id: 'dramatic', label: 'Dramatic', hint: 'Theatrical, intense, trailer-like', exaggeration: 0.85, cfgWeight: 0.3, temperature: 0.9 },
];

export interface VoiceUseCase {
  id: string;
  label: string;
  /** Style auto-selected when this use case is picked. */
  styleId: string;
}

export const VOICE_USE_CASES: VoiceUseCase[] = [
  { id: 'documentary', label: 'Documentary', styleId: 'calm' },
  { id: 'storyteller', label: 'Storyteller', styleId: 'empathetic' },
  { id: 'podcast', label: 'Podcast', styleId: 'friendly' },
  { id: 'commercial', label: 'Commercial', styleId: 'energetic' },
  { id: 'asmr', label: 'ASMR', styleId: 'intimate' },
  { id: 'tutor', label: 'Tutor', styleId: 'informative' },
  { id: 'news', label: 'News', styleId: 'authoritative' },
  { id: 'meditation', label: 'Meditation', styleId: 'soothing' },
];

export function getVoiceStyle(id: string | null | undefined): VoiceStylePreset | null {
  if (!id) return null;
  return VOICE_STYLES.find((s) => s.id === id) ?? null;
}

export function getUseCase(id: string | null | undefined): VoiceUseCase | null {
  if (!id) return null;
  return VOICE_USE_CASES.find((u) => u.id === id) ?? null;
}

/**
 * Params sent with a chunk request when the user has customized delivery.
 * All fields optional — when the whole object is null the request is
 * byte-identical to the pre-style behaviour.
 */
export interface StyleParams {
  /** 0-100, maps to Chatterbox exaggeration. */
  expressiveness: number;
  cfgWeight: number;
  temperature: number;
}

export function styleToParams(style: VoiceStylePreset): StyleParams {
  return {
    expressiveness: Math.round(style.exaggeration * 100),
    cfgWeight: style.cfgWeight,
    temperature: style.temperature,
  };
}
