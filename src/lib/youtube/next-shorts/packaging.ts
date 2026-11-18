/**
 * Packaging for one planned Short: title options with the angle each takes, the description,
 * hashtags, the cover (which shot, and up to 4 words on it) and a pinned comment that invites a
 * reply. Titles that break the rules are dropped; if fewer than two survive, it asks once more.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { CAPTION_MAX_WORDS, MAX_HASHTAGS, MAX_SHOTS, TITLE_MAX } from './types';
import { titleProblems } from './validate';

const text = (max: number) => z.string().trim().min(1).max(max);

export const packagingRequestSchema = z.object({
  channelTitle: z.string().trim().min(1).max(120),
  audience: z.string().trim().max(200).optional(),
  short: z.object({
    name: text(80),
    why: z.string().trim().max(240),
    promise: text(200),
    hook: text(240),
    ending: text(240),
    shots: z
      .array(z.object({ title: text(60), action: text(240) }))
      .min(1)
      .max(MAX_SHOTS + 2),
  }),
});
export type PackagingRequest = z.infer<typeof packagingRequestSchema>;

export const shortPackagingSchema = z.object({
  titles: z
    .array(z.object({ title: text(120), angle: text(120) }))
    .min(1)
    .max(6),
  description: text(400),
  hashtags: z.array(z.string().trim().min(2).max(40)).max(6),
  coverShot: z
    .number()
    .int()
    .min(1)
    .max(MAX_SHOTS + 2),
  coverText: z.string().trim().max(40),
  pinnedComment: text(200),
});
export type ShortPackaging = z.infer<typeof shortPackagingSchema>;

const SYSTEM = `You write the packaging for one YouTube Short from its storyboard.
- "titles": 4 options, each with a different angle (the question the first shot raises, the result, a relatable problem, curiosity). At most ${TITLE_MAX} characters, the key words in the first 40 (the Shorts feed cuts the rest). No hashtags, no emojis, no "Part 2", no times or prices, nothing the video doesn't show. Say the angle in a few words.
- "description": the first line repeats the promise plainly (people see it in search); one or two short sentences.
- "hashtags": up to ${MAX_HASHTAGS}, specific to the topic, no #shorts.
- "coverShot": the shot number whose frame makes the clearest cover; "coverText": up to ${CAPTION_MAX_WORDS} words to put on it (or empty).
- "pinnedComment": one short question that viewers want to answer, about their own situation.
- English, plain words, no hype ("viral", "insane", "you won't believe").
Reply only with JSON: {"titles": [{"title": "...", "angle": "..."}], "description": "...", "hashtags": ["#..."], "coverShot": 1, "coverText": "...", "pinnedComment": "..."}`;

function tidy(p: ShortPackaging, shots: number): ShortPackaging {
  const seen = new Set<string>();
  const titles = p.titles
    .map((t) => ({ ...t, title: t.title.replace(/\s*#\S+/g, '').trim() }))
    .filter((t) => titleProblems(t.title).length === 0 && !seen.has(t.title.toLowerCase()) && seen.add(t.title.toLowerCase()));
  const hashtags = Array.from(new Set(p.hashtags.map((h) => `#${h.replace(/^#+/, '').replace(/\s+/g, '')}`)))
    .filter((h) => h.toLowerCase() !== '#shorts')
    .slice(0, MAX_HASHTAGS);
  const coverText = p.coverText.split(/\s+/).filter(Boolean).slice(0, CAPTION_MAX_WORDS).join(' ');
  return { ...p, titles, hashtags, coverText, coverShot: Math.min(Math.max(1, p.coverShot), shots) };
}

export async function writeShortPackaging(req: PackagingRequest, models: string[]): Promise<ShortPackaging | null> {
  const ask = async (extra: object | null) => {
    const answer = await callLLM({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify({ channel: req.channelTitle, audience: req.audience ?? null, ...req.short, ...(extra ?? {}) }) },
      ],
      json: true,
      temperature: 0.7,
      maxTokens: 1500,
      timeoutMs: 45_000,
      models,
      tag: 'next-shorts/packaging',
      accept: (c) => shortPackagingSchema.safeParse(parseJsonObject(c)).success,
    });
    return answer ? tidy(shortPackagingSchema.parse(parseJsonObject(answer.content)), req.short.shots.length) : null;
  };
  const first = await ask(null);
  if (!first || first.titles.length >= 2) return first;
  const second = await ask({ note: 'Your last titles broke the rules (too long, hashtags, "Part 2", or a time claim). Write 4 new ones.' });
  return second && second.titles.length > first.titles.length ? second : first.titles.length ? first : second;
}
