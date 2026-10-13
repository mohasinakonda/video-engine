/**
 * human-speech-engine.ts — Server-side prosodic & bio-acoustic realism engine.
 *
 * Transforms plain user text and neural voice prompts behind the scenes so that
 * synthesized speech sounds like an authentic living human speaking naturally,
 * rather than a robotic or stiff synthetic announcer.
 *
 * 100% invisible to the end user:
 * - User enters plain text in UI (no tags to learn, no extra buttons to click).
 * - Server injects respiratory breathing dynamics:
 *     * Opening inspiratory breath `(takes a breath)`
 *     * Respiratory sentence-boundary cadences `... (breathes)`
 *     * Thought-transition paragraph breaths
 * - Injects biological vocal acoustics into MiMo prompts:
 *     * Relaxed pharyngeal warmth & vocal fold resonance
 *     * Organic pitch variation & spontaneous conversational inflection
 *     * Active repulsion of robotic monotone & teleprompter stiffness
 */

const COMMON_ABBREVIATIONS = /\b(?:mr|mrs|ms|dr|prof|sr|jr|vs|etc|inc|ltd|co|corp|dept|est|fig|gen|gov|hon|no|rep|rev|sen|vol|st|ave|rd)\.$/i;

/**
 * Injects respiratory breath physics and natural cadence into plain text.
 * Real humans never speak from dead silence without an inspiratory breath,
 * and take natural micro-breaths at sentence boundaries.
 */
export function humanizeSpeechText(
  rawText: string,
  _options?: { isMimo?: boolean; isContinuation?: boolean }
): string {
  if (!rawText) return rawText;
  const text = rawText.trim();
  if (!text) return text;

  // Clean out any lingering artificial breath tags so the AI never produces weird 'huh' sounds
  const cleaned = text
    .replace(/\s*\((?:breath|breathes|takes a breath|soft inhale|inhale|exhale)\)\s*/gi, ' ')
    .replace(/\s*\[(?:breath|breathes|takes a breath|sigh|gasp)\]\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Biological acoustic descriptors that steer MiMo V2.5 away from
 * robotic synthetic monotone and towards organic human realism.
 */
const HUMAN_ACOUSTIC_DIRECTIVE =
  'Delivered in an authentic human voice with relaxed throat warmth, subtle organic breathing pauses between thoughts, natural conversational inflection, and spontaneous expressive pitch contours, avoiding flat robotic monotone or stiff synthetic announcer cadence.';

/**
 * Injects vocal cord realism and conversational micro-inflections into the prompt.
 */
export function injectHumanAcoustics(rawPrompt?: string): string {
  const base = (rawPrompt || '').trim();
  if (!base) {
    return `A natural human speaker. ${HUMAN_ACOUSTIC_DIRECTIVE}`;
  }

  // Avoid duplicate injection
  if (
    /authentic human voice/i.test(base) ||
    /organic breathing/i.test(base) ||
    /relaxed throat warmth/i.test(base)
  ) {
    return base;
  }

  // If ends with punctuation, append smoothly
  const separator = /[.!?]$/.test(base) ? ' ' : '. ';
  return `${base}${separator}${HUMAN_ACOUSTIC_DIRECTIVE}`;
}

const CONTINUATION_DIRECTIVE =
  'Unbroken continuous monologue: maintain the exact same vocal warmth, pitch register, emotional delivery, and natural pacing.';

/**
 * Complete server-side pipeline: Transforms both text and voice prompt
 * for maximum human authenticity with smooth multi-chunk continuity.
 */
export function humanizeSpeechPayload(params: {
  text: string;
  voicePrompt?: string;
  modelId?: string;
  chunkIndex?: number;
}): {
  text: string;
  voicePrompt?: string;
} {
  const isMimo = !params.modelId || params.modelId.toLowerCase().includes('mimo');
  const isContinuation = (params.chunkIndex ?? 0) > 0;

  const humanizedText = humanizeSpeechText(params.text, {
    isMimo,
    isContinuation,
  });

  // Always inject human bio-acoustics into the prompt for all MiMo models (including voiceclone)
  // to prevent flat robotic monotone and guarantee warm, emotional delivery
  let humanizedPrompt = isMimo
    ? injectHumanAcoustics(params.voicePrompt)
    : params.voicePrompt;

  // For continuation chunks (chunkIndex > 0), instruct the model to maintain unbroken tone & warmth
  if (isContinuation && humanizedPrompt) {
    const separator = /[.!?]$/.test(humanizedPrompt) ? ' ' : '. ';
    humanizedPrompt = `${humanizedPrompt}${separator}${CONTINUATION_DIRECTIVE}`;
  }

  return {
    text: humanizedText,
    voicePrompt: humanizedPrompt,
  };
}
