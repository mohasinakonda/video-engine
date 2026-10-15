/**
 * voice-server.ts — server-only helpers for the /voice feature.
 *
 * - Voice model records live in the `ai_models` Supabase table with an id
 *   prefixed `voice-` (zero-migration convention; see admin/models Voice tab).
 * - For voice models, `credit_cost` means CHARACTERS PER 1 CREDIT and the
 *   charge is Math.max(1, Math.ceil(chars / charsPerCredit)).
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  deductCreditsRemote,
  grantCreditsRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import { calculateVoiceCredits, MAX_CHUNK_CHARS } from '@/lib/voice-chunker';
import { effectiveTier } from '@/lib/input-limits';
import { humanizeSpeechPayload } from '@/lib/human-speech-engine';

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
    description: 'Premium expressive voice. 23 languages with emotion control.',
    charsPerCredit: 300,
    allowedPlans: [],
    isDefault: true,
    isActive: true,
  },
  {
    id: 'voice-chatterbox-turbo',
    name: 'Chatterbox Turbo',
    modelId: 'ResembleAI/chatterbox-turbo',
    description: 'Faster low-latency engine, English-focused.',
    charsPerCredit: 300,
    allowedPlans: [],
    isDefault: false,
    isActive: false,
  },
  {
    id: 'voice-mimo-v25-tts',
    name: 'MiMo V2.5 (Free)',
    modelId: 'XiaomiMiMo/MiMo-V2.5-tts',
    description: 'Free experimental engine. Quality may vary.',
    charsPerCredit: 400,
    allowedPlans: [],
    isDefault: false,
    isActive: false,
  },
  {
    id: 'voice-mimo-v25-voicedesign',
    name: 'MiMo V2.5 VoiceDesign (Free)',
    modelId: 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign',
    description: 'Design any voice via text description. Supports multi-emotion mixing and director mode.',
    charsPerCredit: 250,
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
  const pool = models.length > 0 ? models : FALLBACK_VOICE_MODELS.filter((m) => m.isActive);
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
    .select('credits_remaining, is_blocked, block_reason, tier, subscription_expires_at')
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
      tier: effectiveTier(profile),
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
 * Upload audio to DeepInfra to create a temporary voice clone anchor.
 */
export async function createDeepinfraVoice(
  name: string,
  audioBuffer: ArrayBuffer,
  apiKey: string
): Promise<string> {
  const form = new FormData();
  form.append('name', name);
  form.append('description', 'Temporary session voice for multi-chunk consistency');
  form.append('files', new Blob([audioBuffer], { type: 'audio/wav' }), 'anchor.wav');

  const res = await fetch('https://api.deepinfra.com/v1/voices/add', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Failed to create voice clone (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data?.voice_id) {
    throw new Error('DeepInfra voice creation did not return voice_id.');
  }

  return data.voice_id;
}

/**
 * Delete a temporary voice clone from DeepInfra.
 */
export async function deleteDeepinfraVoice(
  voiceId: string,
  apiKey: string
): Promise<void> {
  try {
    const res = await fetch(`https://api.deepinfra.com/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      console.warn(`[voice] deleteDeepinfraVoice status ${res.status} for ${voiceId}`);
    } else {
      console.log(`[voice] Cleaned up temporary session voice: ${voiceId}`);
    }
  } catch (err) {
    console.warn(`[voice] deleteDeepinfraVoice error for ${voiceId}:`, err);
  }
}

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
  voicePrompt?: string;
  language?: string;
  languageId?: string;
  tone?: string;
  /** 0-100, maps to Chatterbox exaggeration (0-1). */
  expressiveness?: number;
  /**
   * Optional delivery overrides from the voice-style drawer. When absent,
   * the existing auto behaviour (tone nudges + default temperature) applies
   * unchanged, so requests without style settings are byte-identical.
   */
  cfgWeight?: number;
  temperature?: number;
  planId?: string;
  index?: number;
  totalChunks?: number;
  /**
   * Deterministic sampling seed across chunks to eliminate voice drift,
   * pitch wandering, and tone variance.
   */
  seed?: number;
  /**
   * Session anchor voice ID echoed back by the client (from chunk 0's
   * response). The plan store is in-memory per server instance; on serverless
   * hosting chunk N+1 can land on a different instance than chunk 0 and lose
   * the anchor — so it must travel with the request. Without it, every chunk
   * after the first gets a freshly generated (different) voice.
   */
  sessionVoiceId?: string;
}): Promise<{ audio: ArrayBuffer; mimeType: string; sessionVoiceId?: string }> {
  const apiKey = deepinfraKey();
  if (!apiKey) throw new Error('DEEPINFRA_API_KEY is not configured.');

  const rawText = params.text.trim();
  if (!rawText) throw new Error('Chunk text is empty.');

  const isChatterbox = params.modelId.toLowerCase().includes('chatterbox');
  const maxAllowed = isChatterbox ? 5000 : 1050;
  if (rawText.length > maxAllowed) {
    throw new Error(`Chunk too long (${rawText.length} chars, max ${maxAllowed}).`);
  }

  // Server-side Human Speech Engine: Seamlessly adds natural acoustics & prosody
  const { text: humanizedText, voicePrompt } = humanizeSpeechPayload({
    text: rawText,
    voicePrompt: params.voicePrompt,
    modelId: params.modelId,
    chunkIndex: params.index ?? 0,
  });

  // Clamp safely within provider thresholds
  let text = humanizedText;
  if (!isChatterbox && text.length > 980) {
    text = rawText.length <= 980 ? rawText : rawText.slice(0, 980);
  } else if (isChatterbox && text.length > 5000) {
    text = text.slice(0, 5000);
  }

  const isVoiceDesign = params.modelId.toLowerCase().includes('voicedesign');
  const isMimo = params.modelId.toLowerCase().includes('mimo');
  let targetModelId = params.modelId;
  let body: Record<string, unknown>;

  const plan = params.planId ? getVoicePlan(params.planId) : undefined;
  const isMultiChunk = (params.totalChunks ?? 1) > 1 && !!plan;
  const chunkIndex = params.index ?? 0;
  const totalChunks = params.totalChunks ?? 1;

  // Anchor voice for this session: prefer the client-echoed ID (survives
  // serverless instance hops), fall back to the in-memory plan record.
  const anchorVoiceId = params.sessionVoiceId || plan?.sessionVoiceId;

  const isSavedVoice = Boolean(params.voiceId && params.voiceId.trim());

  // DeepInfra MiMo-V2.5-TTS docs: the style/voice instruction goes in the
  // user message, the text (with (style)/[audio] tags) in the assistant
  // message, and the voice is selected via audio.voice. The endpoint
  // additionally requires top-level `text` and `voice` (422s otherwise).
  const mimoBody = (
    userContent: string,
    voice: string,
    audioVoice?: string
  ): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      text,
      voice,
      messages: [
        { role: 'user', content: userContent },
        { role: 'assistant', content: text },
      ],
      audio: audioVoice ? { format: 'wav', voice: audioVoice } : { format: 'wav' },
    };
    if (typeof params.seed === 'number' && Number.isFinite(params.seed)) {
      payload.seed = Math.floor(params.seed);
    }
    return payload;
  };
  const defaultInstruct = voicePrompt || 'A natural, clear, and engaging voice.';

  if (isChatterbox) {
    targetModelId = params.modelId;
    const expr = typeof params.expressiveness === 'number'
      ? Math.min(100, Math.max(0, params.expressiveness))
      : 50;
    const exaggeration = Math.round((expr / 100) * 100) / 100;

    const chatterboxPayload: Record<string, unknown> = {
      text,
      language_id: params.languageId || toLanguageId(params.language) || 'en',
      exaggeration,
      temperature: typeof params.temperature === 'number' && Number.isFinite(params.temperature)
        ? Math.min(1, Math.max(0, params.temperature))
        : 0.7,
    };

    // Style-drawer override: only sent when the user picked a style / moved a slider.
    if (typeof params.cfgWeight === 'number' && Number.isFinite(params.cfgWeight)) {
      chatterboxPayload.cfg_weight = Math.min(1, Math.max(0.1, params.cfgWeight));
    }

    if (isSavedVoice && params.voiceId) {
      chatterboxPayload.voice_id = params.voiceId.trim();
    }

    if (typeof params.seed === 'number' && Number.isFinite(params.seed)) {
      chatterboxPayload.seed = Math.floor(params.seed);
    }

    body = chatterboxPayload;
  } else if (isSavedVoice) {
    // User selected a persistent custom voice with MiMo: route directly to voiceclone for ALL chunks!
    targetModelId = 'XiaomiMiMo/MiMo-V2.5-tts-voiceclone';
    const vid = params.voiceId!.trim();
    body = mimoBody(defaultInstruct, vid, vid);
  } else if (isVoiceDesign) {
    if (isMultiChunk && chunkIndex > 0 && anchorVoiceId) {
      // Continuation chunk in multi-chunk job: use voiceclone with session anchor voice
      targetModelId = 'XiaomiMiMo/MiMo-V2.5-tts-voiceclone';
      body = mimoBody(defaultInstruct, anchorVoiceId, anchorVoiceId);
    } else {
      // Chunk 0 or standalone single chunk: use voicedesign.
      body = mimoBody(defaultInstruct, defaultInstruct);
    }
  } else if (isMimo) {
    // Base MiMo-V2.5-TTS: same messages format; built-in voice via audio.voice.
    const tone = (params.tone || '').toLowerCase();
    const styleCue = tone ? `Narrate in a ${tone} tone. ` : '';
    body = mimoBody(`${styleCue}${defaultInstruct}`, 'mimo_default', 'mimo_default');
  } else {
    const expr = typeof params.expressiveness === 'number'
      ? Math.min(100, Math.max(0, params.expressiveness))
      : 50;
    let exaggeration = expr / 100;

    const tone = (params.tone || '').toLowerCase();
    if (HIGH_ENERGY_TONES.has(tone)) exaggeration = Math.min(1, exaggeration + 0.15);
    else if (LOW_ENERGY_TONES.has(tone)) exaggeration = Math.max(0, exaggeration - 0.15);

    // Style-drawer overrides win over the auto cfg/temperature when provided.
    const cfgWeight = typeof params.cfgWeight === 'number' && Number.isFinite(params.cfgWeight)
      ? Math.min(1, Math.max(0.1, params.cfgWeight))
      : exaggeration >= 0.65 ? 0.3 : 0.5;

    const fallbackBody: Record<string, unknown> = {
      text,
      language_id: params.languageId || toLanguageId(params.language),
      exaggeration: Math.round(exaggeration * 100) / 100,
      cfg_weight: cfgWeight,
    };
    // temperature was never sent on this path before — only add when overridden.
    if (typeof params.temperature === 'number' && Number.isFinite(params.temperature)) {
      fallbackBody.temperature = Math.min(1, Math.max(0, params.temperature));
    }
    body = fallbackBody;
  }

  const res = await fetch(
    `https://api.deepinfra.com/v1/inference/${targetModelId}`,
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

  let audio: ArrayBuffer;
  let mimeType = 'audio/wav';

  if (contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '');
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`TTS parse error: ${rawText.slice(0, 200)}`);
    }

    if (data?.error || data?.detail || data?.message) {
      const msg = data.error || data.detail || data.message;
      throw new Error(`TTS error: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }

    if (typeof data?.audio === 'string' && data.audio.length > 0) {
      const match = data.audio.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
      } else if (data.output_format) {
        mimeType = `audio/${data.output_format}`;
      }

      const cleanBase64 = data.audio.replace(/^data:[^;]+;base64,/, '').trim();
      const buf = Buffer.from(cleanBase64, 'base64');
      if (buf.byteLength < 1024) {
        throw new Error(`TTS returned invalid audio payload (${buf.byteLength} bytes).`);
      }
      audio = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else {
      throw new Error(`TTS response missing audio data: ${rawText.slice(0, 200)}`);
    }
  } else {
    audio = await res.arrayBuffer();
    if (audio.byteLength < 1024) {
      throw new Error(
        `TTS returned invalid audio (${audio.byteLength} bytes, ${contentType || 'unknown type'}).`
      );
    }
    if (contentType.startsWith('audio/')) {
      mimeType = contentType;
    }
  }


  // If this was Chunk 0 of a multi-chunk dynamic VoiceDesign session (not a persistent saved voice), register anchor audio clone.
  // The new anchor ID is returned to the client, which echoes it back on
  // later chunks — the in-memory plan record alone is not reliable on
  // serverless hosting (chunk N+1 may hit a different instance than chunk 0).
  let newSessionVoiceId: string | undefined;
  if (!isSavedVoice && isVoiceDesign && isMultiChunk && chunkIndex === 0 && params.planId) {
    try {
      newSessionVoiceId = await createDeepinfraVoice(
        `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        audio,
        apiKey
      );
      updateVoicePlanSessionVoice(params.planId, newSessionVoiceId);
      console.log(`[voice] Anchor voice clone registered: ${newSessionVoiceId} for plan ${params.planId}`);
    } catch (cloneErr) {
      console.warn('[voice] Failed to register session voice clone (will fallback to voicedesign):', cloneErr);
    }
  }

  // If this was the last chunk of a temporary session, clean up the temporary session voice
  if (!isSavedVoice && isMultiChunk && chunkIndex === totalChunks - 1 && anchorVoiceId) {
    const toDelete = anchorVoiceId;
    if (plan?.sessionVoiceId) plan.sessionVoiceId = undefined;
    deleteDeepinfraVoice(toDelete, apiKey).catch((err) => {
      console.warn('[voice] Failed to delete session voice clone on completion:', err);
    });
  }

  return { audio, mimeType, sessionVoiceId: newSessionVoiceId };
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
  sessionVoiceId?: string;
}

const PLAN_TTL_MS = 2 * 60 * 60 * 1000;

interface GlobalVoiceStore {
  plans: Map<string, VoicePlanRecord>;
  cancelled: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __voiceStore: GlobalVoiceStore | undefined;
}

function getVoiceStore(): GlobalVoiceStore {
  if (!globalThis.__voiceStore) {
    globalThis.__voiceStore = {
      plans: new Map(),
      cancelled: new Set(),
    };
  }
  return globalThis.__voiceStore;
}

function getSecret(): string {
  // No hard-coded fallback: a source-visible secret would let anyone forge plan tokens.
  const secret =
    process.env.VOICE_PLAN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DEEPINFRA_API_KEY;
  if (!secret) {
    throw new Error('Voice plan signing secret is not configured (set VOICE_PLAN_SECRET).');
  }
  return secret;
}

function signPayload(dataStr: string): string {
  return crypto.createHmac('sha256', getSecret()).update(dataStr).digest('hex').slice(0, 32);
}

function sweepPlans() {
  const store = getVoiceStore();
  const now = Date.now();
  const apiKey = deepinfraKey();
  store.plans.forEach((p, id) => {
    if (now - p.createdAt > PLAN_TTL_MS) {
      if (p.sessionVoiceId && apiKey) {
        deleteDeepinfraVoice(p.sessionVoiceId, apiKey).catch(() => { });
      }
      store.plans.delete(id);
    }
  });
}

export function updateVoicePlanSessionVoice(planId: string, voiceId: string): void {
  const store = getVoiceStore();
  const p = store.plans.get(planId);
  if (p) {
    p.sessionVoiceId = voiceId;
  }
}

export function createVoicePlan(rec: Omit<VoicePlanRecord, 'planId' | 'createdAt'>): string {
  sweepPlans();
  const createdAt = Date.now();
  const payload = {
    userId: rec.userId,
    totalChars: rec.totalChars,
    charsPerCredit: rec.charsPerCredit,
    charged: rec.charged,
    createdAt,
    nonce: Math.random().toString(36).slice(2, 8),
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(b64);
  const planId = `vp_${b64}.${sig}`;

  const store = getVoiceStore();
  store.plans.set(planId, { ...rec, planId, createdAt });
  return planId;
}

export function getVoicePlan(planId: string): VoicePlanRecord | undefined {
  if (!planId || typeof planId !== 'string') return undefined;

  const store = getVoiceStore();
  if (store.cancelled.has(planId)) return undefined;

  // 1. Check in-memory global store
  const p = store.plans.get(planId);
  if (p) {
    if (Date.now() - p.createdAt > PLAN_TTL_MS) {
      store.plans.delete(planId);
      return undefined;
    }
    return p;
  }

  // 2. Fallback: verify and decode signed token (resilient across Next.js webpack isolated bundles and serverless instances)
  if (planId.startsWith('vp_') && planId.includes('.')) {
    try {
      const withoutPrefix = planId.slice(3);
      const dotIndex = withoutPrefix.indexOf('.');
      if (dotIndex === -1) return undefined;

      const b64 = withoutPrefix.slice(0, dotIndex);
      const sig = withoutPrefix.slice(dotIndex + 1);

      const expectedSig = signPayload(b64);
      if (sig !== expectedSig) return undefined;

      const jsonStr = Buffer.from(b64, 'base64url').toString('utf8');
      const payload = JSON.parse(jsonStr);

      if (
        !payload ||
        typeof payload.userId !== 'string' ||
        typeof payload.totalChars !== 'number' ||
        typeof payload.charsPerCredit !== 'number' ||
        typeof payload.charged !== 'number' ||
        typeof payload.createdAt !== 'number'
      ) {
        return undefined;
      }

      if (Date.now() - payload.createdAt > PLAN_TTL_MS) {
        return undefined;
      }

      const recovered: VoicePlanRecord = {
        planId,
        userId: payload.userId,
        totalChars: payload.totalChars,
        charsPerCredit: payload.charsPerCredit,
        charged: payload.charged,
        createdAt: payload.createdAt,
      };

      store.plans.set(planId, recovered);
      return recovered;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function deleteVoicePlan(planId: string): void {
  const store = getVoiceStore();
  const plan = store.plans.get(planId);
  if (plan?.sessionVoiceId) {
    const apiKey = deepinfraKey();
    if (apiKey) {
      deleteDeepinfraVoice(plan.sessionVoiceId, apiKey).catch(() => { });
    }
  }
  store.plans.delete(planId);
  store.cancelled.add(planId);
}

// ─── Credits ─────────────────────────────────────────────────────────────────

/** Max cloned/designed voices a user may keep. Delete one to free a slot. */
export const MAX_CUSTOM_VOICES_PER_USER = 5;
/** Credits charged each time a voice is cloned. Refunded if cloning fails. */
export const CLONE_COST_CREDITS = 15;

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
