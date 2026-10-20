/**
 * Script v1 (docs/create-plan.md §4): the schema and the deterministic checks shared by the
 * AI writer, the API and the editor. Durations and the research checklist are computed, not stored.
 */
import { z } from 'zod';
import { numbersIn, toAsciiDigits } from '../discover/numbers';
import type { VideoBrief } from './brief';
import type { StructureBeat } from './structures';

export const CLAIM_KINDS = ['evidence', 'needs_research', 'creative'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

/** Script lengths the AI writes, in minutes. Longer scripts are written section by section. */
export const AI_MIN_MINUTES = 2;
export const AI_MAX_MINUTES = 15;

export const claimSchema = z.object({ text: z.string().trim().min(1).max(300), kind: z.enum(CLAIM_KINDS) });
export type Claim = z.infer<typeof claimSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1).max(40),
  heading: z.string().trim().min(1).max(80),
  /** What the beat should do (copied from the brief's structure when the script was written). */
  purpose: z.string().trim().max(160),
  /** Spoken words only. */
  narration: z.string().max(8000),
  claims: z.array(claimSchema).max(12),
  /** The AI couldn't write a usable version of this part; the user writes it. */
  needsWriting: z.boolean(),
});
export type ScriptSection = z.infer<typeof sectionSchema>;

export const scriptSchema = z.object({
  version: z.literal(1),
  language: z.enum(['English', 'Bangla']),
  targetMinutes: z.number().int().min(1).max(60),
  sections: z.array(sectionSchema).min(1).max(16),
  /** The brief this script was written from; a newer brief means the script needs review. */
  briefUpdatedAt: z.string(),
  source: z.enum(['ai', 'manual']),
  updatedAt: z.string(),
});
export type VideoScript = z.infer<typeof scriptSchema>;

// ─── Length ──────────────────────────────────────────────────────────────────

/** Typical narration pace, words per minute. Bangla words are longer, so fewer per minute. */
const WORDS_PER_MINUTE: Record<VideoScript['language'], number> = { English: 150, Bangla: 115 };

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export const estimateSeconds = (text: string, language: VideoScript['language']) => Math.round((wordCount(text) / WORDS_PER_MINUTE[language]) * 60);

/** Opening and closing parts are short; the rest share the time equally. */
const weightOf = (beatId: string) => (beatId === 'hook' || beatId === 'cta' ? 0.5 : 1);

/** Words each part should have for the target length. */
export function targetWords(sections: { id: string }[], targetMinutes: number, language: VideoScript['language']): Map<string, number> {
  const total = targetMinutes * WORDS_PER_MINUTE[language];
  const weights = sections.map((s) => weightOf(baseId(s.id)));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return new Map(sections.map((s, i) => [s.id, Math.max(20, Math.round((total * weights[i]) / sum))]));
}

/** A part far longer than its share is flagged (the user may still keep it). */
export const wordCap = (target: number) => Math.max(80, Math.round(target * 2));

/** Section ids are the beat id, made unique with a suffix when a beat repeats. */
const baseId = (id: string) => id.replace(/~\d+$/, '');

export function sectionIds(structure: StructureBeat[]): string[] {
  const seen = new Map<string, number>();
  return structure.map((b) => {
    const n = seen.get(b.id) ?? 0;
    seen.set(b.id, n + 1);
    return n ? `${b.id}~${n}`.slice(0, 40) : b.id;
  });
}

// ─── Checks ──────────────────────────────────────────────────────────────────

/** Filler and hype a script shouldn't contain. One list, used by the writer and the editor. */
export const SCRIPT_BANNED =
  /\b(in today['’]?s video|smash (that|the) like|don['’]?t forget to (like|subscribe)|make sure (to|you) (like|subscribe)|hit (that|the) bell|without further ado|let['’]?s dive (right )?in|hey guys|viral|guaranteed?|blow up|algorithm secret)\b|আজকের ভিডিওতে|সাবস্ক্রাইব করতে ভুলবেন না|লাইক দিতে ভুলবেন না|ভাইরাল|গ্যারান্টি/i;

export const sentencesOf = (text: string) => text.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);

/** Numbers the script may state as fact: those in the brief or the creator's notes. */
export function allowedNumbers(brief: VideoBrief, notes = ''): Set<string> {
  const facts = [
    brief.topic,
    brief.angle,
    brief.audience,
    brief.problem ?? '',
    brief.corePromise,
    ...brief.keyPoints,
    ...brief.keyQuestions,
    ...brief.supportingEvidence.map((e) => e.statement),
    notes,
  ];
  return new Set(numbersIn(facts.join(' ')));
}

/**
 * True when a sentence states a number we can't back: a percentage, a decimal or a number
 * above 12 that isn't in the brief. Small counts ("3 reasons", "step 2") are fine.
 */
export function hasUnbackedNumber(sentence: string, allowed: Set<string>): boolean {
  const ascii = toAsciiDigits(sentence);
  const matches = Array.from(ascii.matchAll(/\d+(?:[.,]\d+)?\s*(%|percent|শতাংশ)?/gi));
  return matches.some((m) => {
    const [n] = numbersIn(m[0]);
    if (n === undefined || allowed.has(n)) return false;
    const isCount = Number.isInteger(Number(n)) && Number(n) <= 12 && !m[1];
    return !isCount;
  });
}

/** The brief's statements a script may present as evidence. */
export function briefFacts(brief: VideoBrief, notes = ''): string[] {
  return [brief.topic, brief.corePromise, brief.angle, brief.problem ?? '', ...brief.keyPoints, ...brief.keyQuestions, ...brief.supportingEvidence.map((e) => e.statement), notes].filter(Boolean);
}

/** Meaningful words, lower-cased (short function words are skipped; works for Bangla too). */
const contentWords = (text: string) =>
  text
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 || (/[\u0980-\u09FF]/.test(w) && w.length >= 3));

/**
 * True when most of a claim's meaningful words appear in the brief. Words match on their first
 * five letters, so "animals" matches "animal" and Bangla suffixes don't break the match.
 */
export function isGrounded(claim: string, facts: string[]): boolean {
  const words = contentWords(claim);
  if (words.length === 0) return false;
  const stems = new Set(contentWords(facts.join(' ')).map((w) => w.slice(0, 5)));
  const hits = words.filter((w) => stems.has(w.slice(0, 5))).length;
  return hits / words.length >= 0.5;
}

/**
 * Claims are kept honest without blocking the writer: an "evidence" claim the brief doesn't
 * back (unknown number, or not in the brief at all) becomes "needs research", and any
 * narration sentence with an unbacked number is added to the checklist if no claim covers it.
 */
export function reconcileClaims(narration: string, claims: Claim[], allowed: Set<string>, facts: string[] = []): Claim[] {
  const out = claims.map((c) =>
    c.kind === 'evidence' && (hasUnbackedNumber(c.text, allowed) || !isGrounded(c.text, facts)) ? { ...c, kind: 'needs_research' as const } : c
  );
  for (const sentence of sentencesOf(narration)) {
    if (!hasUnbackedNumber(sentence, allowed)) continue;
    const covered = out.some((c) => c.kind === 'needs_research' && (sentence.includes(c.text) || c.text.includes(sentence) || overlap(c.text, sentence) > 0.6));
    if (!covered) out.push({ text: sentence.slice(0, 300), kind: 'needs_research' });
  }
  return out.slice(0, 12);
}

/** Anything that isn't a letter, digit or space (any script; Bangla vowel signs are marks, so they count). */
const NON_WORD = new RegExp('[^\\p{L}\\p{M}\\p{N}\\s]', 'gu');

const shingles = (text: string, n = 4): Set<string> => {
  const words = text.toLowerCase().replace(NON_WORD, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
};

/** Share of `a`'s 3-word phrases that also appear in `b`. */
function overlap(a: string, b: string): number {
  const sa = shingles(a, 3);
  if (sa.size === 0) return 0;
  const sb = shingles(b, 3);
  let hits = 0;
  sa.forEach((s) => sb.has(s) && hits++);
  return hits / sa.size;
}

/** Ids of parts that largely repeat another part. */
export function repeatedSections(sections: Pick<ScriptSection, 'id' | 'narration'>[]): Set<string> {
  const sets = sections.map((s) => shingles(s.narration));
  const out = new Set<string>();
  sections.forEach((s, i) => {
    if (sets[i].size < 10) return;
    const others = new Set<string>();
    sets.forEach((set, j) => j !== i && set.forEach((x) => others.add(x)));
    let hits = 0;
    sets[i].forEach((x) => others.has(x) && hits++);
    if (hits / sets[i].size > 0.35) out.add(s.id);
  });
  return out;
}

export type SectionIssue = 'empty' | 'too_short' | 'too_long' | 'filler' | 'repeats';

/** Problems with each part, for the writer's retry and for the editor's warnings. */
export function sectionIssues(script: Pick<VideoScript, 'sections' | 'targetMinutes' | 'language'>): Map<string, SectionIssue[]> {
  const targets = targetWords(script.sections, script.targetMinutes, script.language);
  const repeats = repeatedSections(script.sections);
  return new Map(
    script.sections.map((s) => {
      const issues: SectionIssue[] = [];
      const words = wordCount(s.narration);
      const target = targets.get(s.id) ?? 100;
      if (!s.narration.trim()) issues.push('empty');
      else if (words < target * 0.6) issues.push('too_short');
      if (words > wordCap(target)) issues.push('too_long');
      if (SCRIPT_BANNED.test(s.narration)) issues.push('filler');
      if (repeats.has(s.id)) issues.push('repeats');
      return [s.id, issues];
    })
  );
}

export const ISSUE_TEXT: Record<SectionIssue, string> = {
  empty: 'This part is empty.',
  too_short: 'Much shorter than its share of the target length.',
  too_long: 'Much longer than its share of the target length.',
  filler: 'Contains filler or hype (e.g. “in today’s video”, “viral”).',
  repeats: 'Largely repeats another part.',
};

/** Removes sentences with filler or hype; used when a retry still contains them. */
export const withoutFiller = (narration: string) =>
  sentencesOf(narration)
    .filter((s) => !SCRIPT_BANNED.test(s))
    .join(' ');

/** Everything the creator must check before recording. */
export const researchChecklist = (script: Pick<VideoScript, 'sections'>) =>
  script.sections.flatMap((s) => s.claims.filter((c) => c.kind === 'needs_research').map((c) => ({ sectionId: s.id, heading: s.heading, text: c.text })));

/** A script is out of date when the brief was saved after it was written. */
export const isStale = (script: VideoScript, brief: VideoBrief) => brief.updatedAt > script.briefUpdatedAt;

// ─── Building ────────────────────────────────────────────────────────────────

/** Empty parts from the brief's structure, for writing by hand. */
export function emptyScript(brief: VideoBrief, targetMinutes: number, now = new Date()): VideoScript {
  const ids = sectionIds(brief.structure);
  return {
    version: 1,
    language: brief.language,
    targetMinutes,
    sections: brief.structure.map((b, i) => ({ id: ids[i], heading: b.label, purpose: b.purpose, narration: '', claims: [], needsWriting: false })),
    briefUpdatedAt: brief.updatedAt,
    source: 'manual',
    updatedAt: now.toISOString(),
  };
}

/** A sensible default length per format, in minutes. */
export function defaultMinutes(format: VideoBrief['format']): number {
  if (format === 'news' || format === 'reaction') return 5;
  if (format === 'documentary' || format === 'case_study' || format === 'experiment') return 12;
  if (format === 'tutorial' || format === 'comparison' || format === 'review') return 10;
  return 8;
}

/** Plain text for copying or downloading: headings, narration, then what to check. */
export function scriptToText(script: VideoScript, title: string): string {
  const checklist = researchChecklist(script);
  const parts = [
    title,
    '',
    ...script.sections.flatMap((s) => [`## ${s.heading}`, s.narration.trim() || '(not written yet)', '']),
  ];
  if (checklist.length) parts.push('## Check before recording', ...checklist.map((c) => `- [ ] ${c.text}`));
  return parts.join('\n').trim() + '\n';
}

/** Rewriting one part costs half a full script, rounded up (the admin sets the full price). */
export const sectionCost = (scriptCost: number) => Math.ceil(scriptCost / 2);
