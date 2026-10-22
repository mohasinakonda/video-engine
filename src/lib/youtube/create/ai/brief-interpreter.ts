/**
 * BriefInterpreter (docs/create-plan.md §3.2): fills the empty parts of a brief. It never
 * overwrites what the user or Discover already set, and its text is checked before use.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { BANNED, numbersIn } from '../../discover/ai/interpret';
import { FORMATS, FORMAT_LABELS, MECHANISMS } from '../../discover/formats';
import { INTENTS, type VideoBrief } from '../brief';
import { structureFor } from '../structures';

const line = (max: number) => z.string().trim().min(1).max(max);

/** Cuts an over-long answer at the last sentence or word that fits, instead of dropping it. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const sentence = t.slice(0, max).lastIndexOf('. ');
  if (sentence >= max * 0.5) return t.slice(0, sentence + 1);
  // Mid-sentence: end on a whole word and say it was shortened.
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max - 1).replace(/[,;:–-]\s*$/, '').trim()}…`;
}

/** A text field: clipped to fit; anything unusable becomes undefined so the other fields survive. */
const text = (max: number) =>
  z
    .string()
    .transform((s) => clip(s, max))
    .pipe(z.string().min(1))
    .optional()
    .catch(undefined);

/** Format ids, or their labels ("Tutorial"); anything else (e.g. "live_stream") is left unset. */
const formatField = z
  .string()
  .transform((s) => {
    const key = s.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return FORMATS.find((f) => f === key || FORMAT_LABELS[f].toLowerCase() === s.trim().toLowerCase()) ?? null;
  })
  .nullable()
  .optional()
  .catch(undefined);

const aiSchema = z.object({
  audience: text(240),
  problem: text(200).nullable().catch(undefined),
  intent: z.enum(INTENTS).optional().catch(undefined),
  format: formatField,
  angle: text(160),
  corePromise: text(240),
  keyPoints: z.array(z.unknown()).optional().catch(undefined),
  keyQuestions: z.array(z.unknown()).optional().catch(undefined),
  titleDirections: z.array(z.unknown()).optional().catch(undefined),
  thumbnailDirection: text(400),
});

const pointSchema = line(240);
const questionSchema = line(200);
const directionSchema = z.object({ mechanism: z.enum(MECHANISMS), direction: line(200) });

/**
 * Models sometimes answer a direction as a string ("How: 'How do…' (mechanism: how)").
 * Recover the mechanism from it rather than dropping a usable direction.
 */
export function normalizeDirection(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const tagged = raw.match(/\(mechanism:\s*([a-z_ ]+)\)/i);
  const mechanism = (tagged?.[1] ?? raw.split(':')[0]).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const direction = raw
    .replace(/\(mechanism:[^)]*\)/i, '')
    .replace(/^[^:]{1,25}:\s*/, '')
    .trim()
    .replace(/^['"“‘]|['"”’]$/g, '')
    .trim();
  return { mechanism, direction };
}

const SYSTEM = `You help a YouTube creator plan one video. Fill in the brief from what is given; keep it specific to this topic and audience.
- audience: who the video is for, concretely (not "everyone"), in one sentence of at most 30 words.
- angle: if none is set, an original angle for this video in at most 20 words: what makes it different from other videos on the topic.
- format: if none is set, exactly one of these ids: ${FORMATS.join(', ')}.
- corePromise: the one thing the viewer gets by watching to the end, in one sentence.
- keyPoints: 3–6 points the video must cover, each one short sentence.
- keyQuestions: 2–4 questions the viewer wants answered.
- titleDirections: 2–4 directions for the title, as objects {"mechanism": "<one of: ${MECHANISMS.join(', ')}>", "direction": "<the direction>"}. Directions, not finished titles.
- thumbnailDirection: what the thumbnail should show (subject, composition, contrast, any text), in two sentences.
- If answerOnly is given, fill only those fields.
Rules: don't invent facts, statistics or claims; no hype ("viral", "guaranteed", "hack").
Language: write every field in the language given as writeIn, even when the topic or angle is in another language.
Reply only with JSON using the field names above.`;

/** Numbers the AI may use: only those already in the user's or Discover's text. */
function allowedNumbers(brief: VideoBrief, notes: string): Set<string> {
  return new Set(numbersIn([brief.topic, brief.angle, brief.problem ?? '', notes].join(' ')));
}

const acceptable = (value: string, allowed: Set<string>) => !BANNED.test(value) && numbersIn(value).every((n) => allowed.has(n));

/**
 * Who it's for and the angle describe the plan, not facts: ages and small counts ("ages 2–5",
 * "3 everyday tricks") are fine there. Percentages and big numbers still look like statistics.
 */
const acceptablePlan = (value: string, allowed: Set<string>) =>
  !BANNED.test(value) && !/%|percent/i.test(value) && numbersIn(value).every((n) => allowed.has(n) || Number(n) <= 100);

/** Keeps the valid, safe items of a list; one bad item doesn't discard the rest. */
function keepValid<T>(items: unknown[] | undefined, schema: z.ZodType<T>, ok: (item: T) => boolean, max: number): T[] {
  return (items ?? [])
    .map((raw) => schema.safeParse(raw))
    .flatMap((r) => (r.success && ok(r.data) ? [r.data] : []))
    .slice(0, max);
}

/**
 * Returns the brief with empty fields filled. Null when no model produced a usable answer,
 * so the caller can refund and let the user write it themselves.
 */
/** The fields worth a second, focused call when the first answer leaves them empty. */
const PLAN_FIELDS = ['audience', 'angle', 'format', 'corePromise'] as const;

async function ask(brief: VideoBrief, notes: string, models: string[], only?: readonly string[]): Promise<z.infer<typeof aiSchema> | null> {
  const answer = await callLLM({
    tag: 'create:brief',
    models,
    json: true,
    temperature: 0.5,
    maxTokens: 2000,
    timeoutMs: 45_000,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          writeIn: brief.language,
          topic: brief.topic,
          angle: brief.angle || null,
          format: brief.format ? FORMAT_LABELS[brief.format] : null,
          audience: brief.audience || null,
          viewerProblem: brief.problem,
          corePromise: brief.corePromise || null,
          whyThisIdea: brief.supportingEvidence.map((e) => e.statement),
          creatorNotes: notes || null,
          ...(only ? { answerOnly: only } : {}),
        }),
      },
    ],
  });
  const parsed = answer ? aiSchema.safeParse(parseJsonObject(answer.content)) : null;
  return parsed?.success ? parsed.data : null;
}

/**
 * Returns the brief with empty fields filled. Null when no model produced a usable answer,
 * so the caller can refund and let the user write it themselves. When the answer leaves a
 * main field (who it's for, the angle, the format, the promise) empty, one focused follow-up
 * asks for just those.
 */
export async function interpretBrief(brief: VideoBrief, options: { notes?: string; models: string[]; now?: Date }): Promise<VideoBrief | null> {
  const notes = (options.notes ?? '').slice(0, 1500);
  const first = await ask(brief, notes, options.models);
  if (!first) return null;
  let merged = merge(brief, first, notes, options.now);
  if (!merged) return null;
  const missing = PLAN_FIELDS.filter((f) => !merged![f]);
  if (missing.length) {
    const second = await ask(merged, notes, options.models, missing);
    if (second) merged = merge(merged, second, notes, options.now) ?? merged;
  }
  return merged;
}

/** Fills the brief's empty fields from one answer; never overwrites. Pure. */
export function merge(brief: VideoBrief, ai: z.infer<typeof aiSchema>, notes: string, now?: Date): VideoBrief | null {
  const allowed = allowedNumbers(brief, notes);
  const ok = (v: string | undefined | null): v is string => typeof v === 'string' && acceptable(v, allowed);
  const okPlan = (v: string | undefined | null): v is string => typeof v === 'string' && acceptablePlan(v, allowed);

  const keyPoints = keepValid(ai.keyPoints, pointSchema, (p) => acceptable(p, allowed), 6);
  const corePromise = brief.corePromise || (ok(ai.corePromise) ? ai.corePromise : '');
  // Without a promise and key points the answer isn't a brief.
  if (!corePromise && keyPoints.length === 0 && brief.keyPoints.length === 0) return null;

  const format = brief.format ?? (ai.format ?? null);
  return {
    ...brief,
    audience: brief.audience || (okPlan(ai.audience) ? ai.audience : ''),
    problem: brief.problem ?? (ok(ai.problem) ? ai.problem : null),
    intent: ai.intent && !brief.format ? ai.intent : brief.intent,
    format,
    // A format chosen now brings its default structure, unless the user already edited it.
    structure: !brief.format && format && brief.source === 'manual' ? structureFor(format) : brief.structure,
    angle: brief.angle || (okPlan(ai.angle) ? ai.angle : ''),
    corePromise,
    keyPoints: brief.keyPoints.length ? brief.keyPoints : keyPoints,
    keyQuestions: brief.keyQuestions.length ? brief.keyQuestions : keepValid(ai.keyQuestions, questionSchema, (q) => acceptable(q, allowed), 4),
    titleDirections: brief.titleDirections.length ? brief.titleDirections : keepValid(ai.titleDirections?.map(normalizeDirection), directionSchema, (d) => acceptable(d.direction, allowed), 4),
    thumbnailDirection: brief.thumbnailDirection || (ok(ai.thumbnailDirection) ? ai.thumbnailDirection : ''),
    source: 'ai',
    updatedAt: (now ?? new Date()).toISOString(),
  };
}
