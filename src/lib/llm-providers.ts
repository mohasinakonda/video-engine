/**
 * Server-side text LLM calls. One place for the model order used by /api/ai/chat,
 * the YouTube Launch Kit and thumbnail prompt enhancement.
 *
 * Benchmarked on our own prompts (Oct 2026), all on DeepInfra:
 *  - DeepSeek V4 Flash: best image prompts and most complete Launch Kits, ~2x faster and
 *    ~1/3 the cost of Llama 3.1 70B. It answers `{}` in json_object mode, but our prompts
 *    already ask for JSON, so that mode is skipped for it.
 *  - Nemotron 3.5 Lightning: fastest, handles json_object mode; used as the fallback.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TextProvider {
  name: string;
  model: string;
  supportsJsonMode: boolean;
}

const DEEPINFRA_CHAT_URL = 'https://api.deepinfra.com/v1/openai/chat/completions';
const DEEPINFRA_EMBEDDINGS_URL = 'https://api.deepinfra.com/v1/openai/embeddings';

const TEXT_PROVIDERS: TextProvider[] = [
  { name: 'deepseek-v4-flash', model: 'deepseek-ai/DeepSeek-V4-Flash-0731', supportsJsonMode: false },
  { name: 'nemotron-lightning', model: 'nvidia/NVIDIA-Nemotron-3.5-Lightning', supportsJsonMode: true },
];

export interface CallLLMOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Caller expects a JSON object/array; non-JSON or empty answers move on to the next model. */
  json?: boolean;
  /** Per-model timeout. Keep (models × timeout) under the route's maxDuration. */
  timeoutMs?: number;
  /** Reject an answer (e.g. an incomplete Launch Kit) so the next model is tried. */
  accept?: (content: string) => boolean;
  /** Label for logs. */
  tag?: string;
  /**
   * Model ids to try in order (e.g. from admin settings). Defaults to TEXT_PROVIDERS.
   * Unknown models are called without json_object mode and parsed from plain text.
   */
  models?: string[];
}

function resolveProviders(models?: string[]): TextProvider[] {
  if (!models?.length) return TEXT_PROVIDERS;
  return models.map(
    (model) => TEXT_PROVIDERS.find((p) => p.model === model) ?? { name: model, model, supportsJsonMode: false }
  );
}

/** Tries each model in order; returns the first acceptable answer, or null if all fail. */
export async function callLLM(options: CallLLMOptions): Promise<{ content: string; model: string } | null> {
  const key = process.env.DEEPINFRA_API_KEY?.trim();
  const tag = options.tag || 'llm';
  if (!key) {
    console.warn(`[${tag}] DEEPINFRA_API_KEY is not set`);
    return null;
  }

  for (const provider of resolveProviders(options.models)) {
    try {
      const res = await fetch(DEEPINFRA_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: provider.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.4,
          max_tokens: options.maxTokens ?? 4096,
          ...(options.json && provider.supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 40_000),
      });

      if (!res.ok) {
        console.warn(`[${tag}] ${provider.name} HTTP ${res.status}`, (await res.text().catch(() => '')).slice(0, 200));
        continue;
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        console.warn(`[${tag}] ${provider.name} returned empty content`);
        continue;
      }
      // A cut-off answer is broken JSON / half a result; try the next model instead.
      if (choice.finish_reason === 'length') {
        console.warn(`[${tag}] ${provider.name} hit the token limit`);
        continue;
      }
      if (options.json && parseJsonObject(content) === null) {
        console.warn(`[${tag}] ${provider.name} returned invalid or empty JSON`);
        continue;
      }
      if (options.accept && !options.accept(content)) {
        console.warn(`[${tag}] ${provider.name} answer rejected as incomplete`);
        continue;
      }

      return { content, model: provider.model };
    } catch (err) {
      console.warn(`[${tag}] ${provider.name} failed:`, err);
    }
  }

  return null;
}

/**
 * Parses a non-empty JSON object/array from a model answer, tolerating a ```json fence
 * or text around it. Returns null when there is nothing usable.
 */
export function parseJsonObject(content: string): any | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const text = (fenced ? fenced[1] : content).trim();
  const candidates = [text, text.match(/\{[\s\S]*\}/)?.[0], text.match(/\[[\s\S]*\]/)?.[0]];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed !== null && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export interface EmbedOptions {
  texts: string[];
  /** Embedding model ids to try in order (from admin settings). */
  models: string[];
  /** Texts per request. */
  batchSize?: number;
  timeoutMs?: number;
  tag?: string;
}

/**
 * Embeds texts with the first model that answers for every batch, so all vectors share one
 * space. Returns null when every model fails. Never logs the texts.
 */
export async function embed(options: EmbedOptions): Promise<{ vectors: number[][]; model: string } | null> {
  const key = process.env.DEEPINFRA_API_KEY?.trim();
  const tag = options.tag || 'embed';
  if (!key) {
    console.warn(`[${tag}] DEEPINFRA_API_KEY is not set`);
    return null;
  }
  if (options.texts.length === 0) return { vectors: [], model: options.models[0] ?? '' };

  const batchSize = options.batchSize ?? 64;
  for (const model of options.models) {
    try {
      const vectors: number[][] = [];
      for (let i = 0; i < options.texts.length; i += batchSize) {
        const input = options.texts.slice(i, i + batchSize);
        const res = await fetch(DEEPINFRA_EMBEDDINGS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, input, encoding_format: 'float' }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rows: Array<{ index: number; embedding: number[] }> = data?.data ?? [];
        if (rows.length !== input.length || rows.some((r) => !Array.isArray(r.embedding) || r.embedding.length === 0)) {
          throw new Error('incomplete embeddings');
        }
        rows.sort((a, b) => a.index - b.index).forEach((r) => vectors.push(r.embedding));
      }
      return { vectors, model };
    } catch (err) {
      console.warn(`[${tag}] ${model} failed:`, (err as Error)?.message);
    }
  }
  return null;
}
