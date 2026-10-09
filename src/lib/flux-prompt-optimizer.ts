import OpenAI from 'openai';

/**
 * Exact FLUX.1-schnell Prompt Optimization System Prompt
 * Optimized specifically for 4-step distilled diffusion with T5-XXL language model.
 */
export const FLUX_REWRITE_SYSTEM_PROMPT = `You are an expert AI Prompt Engineer for FLUX.1-schnell. Rewrite the incoming user request into a single descriptive scene paragraph optimized for a 4-step distilled diffusion model.

Rules:
1. Output ONLY the raw final prompt. Never include introductions, explanations, quotes, or markdown wrappers.
2. The very first phrase MUST define the medium and camera setup (e.g., "A 35mm cinematic film still of...", "A clean vector illustration of...", "A macro editorial photograph of...").
3. Explicitly describe spatial arrangement (foreground, center, background).
4. Specify physical textures, surfaces, and tangible light sources (direction, color, shadows).
5. STRICTLY REMOVE all buzzwords: "photorealistic", "hyperrealistic", "8k", "4k", "masterpiece", "ultra-detailed", "unreal engine".
6. Target word count: 50 to 75 words. Write in 100% positive visual descriptions.`;

/**
 * Regex to purge legacy SD/CLIP buzzwords that degrade FLUX T5-XXL embeddings
 */
const BUZZWORD_REGEX = /\b(8k(?: resolution)?|4k(?: resolution)?|photorealistic|hyperrealistic|masterpiece|ultra-detailed|unreal engine|trending on artstation)\b/gi;

/**
 * Clean raw text from quotes, code fences, and lingering hype buzzwords
 */
export function sanitizeFluxPrompt(text: string): string {
  if (!text) return '';
  return text
    .replace(/^["'`]|["'`]$/g, '') // Leading/trailing quotes
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(BUZZWORD_REGEX, '') // Legacy buzzwords
    .replace(/,\s*,+/g, ',') // Duplicate commas
    .replace(/\s+/g, ' ') // Multiple spaces
    .trim();
}

/**
 * Resolves the fastest, most cost-effective OpenAI-compatible LLM client and model
 * Supports Together AI, DeepInfra, Groq, and OpenAI.
 */
function resolveLlmConfig(): { client: OpenAI; model: string } | null {
  // 1. Explicit AI Provider config (Together AI or DeepInfra / Custom)
  const providerKey = process.env.AI_PROVIDER_API_KEY || process.env.TOGETHER_API_KEY;
  const providerBaseUrl = process.env.AI_PROVIDER_BASE_URL || (process.env.TOGETHER_API_KEY ? 'https://api.together.xyz/v1' : undefined);

  if (providerKey) {
    return {
      client: new OpenAI({
        apiKey: providerKey,
        baseURL: providerBaseUrl || 'https://api.together.xyz/v1',
      }),
      model: process.env.AI_REWRITE_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    };
  }

  // 2. DeepInfra (Standard OpenAI compatibility endpoint)
  const deepinfraKey = process.env.DEEPINFRA_API_KEY;
  if (deepinfraKey && deepinfraKey.trim()) {
    return {
      client: new OpenAI({
        apiKey: deepinfraKey.trim(),
        baseURL: 'https://api.deepinfra.com/v1/openai',
      }),
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    };
  }

  // 3. Groq (Ultra-fast ~100ms Llama-3.1)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim()) {
    return {
      client: new OpenAI({
        apiKey: groqKey.trim(),
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      model: 'llama-3.1-8b-instant',
    };
  }

  // 4. OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim()) {
    return {
      client: new OpenAI({
        apiKey: openaiKey.trim(),
      }),
      model: 'gpt-4o-mini',
    };
  }

  return null;
}

export interface OptimizeFluxPromptOptions {
  stylePrompt?: string;
  skipLlm?: boolean;
}

/**
 * Optimizes a raw prompt specifically for FLUX.1-schnell:
 * 1. Executes lightweight LLM completion with the strict FLUX system prompt.
 * 2. Strips legacy buzzwords and code fences.
 * 3. Gracefully falls back to structured sanitized prompt if no LLM key is configured.
 */
export async function optimizeFluxPrompt(
  rawPrompt: string,
  options?: OptimizeFluxPromptOptions
): Promise<string> {
  const trimmed = (rawPrompt || '').trim();
  if (!trimmed) return '';

  // If user explicitly bypassed LLM or prompt is already formatted
  if (options?.skipLlm) {
    return sanitizeFluxPrompt(trimmed);
  }

  const llm = resolveLlmConfig();
  if (llm) {
    try {
      const userMessage = options?.stylePrompt
        ? `Request: ${trimmed}\nStyle guideline: ${options.stylePrompt.trim()}`
        : trimmed;

      const completion = await llm.client.chat.completions.create({
        model: llm.model,
        messages: [
          { role: 'system', content: FLUX_REWRITE_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 250,
        temperature: 0.4,
      });

      const responseText = completion.choices[0]?.message?.content?.trim();
      if (responseText) {
        const sanitized = sanitizeFluxPrompt(responseText);
        if (sanitized.length > 15) {
          return sanitized;
        }
      }
    } catch (err) {
      console.warn('[optimizeFluxPrompt] LLM rewrite failed, falling back to heuristic cleanup:', err);
    }
  }

  // Fallback: heuristic cleanup ensuring camera/medium tag at index 0 and removing buzzwords
  let fallback = sanitizeFluxPrompt(trimmed);
  if (options?.stylePrompt) {
    const style = sanitizeFluxPrompt(options.stylePrompt);
    if (!fallback.toLowerCase().includes(style.toLowerCase().slice(0, 20))) {
      fallback = `${fallback}. ${style}`;
    }
  }

  // If prompt doesn't start with a photographic/artistic medium, prepend a clean 35mm still descriptor
  const startsWithMedium = /^(a|an)\s+(35mm|cinematic|film|photograph|vector|macro|editorial|studio|wide-angle|portrait)/i.test(fallback);
  if (!startsWithMedium) {
    fallback = `A 35mm cinematic film still of ${fallback}`;
  }

  return sanitizeFluxPrompt(fallback);
}
