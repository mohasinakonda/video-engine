import { z } from 'zod';
import { callLLM, parseJsonObject } from '@/lib/llm-providers';
import type { Confidence } from '../types';
import { FORMATS, type FormatTag } from './formats';

// ─── AI fallback for titles the rules can't place ────────────────────────────

const aiFormatItem = z.object({
  n: z.number().int(),
  primary: z.enum(FORMATS).nullable(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

/**
 * Asks the model for the format of titles the rules missed. Only titles are sent. Unknown
 * indexes and formats outside the list are dropped; "null" (no clear format) is kept as is.
 * AI-assigned formats are capped at medium confidence.
 */
export async function classifyWithAI(titles: string[], models: string[]): Promise<Map<number, FormatTag>> {
  const result = new Map<number, FormatTag>();
  if (titles.length === 0) return result;

  const answer = await callLLM({
    tag: 'discover:formats',
    models,
    json: true,
    temperature: 0,
    maxTokens: 3000,
    timeoutMs: 40_000,
    messages: [
      {
        role: 'system',
        content: `Classify each YouTube video title into one content format from this list: ${FORMATS.join(', ')}. Use null when the title gives no clear signal; do not guess. Reply only with JSON: {"formats": [{"n": <title number>, "primary": "<format or null>", "confidence": "low|medium|high"}]}`,
      },
      { role: 'user', content: titles.map((t, i) => `${i}. ${t.slice(0, 140)}`).join('\n') },
    ],
  });
  if (!answer) return result;

  const items: unknown[] = parseJsonObject(answer.content)?.formats;
  if (!Array.isArray(items)) return result;
  // Checked one by one: a single bad item (e.g. a format outside the list) drops only itself.
  for (const raw of items) {
    const parsed = aiFormatItem.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    if (item.n < 0 || item.n >= titles.length || !item.primary) continue;
    const confidence: Confidence = item.confidence === 'high' ? 'medium' : item.confidence ?? 'low';
    result.set(item.n, { primary: item.primary, secondary: null, confidence, source: 'ai' });
  }
  return result;
}
