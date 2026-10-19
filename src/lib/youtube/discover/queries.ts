import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';

/** One search phrase as the user may submit it. */
export const queryText = z
  .string()
  .trim()
  .min(2, 'Each search phrase needs at least 2 characters')
  .max(80, 'Keep each search phrase under 80 characters')
  .transform((q) => q.replace(/\s+/g, ' '));

const suggestionSchema = z.object({ queries: z.array(z.string()).min(1) });

const BANGLA = /[\u0980-\u09FF]/;
const LATIN = /[A-Za-z]/;

/** The titles' main script, decided here rather than left to the model. */
export function mainLanguage(titles: string[]): 'Bangla' | 'English' {
  const bangla = titles.filter((t) => BANGLA.test(t)).length;
  return bangla > titles.length / 2 ? 'Bangla' : 'English';
}

/** A word mixing Bangla and Latin letters ("বald") is a model glitch, not a search phrase. */
export function hasMixedScriptWord(phrase: string): boolean {
  return phrase.split(/\s+/).some((word) => BANGLA.test(word) && LATIN.test(word));
}

/**
 * Suggests search phrases that would find channels like yours, from your recent titles.
 * Only titles and the channel name go to the model. Returns [] when no model answers,
 * so the user can type phrases instead.
 */
export async function suggestQueries(input: { channelTitle: string; titles: string[]; count: number; models: string[] }): Promise<string[]> {
  const titles = input.titles.slice(0, 25).map((t) => t.slice(0, 120));
  if (titles.length === 0) return [];

  const answer = await callLLM({
    tag: 'discover:queries',
    models: input.models,
    json: true,
    temperature: 0.3,
    maxTokens: 400,
    timeoutMs: 25_000,
    messages: [
      {
        role: 'system',
        content:
          'You help a YouTube creator find channels that make similar videos. Write short search phrases a viewer would type on YouTube to find videos on the same topics. Write every phrase in the language given as "language". Describe topics, not this channel: never include the channel name. Each phrase is 2–6 words. Cover different main topics if there are several. Reply only with JSON: {"queries": ["...", "..."]}',
      },
      {
        role: 'user',
        content: JSON.stringify({ channel: input.channelTitle, language: mainLanguage(titles), recentTitles: titles, phrasesNeeded: input.count }),
      },
    ],
  });
  if (!answer) return [];

  const parsed = suggestionSchema.safeParse(parseJsonObject(answer.content));
  if (!parsed.success) return [];

  const channel = input.channelTitle.toLowerCase();
  const unique: string[] = [];
  for (const raw of parsed.data.queries) {
    const q = queryText.safeParse(raw);
    if (!q.success || q.data.toLowerCase().includes(channel) || hasMixedScriptWord(q.data)) continue;
    if (!unique.some((u) => u.toLowerCase() === q.data.toLowerCase())) unique.push(q.data);
  }
  return unique.slice(0, input.count);
}
