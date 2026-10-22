/**
 * Viewer themes from comments (docs/audit-plan.md §2). The model only names themes and lists
 * which numbered comments belong to each; counts and example quotes are taken from the real
 * comments here, so nothing can be invented. No author names or ids are ever sent.
 */
import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import { BANNED } from '../../discover/ai/interpret';

export type ThemeKind = 'liked' | 'complaint' | 'question' | 'discussion';

export interface ViewerTheme {
  kind: ThemeKind;
  theme: string;
  count: number;
  /** Up to two short real comments. */
  examples: string[];
}

export interface ViewerThemes {
  read: number;
  themes: ViewerTheme[];
}

/** A theme needs this many comments behind it. */
export const MIN_THEME_COMMENTS = 3;

/** Drops spam-like and empty lines before anything is sent: links, repeats, single words. */
export function cleanComments(texts: string[]): string[] {
  const seen = new Set<string>();
  return texts
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => {
      const key = t.toLowerCase();
      if (t.length < 4 || /https?:\/\/|www\./i.test(t) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}

const aiSchema = z.object({
  themes: z.array(z.object({ kind: z.enum(['liked', 'complaint', 'question', 'discussion']), theme: z.string().trim().min(3).max(120), ids: z.array(z.number().int()) })),
});

const SYSTEM = `You read a YouTube video's comments and group them into themes.
- kind "liked": what viewers praised about the video.
- kind "complaint": criticism of the video itself (length, audio, pacing, accuracy, clickbait…). Opinions about the subject are not complaints.
- kind "question": what they asked or wanted covered that the video didn't answer.
- kind "discussion": what viewers argued or shared opinions about on the subject itself (not the video).
- Each theme: a short plain label (under 12 words) and the ids of the comments that clearly belong to it. A comment can be in at most one theme.
- Only themes supported by at least 3 comments. Ignore jokes, spam and greetings.
- Write the labels in the language given as writeIn. Don't quote anyone; don't mention names.
Reply only with JSON: {"themes": [{"kind": "...", "theme": "...", "ids": [1, 4, 9]}]}`;

/** Two short real examples, trimmed. */
const examplesOf = (texts: string[]) =>
  [...texts]
    .sort((a, b) => a.length - b.length)
    .slice(0, 2)
    .map((t) => (t.length > 140 ? `${t.slice(0, 137)}…` : t));

/** Turns the model's grouping into checked themes. Pure, so it can be tested. */
export function buildThemes(raw: unknown, comments: string[]): ViewerTheme[] {
  const parsed = aiSchema.safeParse(raw);
  if (!parsed.success) return [];
  const used = new Set<number>();
  const themes: ViewerTheme[] = [];
  for (const t of parsed.data.themes) {
    if (BANNED.test(t.theme)) continue;
    // Ids are 1-based in the prompt; unknown or reused ids are dropped.
    const ids = Array.from(new Set(t.ids)).filter((id) => id >= 1 && id <= comments.length && !used.has(id));
    if (ids.length < MIN_THEME_COMMENTS) continue;
    ids.forEach((id) => used.add(id));
    themes.push({ kind: t.kind, theme: t.theme, count: ids.length, examples: examplesOf(ids.map((id) => comments[id - 1])) });
  }
  const order: Record<ThemeKind, number> = { complaint: 0, question: 1, liked: 2, discussion: 3 };
  return themes.sort((a, b) => order[a.kind] - order[b.kind] || b.count - a.count).slice(0, 9);
}

/** Null when no model answered; an empty list when no theme had enough comments. */
export async function viewerThemes(texts: string[], options: { language: 'English' | 'Bangla'; models: string[] }): Promise<ViewerThemes | null> {
  const comments = cleanComments(texts);
  if (comments.length < MIN_THEME_COMMENTS) return { read: comments.length, themes: [] };
  const answer = await callLLM({
    tag: 'audit:comments',
    models: options.models,
    json: true,
    temperature: 0.2,
    maxTokens: 2000,
    timeoutMs: 60_000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: JSON.stringify({ writeIn: options.language, comments: comments.map((text, i) => ({ id: i + 1, text })) }) },
    ],
  });
  if (!answer) return null;
  return { read: comments.length, themes: buildThemes(parseJsonObject(answer.content), comments) };
}
