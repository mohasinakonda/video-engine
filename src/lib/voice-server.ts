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
    id: 'voice-chatterbox-multilingual',
    name: 'Chatterbox Multilingual',
    modelId: 'ResembleAI/chatterbox-multilingual',
    description: 'Flagship expressive engine. 23 languages, emotion control.',
    charsPerCredit: 2000,
    allowedPlans: [],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'voice-chatterbox-turbo',
    name: 'Chatterbox Turbo',
    modelId: 'ResembleAI/chatterbox-turbo',
    description: 'Faster low-latency engine, English-focused.',
    charsPerCredit: 4000,
    allowedPlans: [],
    isDefault: false,
    isActive: true,
  },
  {
    id: 'voice-mimo-v25-tts',
    name: 'MiMo V2.5 (Free)',
    modelId: 'XiaomiMiMo/MiMo-V2.5-tts',
    description: 'Free experimental engine. Quality may vary.',
    charsPerCredit: 10000,
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
 * Display language name → Chatterbox language_id code.
 * Falls back to 'en' for unknown names.
 */
const LANGUAGE_ID_MAP: Record<string, string> = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', dutch: 'nl', polish: 'pl', russian: 'ru', turkish: 'tr',
  hindi: 'hi', arabic: 'ar', japanese: 'ja', korean: 'ko', chinese: 'zh',
  danish: 'da', greek: 'el', finnish: 'fi', hebrew: 'he', malay: 'ms',
  norwegian: 'no', swedish: 'sv', swahili: 'sw',
};

export function toLanguageId(language: string | undefined): string {
  if (!language) return 'en';
  const code = LANGUAGE_ID_MAP[language.trim().toLowerCase()];
  return code || 'en';
}

/** Tones that call for more emotional delivery → exaggeration boost. */
const HIGH_ENERGY_TONES = new Set([
  'excited', 'dramatic', 'angry', 'cheerful', 'laugh', 'thrilled', 'passionate',
]);
/** Tones that call for restraint → exaggeration reduction. */
const LOW_ENERGY_TONES = new Set([
  'calm', 'solemn', 'serious', 'sad', 'whisper', 'whispers', 'subtle', 'gentle',
]);

/**
 * Synthesize one chunk via DeepInfra's TTS inference endpoint.
 * Docs: POST https://api.deepinfra.com/v1/inference/{model} with { text, ... },
 * returns raw audio bytes.
 *
 * Chatterbox-native params:
 *  - exaggeration (0-1): emotion/expression intensity. Mapped from the
 *    UI expressiveness slider (0-100), nudged by per-section tone.
 *  - cfg_weight: default 0.5; lowered to ~0.3 for highly exaggerated
 *    (dramatic) delivery per Resemble AI's tuning guidance.
 *  - language_id: e.g. "en", "es", "hi".
 * Emotion tags ([whisper], [laugh], …) stay inline in the text — Chatterbox
 * performs them natively.
 */
export async function synthesizeVoiceChunk(params: {
  modelId: string;
  text: string;
  voiceId?: string;
  language?: string;
  languageId?: string;
  tone?: string;
  /** 0-100, maps to Chatterbox exaggeration (0-1). */
  expressiveness?: number;
}): Promise<{ audio: ArrayBuffer; mimeType: string }> {
  const apiKey = deepinfraKey();
  if (!apiKey) throw new Error('DEEPINFRA_API_KEY is not configured.');

  const text = params.text.trim();
  if (!text) throw new Error('Chunk text is empty.');
  if (text.length > MAX_CHUNK_CHARS + 200) {
    throw new Error(`Chunk too long (${text.length} chars).`);
  }

  const expr = typeof params.expressiveness === 'number'
    ? Math.min(100, Math.max(0, params.expressiveness))
    : 50;
  let exaggeration = expr / 100;

  // Per-section tone nudges delivery intensity (tags themselves stay inline).
  const tone = (params.tone || '').toLowerCase();
  if (HIGH_ENERGY_TONES.has(tone)) exaggeration = Math.min(1, exaggeration + 0.15);
  else if (LOW_ENERGY_TONES.has(tone)) exaggeration = Math.max(0, exaggeration - 0.15);

  // Resemble AI guidance: dramatic delivery → lower cfg for better pacing.
  const cfgWeight = exaggeration >= 0.65 ? 0.3 : 0.5;

  const body: Record<string, unknown> = {
    text,
    language_id: params.languageId || toLanguageId(params.language),
    exaggeration: Math.round(exaggeration * 100) / 100,
    cfg_weight: cfgWeight,
  };
  // voiceId reserved for reference-audio cloning (future); not sent for now.

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

  const contentType = res.headers.get('content-type') || '';

  // Guard: some providers return a JSON error payload with HTTP 200.
  // Encoding that as "audio" produces a silent file — surface it instead.
  if (contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    let msg = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error || parsed?.message || parsed?.detail || msg;
    } catch {
      /* keep raw text */
    }
    throw new Error(`TTS error: ${typeof msg === 'string' ? msg : 'unexpected response'}`);
  }

  const audio = await res.arrayBuffer();

  // Guard: a few hundred bytes cannot be real speech audio — fail loudly
  // instead of producing a silent download.
  if (audio.byteLength < 1024) {
    throw new Error(
      `TTS returned invalid audio (${audio.byteLength} bytes, ${contentType || 'unknown type'}).`
    );
  }

  const mimeType = contentType.startsWith('audio/') ? contentType : 'audio/wav';
  console.log(
    `[voice] chunk synthesized: ${audio.byteLength} bytes, ${mimeType} (${params.modelId})`
  );
  return { audio, mimeType };
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
