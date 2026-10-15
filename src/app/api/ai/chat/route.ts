import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const DEEPINFRA_CHAT_URL = 'https://api.deepinfra.com/v1/openai/chat/completions';
const DEFAULT_MODEL = 'meta-llama/Meta-Llama-3.1-70B-Instruct';

const MAX_MESSAGES = 12;
const MAX_TOTAL_CHARS = 60_000;
const MAX_OUTPUT_TOKENS = 4096;

/** Simple in-memory per-user limit: 60 LLM calls / 10 minutes. */
const callCounts = new Map<string, { count: number; resetAt: number }>();
function allowed(userId: string): boolean {
  const now = Date.now();
  const rec = callCounts.get(userId);
  if (!rec || now > rec.resetAt) {
    callCounts.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (rec.count >= 60) return false;
  rec.count += 1;
  return true;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const out: ChatMessage[] = [];
  let total = 0;
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'system' && role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;
    total += content.length;
    if (total > MAX_TOTAL_CHARS) return null;
    out.push({ role, content });
  }
  return out;
}

/**
 * POST /api/ai/chat
 * Body: { messages, temperature?, max_tokens?, json?: boolean }
 *
 * Authenticated text-LLM proxy (DeepInfra). Keeps the provider key
 * server-side so browser code never handles it.
 */
export async function POST(req: Request) {
  let userId = 'anonymous';
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
      }
      userId = user.id;
    } catch {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
  }

  if (!allowed(userId)) {
    return NextResponse.json({ error: 'Too many AI requests. Please wait a few minutes.' }, { status: 429 });
  }

  const apiKey = process.env.DEEPINFRA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'AI text engine is not configured.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const messages = sanitizeMessages(body?.messages);
  if (!messages) {
    return NextResponse.json({ error: 'Invalid messages.' }, { status: 400 });
  }

  const temperature =
    typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.4;
  const maxTokens =
    typeof body.max_tokens === 'number'
      ? Math.min(Math.max(Math.floor(body.max_tokens), 1), MAX_OUTPUT_TOKENS)
      : MAX_OUTPUT_TOKENS;

  const payload: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (body.json === true) payload.response_format = { type: 'json_object' };

  try {
    const res = await fetch(DEEPINFRA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('[API /api/ai/chat] DeepInfra error', res.status, await res.text().catch(() => ''));
      return NextResponse.json({ error: 'AI request failed.' }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content) {
      return NextResponse.json({ error: 'AI returned an empty response.' }, { status: 502 });
    }
    return NextResponse.json({ content });
  } catch (err) {
    console.error('[API /api/ai/chat] error:', err);
    return NextResponse.json({ error: 'AI request failed.' }, { status: 502 });
  }
}
