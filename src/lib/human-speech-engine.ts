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
  options?: { isMimo?: boolean; isContinuation?: boolean }
): string {
  if (!rawText) return rawText;
  const text = rawText.trim();
  if (!text) return text;

  // If text already contains explicit breath or action tags, respect user input
  if (
    /\((?:takes a breath|breathes|sighs|soft inhale|inhale|exhale)\)/i.test(text) ||
    /\[(?:takes a breath|breathes|sighs|gasp)\]/i.test(text)
  ) {
    return text;
  }

  // 1. Initial breath: ONLY for the very first chunk.
  // Continuation chunks (chunkIndex > 0) are in the middle of ongoing speech
  // and must enter seamlessly without an abrupt inspiratory loudness spike.
  let result = options?.isContinuation ? text : `(takes a breath) ${text}`;

  // 2. Paragraph transitions: New paragraphs represent new thoughts
  result = result.replace(/(\n\s*\n\s*)([A-Za-z0-9"'])/g, (_match, breaks, nextChar) => {
    return `${breaks}(takes a breath) ${nextChar}`;
  });

  // 3. Sentence boundary respiratory cadence
  // Matches punctuation (. ! ?) followed by whitespace and an uppercase letter or quote
  result = result.replace(/([.!?])(\s+)([A-Z0-9"'])/g, (match, punct, spaces, nextChar, offset) => {
    // Check preceding 15 characters to avoid breaking on abbreviations (Dr., Mr., etc.)
    const preWindow = result.slice(Math.max(0, offset - 15), offset + 1);
    if (COMMON_ABBREVIATIONS.test(preWindow.trim())) {
      return match;
    }

    // Check if it's already an ellipsis
    const isEllipsis = offset >= 2 && result.slice(offset - 2, offset + 1) === '...';

    if (punct === '.' || isEllipsis) {
      // Natural trailing pause with subtle breath
      return `... (breathes) ${nextChar}`;
    }

    // Exclamations and questions retain their punctuation
    return `${punct} (breathes) ${nextChar}`;
  });

  return result;
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
  const humanizedPrompt = isMimo
    ? injectHumanAcoustics(params.voicePrompt)
    : params.voicePrompt;

  return {
    text: humanizedText,
    voicePrompt: humanizedPrompt,
  };
}
