'use client';

/**
 * Minimal OpenAI-shaped text client that proxies to the authenticated
 * /api/ai/chat route. No provider keys ever reach the browser.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCreateParams {
  /** Ignored — the server picks the model. Kept for call-site compatibility. */
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface LLMCompletion {
  choices: { message: { content: string } }[];
}

export interface LLMClient {
  chat: {
    completions: {
      create(params: LLMCreateParams): Promise<LLMCompletion>;
    };
  };
}

export function getLLMClient(): LLMClient {
  return {
    chat: {
      completions: {
        async create(params: LLMCreateParams): Promise<LLMCompletion> {
          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: params.messages,
              temperature: params.temperature,
              max_tokens: params.max_tokens,
              json: params.response_format?.type === 'json_object',
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || typeof data.content !== 'string') {
            throw new Error(data.error || `AI request failed (HTTP ${res.status})`);
          }
          return { choices: [{ message: { content: data.content } }] };
        },
      },
    },
  };
}
