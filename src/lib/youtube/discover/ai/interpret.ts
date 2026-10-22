/**
 * AI interpretation of scored opportunities (docs/discover-plan.md §8): an original angle,
 * why now, and who it's for. The model receives compact evidence already worded as facts and
 * returns text only; scores, counts and confidence never come from it.
 */
import { z } from 'zod';
import { callLLM, embed, parseJsonObject } from '@/lib/llm-providers';
import { FORMAT_LABELS } from '../formats';
import { cosine } from '../similarity';
import type { Opportunity } from '../types';
import { numbersIn } from '../numbers';
import { tooCloseTo } from './originality';

const itemSchema = z.object({
  id: z.string(),
  recommendedAngle: z.string().trim().min(8).max(110),
  angleRationale: z.string().trim().max(240).optional(),
  whyNow: z.string().trim().max(280),
  audience: z.string().trim().max(100).optional(),
});
type AiItem = z.infer<typeof itemSchema>;

/** Words a decision-support tool must not use (docs/discover-plan.md §11). */
export const BANNED = /\b(viral|guaranteed?|guarantee|hack|exploit|untapped|no competition|100\s*%|algorithm secret|blow up)\b|ভাইরাল|গ্যারান্টি/i;

const MOMENTUM_TEXT: Record<Opportunity['momentum'], string> = {
  recent: 'several channels posted on it recently',
  durable: 'steady interest over months',
  one_off: 'a single standout video (one-off spike), not a trend',
  none: 'no clear trend',
};

const EARLY_SIGNAL = { English: 'Early signal: ', Bangla: 'প্রাথমিক ইঙ্গিত: ' } as const;

/** Low-confidence advice always says so up front, whatever the model wrote. */
export function withConfidenceNote(whyNow: string, confidence: Opportunity['confidence'], language: 'Bangla' | 'English'): string {
  if (confidence !== 'low') return whyNow;
  const prefix = EARLY_SIGNAL[language];
  return /^(early signal|প্রাথমিক ইঙ্গিত)/i.test(whyNow) ? whyNow : `${prefix}${whyNow.charAt(0).toLowerCase()}${whyNow.slice(1)}`;
}

export { numbersIn };

/** True when every number in `text` appears in the allowed facts. Stops invented statistics. */
export function onlyKnownNumbers(text: string, allowed: Set<string>): boolean {
  return numbersIn(text).every((n) => allowed.has(n));
}

export interface InterpretInput {
  channelTitle: string;
  language: 'Bangla' | 'English';
  /** Topics you already cover (labels), for fit and to avoid repeating yourself. */
  yourTopics: string[];
  diagnosis: string | null;
  opportunities: Opportunity[];
  /** Competitor titles per topic id: the originality guard checks angles against all of them. */
  competitorTitles: Map<string, string[]>;
  /** Title vectors per topic id (same order as competitorTitles), when available. */
  competitorVectors: Map<string, (number[] | undefined)[]>;
  textModels: string[];
  embeddingModels: string[];
}

function payload(input: InterpretInput) {
  return {
    channel: input.channelTitle,
    writeIn: input.language,
    topicsYouCover: input.yourTopics.slice(0, 10),
    channelDoctor: input.diagnosis,
    opportunities: input.opportunities.map((o) => ({
      id: o.id,
      topic: o.topic,
      gaps: o.gapTypes,
      momentum: MOMENTUM_TEXT[o.momentum],
      confidenceReasons: o.confidenceReasons,
      competition: o.competition,
      suggestedFormat: o.recommendedFormat ? FORMAT_LABELS[o.recommendedFormat] : null,
      viewerNeed: o.problem,
      confidence: o.confidence,
      facts: o.evidence.map((e) => e.statement),
      // Evidence of demand only: the angle must not copy these.
      competitorStandoutTitles: o.competitorSignals.slice(0, 5).map((c) => c.title),
    })),
  };
}

const SYSTEM = `You are a YouTube content strategist. For each opportunity, using only the facts given:
- recommendedAngle: an ORIGINAL video idea for this creator, written like a title (under 90 characters). Never copy or lightly reword a competitor title; find a different angle, question or promise. Fit the suggested format.
- angleRationale: one sentence on why this angle suits this channel.
- whyNow: one or two short sentences explaining the opportunity from the facts. Use only numbers that appear in the facts. Match the strength of your words to the confidence: with low confidence or a one-off spike, don't claim a trend or rising interest.
- audience: who the video is for, in a few words.
Rules: no hype ("viral", "guaranteed", "hack", "untapped", "no competition"); don't present guesses as facts; write in the language given as writeIn.
Reply only with JSON: {"opportunities": [{"id": "...", "recommendedAngle": "...", "angleRationale": "...", "whyNow": "...", "audience": "..."}]}`;

async function ask(input: InterpretInput, extra?: string): Promise<AiItem[] | null> {
  const answer = await callLLM({
    tag: 'discover:angles',
    models: input.textModels,
    json: true,
    temperature: 0.5,
    maxTokens: 3500,
    timeoutMs: 50_000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: JSON.stringify(payload(input)) + (extra ? `\n\n${extra}` : '') },
    ],
  });
  const items: unknown[] | undefined = answer ? parseJsonObject(answer.content)?.opportunities : undefined;
  if (!Array.isArray(items)) return null;
  // Each item is checked on its own: one bad item doesn't discard the rest.
  return items.map((raw) => itemSchema.safeParse(raw)).flatMap((r) => (r.success ? [r.data] : []));
}

/** A plain angle when the model can't write an original one. Marked as not AI-written. */
export function fallbackAngle(o: Opportunity, language: 'Bangla' | 'English'): string {
  const format = o.recommendedFormat ? FORMAT_LABELS[o.recommendedFormat] : null;
  if (language === 'Bangla') return `${o.topic} নিয়ে আপনার নিজের দৃষ্টিভঙ্গি${format ? ` (${format})` : ''}`;
  return `Your take on ${o.topic.toLowerCase()}${format ? ` (${format.toLowerCase()})` : ''}`;
}

/**
 * Adds angle, why-now and audience to each opportunity. Every field is validated; anything
 * that fails (copied angle, invented number, hype words) is replaced by a safe fallback.
 */
export async function interpretOpportunities(input: InterpretInput): Promise<{ opportunities: Opportunity[]; aiUsed: boolean }> {
  if (input.opportunities.length === 0) return { opportunities: [], aiUsed: false };

  const byId = new Map<string, AiItem>();
  const first = await ask(input);
  first?.forEach((item) => byId.set(item.id, item));

  // Angles too close to a competitor title get one more try, with the reason.
  const angleVectors = await embedAngles(Array.from(byId.values()).map((i) => i.recommendedAngle), input.embeddingModels);
  const copied = new Map<string, string>();
  Array.from(byId.values()).forEach((item, k) => {
    const close = closeTitle(item, input, angleVectors?.[k]);
    if (close) copied.set(item.id, close);
  });
  if (copied.size > 0) {
    const retry = await ask(
      { ...input, opportunities: input.opportunities.filter((o) => copied.has(o.id)) },
      `These angles were too close to competitor titles; write clearly different ones: ${JSON.stringify(Array.from(copied.entries()).map(([id, title]) => ({ id, tooCloseTo: title })))}`
    );
    const retryVectors = await embedAngles((retry ?? []).map((i) => i.recommendedAngle), input.embeddingModels);
    (retry ?? []).forEach((item, k) => {
      if (copied.has(item.id) && !closeTitle(item, input, retryVectors?.[k])) {
        byId.set(item.id, item);
        copied.delete(item.id);
      }
    });
  }

  let aiUsed = false;
  const opportunities = input.opportunities.map((o) => {
    const item = byId.get(o.id);
    const allowed = new Set(o.evidence.flatMap((e) => numbersIn(e.statement)));
    const angleOk = item && !copied.has(o.id) && !BANNED.test(item.recommendedAngle);
    const whyOk = item && !BANNED.test(item.whyNow) && onlyKnownNumbers(item.whyNow, allowed);
    const audienceOk = item?.audience && !BANNED.test(item.audience) && onlyKnownNumbers(item.audience, allowed);
    if (angleOk || whyOk) aiUsed = true;
    return {
      ...o,
      recommendedAngle: angleOk ? item.recommendedAngle : fallbackAngle(o, input.language),
      angleSource: angleOk ? ('ai' as const) : ('fallback' as const),
      angleRationale:
        angleOk && item.angleRationale && !BANNED.test(item.angleRationale) && onlyKnownNumbers(item.angleRationale, allowed) ? item.angleRationale : null,
      whyNow: whyOk ? withConfidenceNote(item.whyNow, o.confidence, input.language) : null,
      audience: audienceOk ? (item.audience as string) : null,
    };
  });
  return { opportunities, aiUsed };
}

async function embedAngles(angles: string[], models: string[]): Promise<number[][] | null> {
  if (angles.length === 0) return [];
  const result = await embed({ texts: angles, models, tag: 'discover:originality' });
  return result?.vectors ?? null;
}

function closeTitle(item: AiItem, input: InterpretInput, angleVector: number[] | undefined): string | null {
  const opp = input.opportunities.find((o) => o.id === item.id);
  if (!opp) return null;
  const titles = [...(input.competitorTitles.get(opp.topicId) ?? []), ...opp.competitorSignals.map((c) => c.title)];
  const vectors = input.competitorVectors.get(opp.topicId) ?? [];
  // Vectors from different models (a fallback model answered) can't be compared.
  return tooCloseTo(item.recommendedAngle, titles, (i) =>
    angleVector && vectors[i] && vectors[i]!.length === angleVector.length ? cosine(angleVector, vectors[i] as number[]) : null
  );
}
