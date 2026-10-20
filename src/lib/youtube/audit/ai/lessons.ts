/**
 * The verdict and lessons (docs/audit-plan.md §2): written by the model from the checked
 * findings and viewer themes only. Hype words and any number not in those findings are
 * rejected; without a usable answer, a plain verdict is built from the labels instead.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { BANNED } from '../../discover/ai/interpret';
import { numbersIn } from '../../discover/numbers';
import type { AuditFinding, PerformanceLabel } from '../video-audit';
import type { ViewerTheme } from './comments';

const aiSchema = z.object({
  // Generous: a long but good verdict shouldn't throw away the lessons with it.
  verdict: z.string().trim().min(10).max(420),
  lessons: z.array(z.string().trim().min(10).max(220)).max(6),
  titleTemplate: z.string().trim().min(5).max(120).optional().catch(undefined),
  myVersion: z.string().trim().min(5).max(120).optional().catch(undefined),
});

/** Video audits also get a reusable title shape and a starting title for the creator's own take. */
const VIDEO_REPLY = `- titleTemplate: the video's title as a reusable shape, with the specific parts as [placeholders] (e.g. "🔴LIVE | [Song name] 🔤 | [What kids learn]"). Keep its separators, emoji and word order.
- myVersion: a ready-to-use working title (no [placeholders], no channel name) for the creator's own video on the same topic, with a fresh angle. Don't copy the title.
Reply only with JSON: {"verdict": "...", "lessons": ["...", "..."], "titleTemplate": "...", "myVersion": "..."}`;

export const SYSTEM_VIDEO = `You explain a YouTube video audit to a creator who wants to learn from this video for their own channel.
You get checked findings (performance against the video's own channel, title, thumbnail, description, length) and what viewers said.
- verdict: one or two sentences on why this video did what it did, using only the findings.
- lessons: 2–4 short, concrete things the creator can copy or avoid on their own channel. Start each with a verb.
- Use only facts from the input. Avoid numbers; if you use one, copy it exactly as the input writes it. No hype ("viral", "guaranteed", "hack").
- Don't link two findings as cause and effect unless a finding says so (e.g. don't say the title caused fewer likes).
- Only credit something for the result if a finding marks it a strength. Notes are context, not causes, and anything listed under noDifference made little difference on this channel: never credit it.
- Don't claim to know click rate, retention or traffic: YouTube doesn't share them for other channels.
- Don't claim how YouTube ranks or recommends videos, and don't suggest a setting (such as made for kids) as a way to grow, unless a finding says so.
- Write in the language given as writeIn.
Reply only with JSON: {"verdict": "...", "lessons": ["...", "..."]}`;

/** The same rules for a whole channel: what its standouts share, its rhythm, and how it compares with the creator. */
export const SYSTEM_CHANNEL = SYSTEM_VIDEO.replace('a YouTube video audit', 'a YouTube channel audit')
  .replace('learn from this video', 'learn from this channel')
  .replace(
    "checked findings (performance against the video's own channel, title, thumbnail, description, length) and what viewers said",
    "checked findings: how often its videos beat its own usual, what its standouts share versus its weakest videos (titles, formats, thumbnails, length), its upload rhythm, and how it compares with the creator"
  )
  .replace('why this video did what it did', 'what makes this channel work, or not')
  .replace(
    '- lessons: 2–4 short, concrete things the creator can copy or avoid on their own channel. Start each with a verb.',
    '- lessons: 2–4 short things the creator could try on their own channel. These patterns come from a few videos and show what goes together, not causes: phrase each as something to test ("Try…", "Test…"), never as a rule. Start each with a verb.'
  );

const FALLBACK: Record<PerformanceLabel, string> = {
  standout: 'This video is a standout for its channel.',
  above: 'This video did better than its channel’s usual.',
  typical: 'This video did about as well as its channel’s usual.',
  below: 'This video did worse than its channel’s usual.',
  well_below: 'This video did far worse than its channel’s usual.',
  not_comparable: 'This video can’t be compared with its channel’s usual yet.',
};

const FALLBACK_BN: Record<PerformanceLabel, string> = {
  standout: 'এই ভিডিওটি তার চ্যানেলের জন্য ব্যতিক্রমী ভালো করেছে।',
  above: 'এই ভিডিওটি তার চ্যানেলের স্বাভাবিকের চেয়ে ভালো করেছে।',
  typical: 'এই ভিডিওটি তার চ্যানেলের স্বাভাবিকের মতোই করেছে।',
  below: 'এই ভিডিওটি তার চ্যানেলের স্বাভাবিকের চেয়ে খারাপ করেছে।',
  well_below: 'এই ভিডিওটি তার চ্যানেলের স্বাভাবিকের চেয়ে অনেক খারাপ করেছে।',
  not_comparable: 'এই ভিডিওটিকে এখনো তার চ্যানেলের স্বাভাবিকের সাথে তুলনা করা যাচ্ছে না।',
};

export const fallbackVerdict = (label: PerformanceLabel, language: 'English' | 'Bangla') => (language === 'Bangla' ? FALLBACK_BN : FALLBACK)[label];

/** "21,326,354" is one number, not 21.326 and 354. */
export const withoutThousands = (text: string) => text.replace(/(\d),(?=\d{3}\b)/g, '$1');

/** Numbers in the input, as written and in whole millions/thousands ("21,326,354" also allows 21). */
export function allowedNumbersOf(text: string): Set<string> {
  const plain = withoutThousands(text);
  const out = new Set(numbersIn(plain));
  for (const n of numbersIn(plain)) {
    const v = Number(n);
    if (v >= 1000) [v / 1e3, v / 1e6, v / 1e9].filter((x) => x >= 1).forEach((x) => (out.add(String(Math.round(x))), out.add(String(Math.round(x * 10) / 10))));
  }
  return out;
}

/**
 * Keeps only text that is hype-free and uses no number outside the input. Pure. A failing
 * verdict is dropped (null) without discarding good lessons; null overall when nothing passes.
 */
export function checkLessons(raw: unknown, allowed: Set<string>): { verdict: string | null; lessons: string[]; titleTemplate: string | null; myVersion: string | null } | null {
  const parsed = aiSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ok = (text: string) => !BANNED.test(text) && numbersIn(withoutThousands(text)).every((n) => allowed.has(n));
  const verdict = ok(parsed.data.verdict) ? parsed.data.verdict : null;
  const lessons = parsed.data.lessons.filter(ok).slice(0, 4);
  const keep = (text: string | undefined) => (text && ok(text) ? text : null);
  // A title idea may use its own numbers ("5 little…"); it states no fact, so only hype is refused.
  const myVersion = parsed.data.myVersion && !BANNED.test(parsed.data.myVersion) && !/[[\]]/.test(parsed.data.myVersion) ? parsed.data.myVersion : null;
  return verdict || lessons.length ? { verdict, lessons, titleTemplate: keep(parsed.data.titleTemplate), myVersion } : null;
}

/** Comparing the creator's video with another one: what to take from the other. */
export const SYSTEM_COMPARE = SYSTEM_VIDEO.replace('a YouTube video audit', 'a comparison of two YouTube videos, the creator’s own and another channel’s')
  .replace('learn from this video', 'learn from the other video')
  .replace(
    "checked findings (performance against the video's own channel, title, thumbnail, description, length) and what viewers said",
    'the clear differences between the two videos (each judged against its own channel’s usual), and what viewers said about each'
  )
  .replace('why this video did what it did', 'the main difference that matters')
  .replace(
    '- lessons: 2–4 short, concrete things the creator can copy or avoid on their own channel. Start each with a verb.',
    '- lessons: 2–4 short changes the creator could try on their next video, taken from the differences. Start each with a verb.'
  );

export async function writeLessons(input: {
  subject?: 'video' | 'channel' | 'compare';
  /** Used when the model gives nothing usable; defaults to the video verdict for `label`. */
  fallback?: string;
  label: PerformanceLabel;
  findings: AuditFinding[];
  themes: ViewerTheme[];
  language: 'English' | 'Bangla';
  models: string[];
  /** The audited video's title, for the title shape (video audits only). */
  title?: string;
  /** Choices that made little difference on the channel, so the model doesn't credit them. */
  noDifference?: string[];
}): Promise<{ verdict: string; lessons: string[]; titleTemplate: string | null; myVersion: string | null; aiUsed: boolean }> {
  const facts = input.findings.map((f) => `[${f.kind}, ${f.area}] ${f.statement}${f.evidence ? ` (${f.evidence})` : ''}`);
  const viewers = input.themes.map((t) => `[${t.kind}] ${t.theme} (${t.count} comments)`);
  const allowed = allowedNumbersOf([...facts, ...viewers, ...(input.noDifference ?? []), input.title ?? ''].join(' '));
  const fallback = { verdict: input.fallback ?? fallbackVerdict(input.label, input.language), lessons: [], titleTemplate: null, myVersion: null, aiUsed: false };
  const video = !input.subject || input.subject === 'video';
  if (facts.length === 0) return fallback;

  const answer = await callLLM({
    tag: 'audit:lessons',
    models: input.models,
    json: true,
    temperature: 0.4,
    maxTokens: 1200,
    timeoutMs: 45_000,
    messages: [
      {
        role: 'system',
        content:
          input.subject === 'channel'
            ? SYSTEM_CHANNEL
            : input.subject === 'compare'
              ? SYSTEM_COMPARE
              : SYSTEM_VIDEO.replace('Reply only with JSON: {"verdict": "...", "lessons": ["...", "..."]}', VIDEO_REPLY),
      },
      { role: 'user', content: JSON.stringify({ writeIn: input.language, performance: input.label, ...(video && input.title ? { title: input.title } : {}), findings: facts, noDifference: input.noDifference ?? [], viewers }) },
    ],
  });
  const checked = answer ? checkLessons(parseJsonObject(answer.content), allowed) : null;
  return checked
    ? { verdict: checked.verdict ?? fallback.verdict, lessons: checked.lessons, titleTemplate: video ? checked.titleTemplate : null, myVersion: video ? checked.myVersion : null, aiUsed: true }
    : fallback;
}
