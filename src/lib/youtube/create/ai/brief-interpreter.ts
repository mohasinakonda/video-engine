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

const aiSchema = z.object({
  audience: line(240).optional(),
  problem: line(200).nullable().optional(),
  intent: z.enum(INTENTS).optional(),
  format: z.enum(FORMATS).nullable().optional(),
  angle: line(160).optional(),
  corePromise: line(240).optional(),
  keyPoints: z.array(z.unknown()).optional(),
  keyQuestions: z.array(z.unknown()).optional(),
  titleDirections: z.array(z.unknown()).optional(),
  thumbnailDirection: line(400).optional(),
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
- audience: who the video is for, concretely (not "everyone").
- corePromise: the one thing the viewer gets by watching to the end, in one sentence.
- keyPoints: 3–6 points the video must cover, each one short sentence.
- keyQuestions: 2–4 questions the viewer wants answered.
- titleDirections: 2–4 directions for the title, as objects {"mechanism": "<one of: ${MECHANISMS.join(', ')}>", "direction": "<the direction>"}. Directions, not finished titles.
- thumbnailDirection: what the thumbnail should show (subject, composition, contrast, any text), in two sentences.
- If no format is set, choose one from: ${FORMATS.join(', ')}. If no angle is set, propose an original one.
Rules: don't invent facts, statistics or claims; no hype ("viral", "guaranteed", "hack").
Language: write every field in the language given as writeIn, even when the topic or angle is in another language.
Reply only with JSON using the field names above.`;

/** Numbers the AI may use: only those already in the user's or Discover's text. */
function allowedNumbers(brief: VideoBrief, notes: string): Set<string> {
  return new Set(numbersIn([brief.topic, brief.angle, brief.problem ?? '', notes].join(' ')));
}

const acceptable = (value: string, allowed: Set<string>) => !BANNED.test(value) && numbersIn(value).every((n) => allowed.has(n));

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
export async function interpretBrief(brief: VideoBrief, options: { notes?: string; models: string[]; now?: Date }): Promise<VideoBrief | null> {
  const notes = (options.notes ?? '').slice(0, 1500);
  const answer = await callLLM({
    tag: 'create:brief',
    models: options.models,
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
          whyThisIdea: brief.supportingEvidence.map((e) => e.statement),
          creatorNotes: notes || null,
        }),
      },
    ],
  });
  const parsed = answer ? aiSchema.safeParse(parseJsonObject(answer.content)) : null;
  if (!parsed?.success) return null;

  const ai = parsed.data;
  const allowed = allowedNumbers(brief, notes);
  const ok = (v: string | undefined | null): v is string => typeof v === 'string' && acceptable(v, allowed);

  const keyPoints = keepValid(ai.keyPoints, pointSchema, (p) => acceptable(p, allowed), 6);
  const corePromise = brief.corePromise || (ok(ai.corePromise) ? ai.corePromise : '');
  // Without a promise and key points the answer isn't a brief.
  if (!corePromise && keyPoints.length === 0) return null;

  const format = brief.format ?? (ai.format ?? null);
  return {
    ...brief,
    audience: brief.audience || (ok(ai.audience) ? ai.audience : ''),
    problem: brief.problem ?? (ok(ai.problem) ? ai.problem : null),
    intent: ai.intent && !brief.format ? ai.intent : brief.intent,
    format,
    // A format chosen now brings its default structure, unless the user already edited it.
    structure: !brief.format && format && brief.source === 'manual' ? structureFor(format) : brief.structure,
    angle: brief.angle || (ok(ai.angle) ? ai.angle : ''),
    corePromise,
    keyPoints: brief.keyPoints.length ? brief.keyPoints : keyPoints,
    keyQuestions: brief.keyQuestions.length ? brief.keyQuestions : keepValid(ai.keyQuestions, questionSchema, (q) => acceptable(q, allowed), 4),
    titleDirections: brief.titleDirections.length ? brief.titleDirections : keepValid(ai.titleDirections?.map(normalizeDirection), directionSchema, (d) => acceptable(d.direction, allowed), 4),
    thumbnailDirection: brief.thumbnailDirection || (ok(ai.thumbnailDirection) ? ai.thumbnailDirection : ''),
    source: 'ai',
    updatedAt: (options.now ?? new Date()).toISOString(),
  };
}
