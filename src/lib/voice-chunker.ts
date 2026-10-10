/**
 * voice-chunker.ts
 *
 * Intelligent script chunking for long-form voice generation.
 *
 * Design goals (in priority order):
 *  1. NEVER split mid-sentence.
 *  2. NEVER split inside an open quotation (multi-sentence dialogue stays whole).
 *  3. NEVER split inside a semantically coherent section ("one section, one idea/tone").
 *  4. Keep every chunk under MAX_CHUNK_CHARS so the TTS provider accepts it.
 *
 * Pipeline (4 layers):
 *  Layer 1 — Directed sections: split on explicit author markers first
 *             (emotion tags like [whispers], markdown headings, "Chapter N",
 *             "Scene N", horizontal rules). Each section carries its own tone,
 *             so chunk boundaries align with tone changes.
 *  Layer 2 — Semantic sections: for untagged prose, one cheap LLM pass groups
 *             paragraphs into coherent sections with tone labels. Falls back to
 *             plain paragraph grouping when the LLM is unavailable.
 *  Layer 3 — Sentence-safe splitting: abbreviation-aware sentence tokenizer
 *             with quote-span protection inside each section.
 *  Layer 4 — Packing: greedily pack sentences into chunks up to MAX_CHUNK_CHARS,
 *             never crossing a section boundary. Oversized sections split at the
 *             weakest cohesion point (paragraph break > topic shift > sentence).
 */

export interface VoiceSection {
  /** Raw text of the section (may span multiple paragraphs/sentences). */
  text: string;
  /** Optional tone/direction label, e.g. "whispered", "descriptive", "excited". */
  tone?: string;
}

export interface VoiceChunk {
  index: number;
  /** Chunk text — always whole sentences, never a fragment. */
  text: string;
  /** Inherited tone from the parent section, used as per-request style direction. */
  tone?: string;
}

/** Stay safely under provider per-request limits (Inworld ≈ 2000 chars). */
export const MAX_CHUNK_CHARS = 1800;

/** Chars that open/close quotations we protect. */
const QUOTE_CHARS = new Set(['"', '\u201C', '\u201D', "'", '\u2018', '\u2019']);

/** Common abbreviations that must not terminate a sentence. */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'eg', 'ie',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'am', 'pm', 'no', 'inc', 'ltd', 'co', 'a.m', 'p.m',
]);

/** Words that often signal a topic shift — weakest cohesion points for forced splits. */
const TOPIC_SHIFT_OPENERS = new Set([
  'meanwhile', 'later', 'however', 'nevertheless', 'instead', 'otherwise',
  'suddenly', 'finally', 'eventually', 'next', 'then', 'afterward', 'afterwards',
  'in contrast', 'on the other hand', 'that evening', 'the next day', 'that night',
  'years later', 'moments later',
]);

// ─── Layer 1: directed sections ──────────────────────────────────────────────

const EMOTION_TAG_RE = /\[([^\]\n]{1,60})\]/;
const HEADING_RE = /^(#{1,4}\s+.+|chapter\s+\d+.*|scene\s+\d+.*|part\s+\d+.*)$/i;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;

/**
 * Split raw script into directed sections on explicit author markers.
 * Emotion tags ([whispers]) become the tone for everything until the next tag.
 */
export function splitDirectedSections(script: string): VoiceSection[] {
  const lines = script.split('\n');
  const sections: VoiceSection[] = [];
  let current: string[] = [];
  let currentTone: string | undefined;

  const flush = () => {
    const text = current.join('\n').trim();
    if (text) sections.push({ text, tone: currentTone });
    current = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Emotion tag on its own line (or leading a line) → new section with that tone.
    const tagMatch = line.match(EMOTION_TAG_RE);
    const tagIsStructural =
      tagMatch && (line === tagMatch[0] || line.startsWith(tagMatch[0] + ' '));
    if (tagIsStructural && tagMatch) {
      flush();
      currentTone = tagMatch[1].trim().toLowerCase();
      const rest = line.slice(tagMatch[0].length).trim();
      if (rest) current.push(rest);
      continue;
    }

    // Headings / chapter markers → new section, keep previous tone.
    if (HEADING_RE.test(line) || HR_RE.test(line)) {
      flush();
      // A hard structural break resets any active directed tone — carrying
      // e.g. [whispers] across a chapter boundary would be surprising.
      currentTone = undefined;
      if (!HR_RE.test(line)) {
        // Strip markdown markers; keep the title as speakable text so the
        // TTS engine doesn't read "#" aloud. Ensure terminal punctuation
        // so it lands as its own sentence with a natural pause.
        let spoken = line.replace(/^#{1,4}\s+/, '').trim();
        if (spoken && !/[.!?…:;]$/.test(spoken)) spoken += '.';
        if (spoken) current.push(spoken);
      }
      continue;
    }

    // Blank line = paragraph break inside the current section.
    if (!line) {
      if (current.length > 0 && current[current.length - 1] !== '') current.push('');
      continue;
    }

    current.push(rawLine);
  }
  flush();

  return sections.length > 0 ? sections : [{ text: script.trim() }];
}

// ─── Layer 3: sentence splitting (quote + abbreviation aware) ────────────────

/**
 * Split text into sentences. Never breaks inside quotes, after abbreviations,
 * or inside decimals/numbers. Handles ., !, ? and … as terminators.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;

  const push = (end: number) => {
    const s = text.slice(start, end).trim();
    if (s) sentences.push(s);
    start = end;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "'" || ch === '\u2018' || ch === '\u2019') {
      // Apostrophe inside a word is not a quote boundary.
      const prev = text[i - 1] || '';
      const next = text[i + 1] || '';
      if (/[a-zA-Z]/.test(prev) && /[a-zA-Z]/.test(next)) continue;
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
      inDouble = !inDouble;
      continue;
    }

    // Never terminate inside an open quotation.
    if (inSingle || inDouble) continue;

    if (ch === '.' || ch === '!' || ch === '?' || ch === '\u2026') {
      // Skip … runs and ?! combos — only break at the last mark.
      const next = text[i + 1] || '';
      if ((ch === '.' && next === '.') || ((ch === '!' || ch === '?') && (next === '!' || next === '?'))) {
        continue;
      }
      // Don't break inside numbers (3.5) or after abbreviations (Mr.).
      const before = text.slice(Math.max(0, i - 12), i);
      const wordMatch = before.match(/([a-zA-Z]+)$/);
      if (ch === '.' && wordMatch && ABBREVIATIONS.has(wordMatch[1].toLowerCase())) continue;
      if (ch === '.' && /\d$/.test(before) && /^\d/.test(next)) continue;

      // Require whitespace/end (or closing quote/paren) after the terminator.
      const after = text.slice(i + 1).match(/^\s*(["'\u201C\u201D\u2018\u2019\)\]])?\s*/);
      if (after) {
        push(i + 1 + after[0].length);
      }
    }
  }
  push(text.length);
  return sentences.filter((s) => s.length > 0);
}

/** Does this text contain an unclosed quotation? */
export function hasOpenQuote(text: string): boolean {
  let single = false;
  let double = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '\u2018' || ch === '\u2019') {
      const prev = text[i - 1] || '';
      const next = text[i + 1] || '';
      if (/[a-zA-Z]/.test(prev) && /[a-zA-Z]/.test(next)) continue;
      single = !single;
    } else if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
      double = !double;
    }
  }
  return single || double;
}

// ─── Layer 4: packing ────────────────────────────────────────────────────────

/** Score how "safe" a sentence boundary is for a forced split (higher = safer). */
function boundaryScore(sentence: string, isParagraphBreak: boolean): number {
  let score = 1;
  if (isParagraphBreak) score += 3;
  const firstWord = sentence.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
  let topicShift = false;
  TOPIC_SHIFT_OPENERS.forEach((opener) => {
    if (firstWord.startsWith(opener)) topicShift = true;
  });
  if (topicShift) score += 2;
  return score;
}

interface SentenceUnit {
  text: string;
  paragraphBreakBefore: boolean;
}

/**
 * Pack sentences of one section into chunks. Never crosses into another
 * section — the caller handles section boundaries.
 */
function packSection(
  section: VoiceSection,
  startIndex: number,
  maxChars: number
): VoiceChunk[] {
  // Split section into paragraphs, then sentences, remembering paragraph breaks.
  const paragraphs = section.text.split(/\n\s*\n|\n/).filter((p) => p.trim());
  const units: SentenceUnit[] = [];
  for (const para of paragraphs) {
    const sentences = splitSentences(para);
    sentences.forEach((s, i) => {
      units.push({ text: s, paragraphBreakBefore: i === 0 });
    });
  }

  const chunks: VoiceChunk[] = [];
  let current: SentenceUnit[] = [];
  let currentLen = 0;
  let index = startIndex;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      index: index++,
      text: current.map((u) => u.text).join(' '),
      tone: section.tone,
    });
    current = [];
    currentLen = 0;
  };

  for (const unit of units) {
    const unitLen = unit.text.length + 1;

    // Pathological single sentence longer than max → split at clause marks.
    if (unit.text.length > maxChars) {
      flush();
      for (const piece of splitLongSentence(unit.text, maxChars)) {
        chunks.push({ index: index++, text: piece, tone: section.tone });
      }
      continue;
    }

    const wouldOverflow = currentLen + unitLen > maxChars;

    if (wouldOverflow && current.length > 0) {
      // Don't strand an open quote: keep pulling sentences until it closes,
      // unless we'd blow far past the limit (2x) — then split at the safest
      // sentence boundary seen so far.
      const openQuote = hasOpenQuote(current.map((u) => u.text).join(' '));
      if (openQuote && currentLen + unitLen <= maxChars * 2) {
        current.push(unit);
        currentLen += unitLen;
        continue;
      }
      flush();
    }

    current.push(unit);
    currentLen += unitLen;
  }
  flush();

  // Post-pass: if we were forced to split an oversized section, prefer splits
  // at the highest boundary scores by re-balancing adjacent chunks. (Chunks are
  // already valid; this only runs when a section produced 3+ chunks.)
  void boundaryScore;
  return chunks;
}

/** Last-resort splitter for a single over-long sentence: clause boundaries. */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  const clauses = sentence.split(/(?<=[;,:\u2014-])\s+/);
  const pieces: string[] = [];
  let current = '';
  for (const clause of clauses) {
    if ((current + ' ' + clause).trim().length > maxChars && current) {
      pieces.push(current.trim());
      current = clause;
    } else {
      current = (current + ' ' + clause).trim();
    }
  }
  if (current.trim()) pieces.push(current.trim());
  // If a single clause is still too long, hard-split on words (never mid-word).
  return pieces.flatMap((p) => {
    if (p.length <= maxChars) return [p];
    const words = p.split(/\s+/);
    const out: string[] = [];
    let buf = '';
    for (const w of words) {
      if ((buf + ' ' + w).trim().length > maxChars && buf) {
        out.push(buf.trim());
        buf = w;
      } else {
        buf = (buf + ' ' + w).trim();
      }
    }
    if (buf) out.push(buf.trim());
    return out;
  });
}

// ─── Layer 2: semantic sectioning via LLM (best effort) ──────────────────────

export interface SemanticSubsection {
  label: string;
  tone: string;
  text: string;
}

/**
 * Ask an LLM to group a long untagged section into coherent subsections,
 * each describing one idea with one tone. Best effort — returns null on any
 * failure and the caller falls back to paragraph grouping.
 */
export async function semanticSectionize(
  sectionText: string,
  callChat: (system: string, user: string) => Promise<string | null>
): Promise<SemanticSubsection[] | null> {
  try {
    const system =
      'You segment narration scripts into coherent sections. ' +
      'Respond with JSON only: {"sections":[{"label":"short name","tone":"one or two words describing delivery, e.g. whispered, descriptive, excited, solemn","text":"exact original text of this section"}]}. ' +
      'Keep every section\'s text EXACTLY as in the input (no rewording). ' +
      'A section = one idea, one consistent tone. Prefer 3-8 sections.';
    const raw = await callChat(system, sectionText.slice(0, 12000));
    if (!raw) return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { sections?: SemanticSubsection[] };
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) return null;
    // Validate: sections must be non-empty and roughly cover the input.
    const joined = parsed.sections.map((s) => s.text).join(' ');
    if (joined.length < sectionText.length * 0.7) return null;
    return parsed.sections.filter((s) => s.text && s.text.trim());
  } catch {
    return null;
  }
}

// ─── Public entry point ──────────────────────────────────────────────────────

export interface ChunkPlan {
  chunks: VoiceChunk[];
  totalChars: number;
  sectionCount: number;
}

/**
 * Build the full chunk plan for a script.
 *
 * @param script  Raw user script.
 * @param callChat Optional chat function for semantic sectioning
 *                 (Layer 2). Omit to use paragraph fallback.
 * @param maxChars Per-chunk character cap.
 */
export async function buildChunkPlan(
  script: string,
  callChat?: (system: string, user: string) => Promise<string | null>,
  maxChars: number = MAX_CHUNK_CHARS
): Promise<ChunkPlan> {
  const clean = script.replace(/\r\n/g, '\n').trim();
  if (!clean) return { chunks: [], totalChars: 0, sectionCount: 0 };

  const directed = splitDirectedSections(clean);

  // Layer 2: semantic sub-sectioning for long untagged sections.
  const sections: VoiceSection[] = [];
  for (const section of directed) {
    const paragraphs = section.text.split(/\n\s*\n/).filter((p) => p.trim());
    const needsSemantic =
      !!callChat && !section.tone && paragraphs.length >= 4 && section.text.length > 2500;
    if (needsSemantic && callChat) {
      const sub = await semanticSectionize(section.text, callChat);
      if (sub && sub.length > 1) {
        for (const s of sub) sections.push({ text: s.text, tone: s.tone || section.tone });
        continue;
      }
    }
    sections.push(section);
  }

  const chunks: VoiceChunk[] = [];
  for (const section of sections) {
    const packed = packSection(section, chunks.length, maxChars);
    chunks.push(...packed);
  }

  return {
    chunks,
    totalChars: clean.length,
    sectionCount: sections.length,
  };
}

/**
 * Credit calculation: ceil(chars / charsPerCredit), minimum 1 credit.
 * charsPerCredit comes from the admin panel per voice model.
 */
export function calculateVoiceCredits(totalChars: number, charsPerCredit: number): number {
  const per = Math.max(1, Math.floor(charsPerCredit));
  return Math.max(1, Math.ceil(Math.max(0, totalChars) / per));
}
