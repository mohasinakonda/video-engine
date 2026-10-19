/**
 * PackagingGenerator (docs/create-plan.md §9): title concepts, thumbnail visual briefs and a
 * metadata draft from the brief and the finished script. Everything is checked before use;
 * concepts the user already chose are kept when new ones are generated.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { BANNED } from '../../discover/ai/interpret';
import { MECHANISMS, MECHANISM_LABELS } from '../../discover/formats';
import { numbersIn } from '../../discover/numbers';
import type { VideoBrief } from '../brief';
import {
  DESCRIPTION_MAX,
  RISKS,
  TITLE_MAX,
  cleanTags,
  mechanismOf,
  thumbnailConceptSchema,
  type ThumbnailConcept,
  type TitleConcept,
  type VideoPackaging,
} from '../packaging';
import { SCRIPT_BANNED, allowedNumbers, hasUnbackedNumber, sentencesOf, type VideoScript } from '../script';

const aiSchema = z.object({
  titles: z.array(z.unknown()).optional(),
  thumbnails: z.array(z.unknown()).optional(),
  description: z.string().optional(),
  tags: z.array(z.unknown()).optional(),
});

const aiTitleSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
  mechanism: z.enum(MECHANISMS),
  audience: z.string().trim().max(160).catch(''),
  risk: z.enum(RISKS).catch('medium'),
  rationale: z.string().trim().max(300).catch(''),
});

const SYSTEM = `You package one YouTube video: title concepts, thumbnail concepts and a description, from its brief and script.
Titles (5 of them):
- Each uses one mechanism from: ${MECHANISMS.map((m) => `${m} (${MECHANISM_LABELS[m]})`).join('; ')}. Use different mechanisms.
- Under 70 characters when possible, never over 100. Specific to this video; the video must deliver what the title promises.
- No hype ("viral", "insane", "you won't believe", "guaranteed"), no all-caps words, no numbers or facts that aren't in the brief. A count ("5 ways") only if the video really has that many.
- For each: {"title", "mechanism", "audience": who this wording speaks to, "risk": "low"|"medium"|"high" (how far it could overpromise compared with the video), "rationale": one sentence on why it could earn the click}.
Thumbnails (3 concepts), each a visual brief a creator can shoot or design:
- {"mainSubject", "supportingObject", "composition", "emotionOrAction", "background", "text" (0–4 words, or empty), "contrast", "hierarchy" (what the eye sees first, second)}.
- The thumbnail and title work together: the thumbnail shouldn't repeat the title's words.
Description: 2–3 short paragraphs. The first sentence says what the viewer gets. No chapters or timestamps, no links, no hashtags, no "like and subscribe".
Tags: 8–12 search phrases people would type, most specific first.
Language: write titles, thumbnail text, description and tags in the language given as writeIn.
Reply only with JSON: {"titles": [...], "thumbnails": [...], "description": "...", "tags": [...]}`;

const hype = (s: string) => BANNED.test(s) || SCRIPT_BANNED.test(s) || /\b(insane|you won'?t believe|shocking|mind[- ]?blowing)\b/i.test(s) || /\b[A-Z]{5,}\b/.test(s);

/** Numbers the packaging may use: the brief's, the user's notes, and the script's evidence. */
function packagingNumbers(brief: VideoBrief, script: VideoScript, notes: string): Set<string> {
  const evidence = script.sections.flatMap((s) => s.claims.filter((c) => c.kind === 'evidence').map((c) => c.text));
  return allowedNumbers({ ...brief, keyPoints: [...brief.keyPoints, ...evidence] }, notes);
}

/** A short view of the script: each part's heading and opening, and the hook in full. */
function scriptSummary(script: VideoScript): string {
  return script.sections
    .map((s, i) => `${s.heading}: ${i === 0 ? s.narration.slice(0, 700) : sentencesOf(s.narration).slice(0, 2).join(' ').slice(0, 300)}`)
    .join('\n')
    .slice(0, 3500);
}

/**
 * A title is a promise, so it gets no small-count exemption: "5 ways…" needs the brief to say 5,
 * or the video to have that many key points.
 */
const titleNumbersOk = (title: string, allowed: Set<string>, keyPointCount: number) =>
  numbersIn(title).every((n) => allowed.has(n) || n === String(keyPointCount));

/** Valid, safe titles, deduplicated against each other and against those already kept. */
export function acceptTitles(raw: unknown[], allowed: Set<string>, existing: string[], keyPointCount = 0): TitleConcept[] {
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  const out: TitleConcept[] = [];
  for (const item of raw) {
    const r = aiTitleSchema.safeParse(item);
    if (!r.success) continue;
    const t = r.data;
    const key = t.title.toLowerCase();
    if (seen.has(key) || hype(t.title) || !titleNumbersOk(t.title, allowed, keyPointCount)) continue;
    seen.add(key);
    out.push({ ...t, mechanism: mechanismOf(t.title, t.mechanism), source: 'ai' });
  }
  return out;
}

export function acceptThumbnails(raw: unknown[], allowed: Set<string>): ThumbnailConcept[] {
  return raw.flatMap((item) => {
    const r = thumbnailConceptSchema.safeParse({ supportingObject: '', composition: '', emotionOrAction: '', background: '', text: '', contrast: '', hierarchy: '', ...(item as object), source: 'ai' });
    if (!r.success) return [];
    const words = Object.values(r.data).join(' ');
    return hype(words) || hasUnbackedNumber(r.data.text, allowed) ? [] : [r.data];
  });
}

/** Drops sentences with hype or unbacked numbers; links and hashtags too. */
export function cleanDescription(description: string, allowed: Set<string>): string {
  return description
    .split(/\n{2,}/)
    .map((para) =>
      sentencesOf(para)
        .filter((s) => !hype(s) && !hasUnbackedNumber(s, allowed) && !/https?:\/\/|www\.|#\w/.test(s))
        .join(' ')
    )
    .filter(Boolean)
    .join('\n\n')
    .slice(0, DESCRIPTION_MAX);
}

/**
 * New concepts and a metadata draft. Chosen title and thumbnail from `previous` are kept at
 * the top, still chosen; an existing description and tags are kept.
 * Null when no usable titles came back (the caller refunds).
 */
export async function generatePackaging(
  brief: VideoBrief,
  script: VideoScript,
  options: { notes?: string; models: string[]; previous?: VideoPackaging | null; now?: Date }
): Promise<VideoPackaging | null> {
  const notes = (options.notes ?? '').slice(0, 1500);
  const allowed = packagingNumbers(brief, script, notes);
  const prev = options.previous ?? null;
  const keptTitle = prev && prev.selectedTitle !== null ? prev.titles[prev.selectedTitle] : null;
  const keptThumb = prev && prev.selectedThumbnail !== null ? prev.thumbnails[prev.selectedThumbnail] : null;

  const request = () =>
    callLLM({
      tag: 'create:packaging',
      models: options.models,
      json: true,
      temperature: 0.8,
      maxTokens: brief.language === 'Bangla' ? 7000 : 3500,
      timeoutMs: 90_000,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            writeIn: brief.language,
            topic: brief.topic,
            corePromise: brief.corePromise,
            angle: brief.angle || null,
            audience: brief.audience,
            titleDirections: brief.titleDirections.map((d) => `${MECHANISM_LABELS[d.mechanism]}: ${d.direction}`),
            thumbnailDirection: brief.thumbnailDirection || null,
            script: scriptSummary(script),
            avoidRepeating: prev?.titles.map((t) => t.title).slice(0, 10),
            creatorNotes: notes || null,
          }),
        },
      ],
    });

  let titles: TitleConcept[] = [];
  let thumbnails: ThumbnailConcept[] = [];
  let description = '';
  let tags: string[] = [];
  // One retry when the first answer has too few usable titles.
  for (let attempt = 0; attempt < 2 && titles.length < 2; attempt++) {
    const answer = await request();
    const parsed = answer ? aiSchema.safeParse(parseJsonObject(answer.content)) : null;
    if (!parsed?.success) continue;
    const ai = parsed.data;
    titles = acceptTitles(ai.titles ?? [], allowed, keptTitle ? [keptTitle.title] : [], brief.keyPoints.length).slice(0, 6);
    thumbnails = acceptThumbnails(ai.thumbnails ?? [], allowed).slice(0, 3);
    description = cleanDescription(ai.description ?? '', allowed);
    tags = cleanTags((ai.tags ?? []).filter((t): t is string => typeof t === 'string'));
  }
  if (titles.length < 2) return null;

  const allTitles = keptTitle ? [keptTitle, ...titles] : titles;
  const allThumbs = keptThumb ? [keptThumb, ...thumbnails] : thumbnails;
  return {
    version: 1,
    language: brief.language,
    titles: allTitles,
    thumbnails: allThumbs,
    selectedTitle: keptTitle ? 0 : null,
    selectedThumbnail: keptThumb ? 0 : null,
    // Like the brief: the AI fills an empty description and tags, never replaces them.
    description: prev?.description.trim() ? prev.description : description,
    tags: prev?.tags.length ? prev.tags : tags,
    scriptUpdatedAt: script.updatedAt,
    source: 'ai',
    updatedAt: (options.now ?? new Date()).toISOString(),
  };
}
