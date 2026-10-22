/**
 * Video Brief v1 (docs/create-plan.md §3): the schema, the deterministic part built from a
 * Discover thesis, and the qualitative evidence. The AI part is in ai/brief-interpreter.ts.
 */
import { z } from 'zod';
import { FORMATS, MECHANISMS } from '../discover/formats';
import { structureFor } from './structures';
import type { Thesis } from './types';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);

export const INTENTS = ['inform', 'compare', 'teach', 'entertain', 'persuade'] as const;

export const beatSchema = z.object({ id: z.string().min(1).max(40), label: required(60), purpose: text(160) });

export const evidenceSchema = z.object({ statement: required(240), kind: z.enum(['channel', 'market', 'diagnosis']) });

/** Everything the user can edit. Validated the same way whether the AI or the user wrote it. */
export const briefSchema = z.object({
  version: z.literal(1),
  language: z.enum(['English', 'Bangla']),
  topic: required(120),
  audience: text(240),
  problem: text(200).nullable(),
  intent: z.enum(INTENTS),
  corePromise: text(240),
  angle: text(160),
  format: z.enum(FORMATS).nullable(),
  keyPoints: z.array(required(240)).max(8),
  keyQuestions: z.array(required(200)).max(6),
  structure: z.array(beatSchema).min(2).max(12),
  titleDirections: z.array(z.object({ mechanism: z.enum(MECHANISMS), direction: required(200) })).max(5),
  thumbnailDirection: text(400),
  // Read-only context from Discover (kept as the user saved it).
  supportingEvidence: z.array(evidenceSchema).max(8),
  gapTypes: z.array(z.enum(['coverage', 'audience_problem', 'format', 'packaging', 'emerging'])).max(5),
  productionDifficulty: z.enum(['low', 'medium', 'high']).nullable(),
  confidence: z.enum(['low', 'medium', 'high']).nullable(),
  source: z.enum(['ai', 'manual']),
  updatedAt: z.string(),
});
export type VideoBrief = z.infer<typeof briefSchema>;

/** A brief is ready for a script when these are filled. */
export function missingForScript(b: VideoBrief): string[] {
  const missing: string[] = [];
  if (!b.corePromise) missing.push('core promise');
  if (!b.audience) missing.push('audience');
  if (b.keyPoints.length === 0) missing.push('at least one key point');
  return missing;
}

/**
 * Why the opportunity exists, in words only. Numbers about other channels (views, ratios)
 * are left out: they can't be kept beyond 30 days under YouTube's API policy, and a brief is kept.
 */
export function qualitativeEvidence(t: Thesis): VideoBrief['supportingEvidence'] {
  const out: VideoBrief['supportingEvidence'] = [];
  if (t.gapTypes.includes('coverage')) out.push({ kind: 'market', statement: 'Several competitors had standout videos on this topic, and your channel has little or nothing on it.' });
  if (t.gapTypes.includes('emerging')) out.push({ kind: 'market', statement: 'The topic has recent activity and isn’t crowded yet. This is an early signal.' });
  if (t.gapTypes.includes('format')) out.push({ kind: 'market', statement: 'You cover the topic, but standouts use a different format.' });
  if (t.gapTypes.includes('packaging')) out.push({ kind: 'market', statement: 'You cover the topic, but standouts package it differently.' });
  if (t.gapTypes.includes('audience_problem')) out.push({ kind: 'market', statement: 'Several competitors answer a viewer need you haven’t covered (read by AI from titles).' });
  if (t.momentum === 'recent') out.push({ kind: 'market', statement: 'Several channels posted on this topic recently.' });
  if (t.momentum === 'durable') out.push({ kind: 'market', statement: 'The topic has drawn steady interest over months.' });
  if (t.momentum === 'one_off') out.push({ kind: 'market', statement: 'The signal rests on a single standout video, so treat it as early.' });
  out.push({ kind: 'channel', statement: `Fit with your channel: ${t.channelFit}. Competition: ${t.competition}.` });
  if ((t.scores.phase1 ?? 0) >= 70) out.push({ kind: 'diagnosis', statement: 'It suits what Channel Doctor found about your channel.' });
  return out.slice(0, 8);
}

/** The deterministic starting brief from a Discover thesis, before the AI fills the rest. */
export function briefFromThesis(t: Thesis, language: VideoBrief['language'], now = new Date()): VideoBrief {
  return {
    version: 1,
    language,
    topic: t.topic,
    audience: '',
    problem: null,
    intent: t.recommendedFormat === 'comparison' || t.recommendedFormat === 'review' ? 'compare' : t.recommendedFormat === 'tutorial' ? 'teach' : 'inform',
    corePromise: '',
    angle: t.recommendedAngle ?? '',
    format: t.recommendedFormat,
    keyPoints: [],
    keyQuestions: [],
    structure: structureFor(t.recommendedFormat),
    titleDirections: [],
    thumbnailDirection: '',
    supportingEvidence: qualitativeEvidence(t),
    gapTypes: t.gapTypes,
    productionDifficulty: t.productionDifficulty,
    confidence: t.confidence,
    source: 'ai',
    updatedAt: now.toISOString(),
  };
}

/** An empty brief for a project started from scratch. */
export function emptyBrief(topic: string, language: VideoBrief['language'], now = new Date()): VideoBrief {
  return {
    version: 1,
    language,
    topic: topic.slice(0, 120),
    audience: '',
    problem: null,
    intent: 'inform',
    corePromise: '',
    angle: '',
    format: null,
    keyPoints: [],
    keyQuestions: [],
    structure: structureFor(null),
    titleDirections: [],
    thumbnailDirection: '',
    supportingEvidence: [],
    gapTypes: [],
    productionDifficulty: null,
    confidence: null,
    source: 'manual',
    updatedAt: now.toISOString(),
  };
}
