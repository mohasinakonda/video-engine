/**
 * voice-server.ts — server-only helpers for the /voice feature.
 *
 * - Voice model records live in the `ai_models` Supabase table with an id
 *   prefixed `voice-` (zero-migration convention; see admin/models Voice tab).
 * - For voice models, `credit_cost` means CHARACTERS PER 1 CREDIT and the
 *   charge is Math.max(1, Math.ceil(chars / charsPerCredit)).
 */

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  deductCreditsRemote,
  grantCreditsRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import { calculateVoiceCredits, MAX_CHUNK_CHARS } from '@/lib/voice-chunker';

export interface VoiceModelRecord {
  id: string;
  name: string;
  modelId: string;
  description?: string;
  /** Characters per 1 credit (admin-configurable). */
  charsPerCredit: number;
  allowedPlans: string[];
  isDefault: boolean;
  isActive: boolean;
}

function mapRow(row: any): VoiceModelRecord {
  return {
    id: row.id,
    name: row.name,
    modelId: row.model_id,
    description: row.description || undefined,
    charsPerCredit: Math.max(1, Math.floor(Number(row.credit_cost) || 2000)),
    allowedPlans: Array.isArray(row.allowed_plans) ? row.allowed_plans : [],
    isDefault: Boolean(row.is_default),
    isActive: row.is_active !== false,
  };
}

/** Fetch active voice model records (id LIKE 'voice-%'). */
export async function fetchVoiceModelsRemote(client?: any): Promise<VoiceModelRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = client || createServerClient();
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .like('id', 'voice-%')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapRow);
  } catch (err) {
    console.warn('[voice] fetchVoiceModelsRemote failed:', err);
    return [];
  }
}

/** Built-in fallback engines when Supabase has no voice models configured. */
export const FALLBACK_VOICE_MODELS: VoiceModelRecord[] = [
  {
    id: 'voice-inworld-max',
    name: 'Inworld Max',
    modelId: 'inworld-ai/inworld-tts-1.5-max',
    description: 'Flagship expressive voice engine. Best quality.',
    charsPerCredit: 2000,
    allowedPlans: [],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'voice-inworld-mini',
    name: 'Inworld Mini',
    modelId: 'inworld-ai/inworld-tts-1.5-mini',
    description: 'Faster, lighter engine for drafts.',
    charsPerCredit: 4000,
    allowedPlans: [],
    isDefault: false,
    isActive: true,
  },
];

export async function resolveVoiceModel(
  modelId: string | undefined,
  client?: any
): Promise<VoiceModelRecord> {
  const models = await fetchVoiceModelsRemote(client);
  const pool = models.length > 0 ? models : FALLBACK_VOICE_MODELS;
  if (modelId) {
    const found = pool.find((m) => m.id === modelId || m.modelId === modelId);
    if (found) return found;
  }
  return pool.find((m) => m.isDefault) || pool[0];
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface VoiceAuth {
  userId: string;
  tier: string;
  creditsRemaining: number;
  serverSupabase: any;
}

export async function authenticateVoiceRequest(): Promise<
  { auth: VoiceAuth } | { error: NextResponse }
> {
  if (!isSupabaseConfigured()) {
    return {
      error: NextResponse.json({ error: 'Service not configured.' }, { status: 500 }),
    };
  }
  const serverSupabase = createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };
  }
  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('credits_remaining, is_blocked, block_reason, tier')
    .eq('id', user.id)
    .single();
  if (profile?.is_blocked) {
    return {
      error: NextResponse.json(
        { error: profile.block_reason || 'Your account is suspended.' },
        { status: 403 }
      ),
    };
  }
  return {
    auth: {
      userId: user.id,
      tier: profile?.tier || 'TRIAL',
      creditsRemaining: profile?.credits_remaining ?? 0,
      serverSupabase,
    },
  };
}

// ─── DeepInfra calls ─────────────────────────────────────────────────────────

function deepinfraKey(): string | null {
  return process.env.DEEPINFRA_API_KEY || null;
}

/**
 * Synthesize one chunk via DeepInfra's TTS inference endpoint.
 * Docs: POST https://api.deepinfra.com/v1/inference/{model} with { text, ... },
 * returns raw audio bytes. Extra params (voice, language, speed) are
 * model-specific — see the model's API page on deepinfra.com.
 */
export async function synthesizeVoiceChunk(params: {
  modelId: string;
  text: string;
  voiceId: string;
  language?: string;
  speed?: number;
  tone?: string;
  /** 0-100, maps to delivery intensity in the style direction. */
  expressiveness?: number;
}): Promise<{ audio: ArrayBuffer; mimeType: string }> {
  const apiKey = deepinfraKey();
  if (!apiKey) throw new Error('DEEPINFRA_API_KEY is not configured.');

  const text = params.text.trim();
  if (!text) throw new Error('Chunk text is empty.');
  if (text.length > MAX_CHUNK_CHARS + 200) {
    throw new Error(`Chunk too long (${text.length} chars).`);
  }

  const body: Record<string, unknown> = {
    text,
    voice: params.voiceId,
  };
  if (params.language) body.language = params.language;
  if (params.speed && params.speed !== 1) body.speed = params.speed;
  // Per-section tone becomes natural-language style direction for the request.
  // Expressiveness (0-100, default 50) tunes delivery intensity.
  const styleParts: string[] = [];
  if (params.tone) styleParts.push(`Speak in a ${params.tone} tone.`);
  const expr = typeof params.expressiveness === 'number' ? params.expressiveness : 50;
  if (expr >= 70) styleParts.push('Deliver with high expressiveness and emotional range.');
  else if (expr <= 30) styleParts.push('Keep the delivery subtle and restrained.');
  if (styleParts.length > 0) body.style_prompt = styleParts.join(' ');

  const res = await fetch(
    `https://api.deepinfra.com/v1/inference/${params.modelId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TTS failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const mimeType = res.headers.get('content-type') || 'audio/mpeg';
  return { audio: await res.arrayBuffer(), mimeType };
}

/**
 * Chat completion helper for the chunker's semantic sectioning pass.
 * Best-effort: returns null on any failure so the chunker falls back.
 */
export async function deepinfraChat(system: string, user: string): Promise<string | null> {
  const apiKey = deepinfraKey();
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ─── Plan store (in-memory, single instance) ─────────────────────────────────

export interface VoicePlanRecord {
  planId: string;
  userId: string;
  totalChars: number;
  charsPerCredit: number;
  charged: number;
  createdAt: number;
}

const plans = new Map<string, VoicePlanRecord>();
const PLAN_TTL_MS = 2 * 60 * 60 * 1000;

function sweepPlans() {
  const now = Date.now();
  plans.forEach((p, id) => {
    if (now - p.createdAt > PLAN_TTL_MS) plans.delete(id);
  });
}

export function createVoicePlan(rec: Omit<VoicePlanRecord, 'planId' | 'createdAt'>): string {
  sweepPlans();
  const planId = `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  plans.set(planId, { ...rec, planId, createdAt: Date.now() });
  return planId;
}

export function getVoicePlan(planId: string): VoicePlanRecord | undefined {
  const p = plans.get(planId);
  if (p && Date.now() - p.createdAt > PLAN_TTL_MS) {
    plans.delete(planId);
    return undefined;
  }
  return p;
}

export function deleteVoicePlan(planId: string): void {
  plans.delete(planId);
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export function priceVoiceGeneration(totalChars: number, charsPerCredit: number): number {
  return calculateVoiceCredits(totalChars, charsPerCredit);
}

export async function chargeVoiceCredits(
  auth: VoiceAuth,
  credits: number
): Promise<{ ok: boolean; remaining: number }> {
  if (auth.creditsRemaining < credits) return { ok: false, remaining: auth.creditsRemaining };
  const ok = await deductCreditsRemote(auth.userId, credits, auth.serverSupabase);
  return { ok, remaining: auth.creditsRemaining - (ok ? credits : 0) };
}

export async function refundVoiceCredits(
  auth: VoiceAuth,
  credits: number
): Promise<boolean> {
  if (credits <= 0) return true;
  return grantCreditsRemote(auth.userId, credits, auth.serverSupabase);
}
