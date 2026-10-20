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
  verdict: z.string().trim().min(10).max(260),
  lessons: z.array(z.string().trim().min(10).max(220)).max(6),
});

export const SYSTEM_VIDEO = `You explain a YouTube video audit to a creator who wants to learn from this video for their own channel.
You get checked findings (performance against the video's own channel, title, thumbnail, description, length) and what viewers said.
- verdict: one or two sentences on why this video did what it did, using only the findings.
- lessons: 2–4 short, concrete things the creator can copy or avoid on their own channel. Start each with a verb.
- Use only facts from the input. Avoid numbers; if you use one, copy it exactly as the input writes it. No hype ("viral", "guaranteed", "hack").
- Don't link two findings as cause and effect unless a finding says so (e.g. don't say the title caused fewer likes).
- Don't claim to know click rate, retention or traffic: YouTube doesn't share them for other channels.
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

/** Keeps only text that is hype-free and uses no number outside the input. Pure. */
export function checkLessons(raw: unknown, allowed: Set<string>): { verdict: string; lessons: string[] } | null {
  const parsed = aiSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ok = (text: string) => !BANNED.test(text) && numbersIn(withoutThousands(text)).every((n) => allowed.has(n));
  if (!ok(parsed.data.verdict)) return null;
  return { verdict: parsed.data.verdict, lessons: parsed.data.lessons.filter(ok).slice(0, 4) };
}

export async function writeLessons(input: {
  subject?: 'video' | 'channel';
  /** Used when the model gives nothing usable; defaults to the video verdict for `label`. */
  fallback?: string;
  label: PerformanceLabel;
  findings: AuditFinding[];
  themes: ViewerTheme[];
  language: 'English' | 'Bangla';
  models: string[];
}): Promise<{ verdict: string; lessons: string[]; aiUsed: boolean }> {
  const facts = input.findings.map((f) => `[${f.kind}, ${f.area}] ${f.statement}${f.evidence ? ` (${f.evidence})` : ''}`);
  const viewers = input.themes.map((t) => `[${t.kind}] ${t.theme} (${t.count} comments)`);
  const allowed = allowedNumbersOf([...facts, ...viewers].join(' '));
  const fallback = { verdict: input.fallback ?? fallbackVerdict(input.label, input.language), lessons: [], aiUsed: false };
  if (facts.length === 0) return fallback;

  const answer = await callLLM({
    tag: 'audit:lessons',
    models: input.models,
    json: true,
    temperature: 0.4,
    maxTokens: 1200,
    timeoutMs: 45_000,
    messages: [
      { role: 'system', content: input.subject === 'channel' ? SYSTEM_CHANNEL : SYSTEM_VIDEO },
      { role: 'user', content: JSON.stringify({ writeIn: input.language, performance: input.label, findings: facts, viewers }) },
    ],
  });
  const checked = answer ? checkLessons(parseJsonObject(answer.content), allowed) : null;
  return checked ? { ...checked, aiUsed: true } : fallback;
}
