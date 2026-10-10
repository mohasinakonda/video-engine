import { NextResponse } from 'next/server';
import { MAX_CHUNK_CHARS } from '@/lib/voice-chunker';
import {
  authenticateVoiceRequest,
  resolveVoiceModel,
  synthesizeVoiceChunk,
  getVoicePlan,
} from '@/lib/voice-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Fixed preview line — server-side, so previews can't be abused as free TTS. */
const PREVIEW_TEXT =
  'Hello! This is a preview of my voice. I can narrate your stories, explain your ideas, and bring your scripts to life.';

/** Simple in-memory per-user preview rate limit: 20 previews/hour. */
const previewCounts = new Map<string, { count: number; resetAt: number }>();

function previewAllowed(userId: string): boolean {
  const now = Date.now();
  const rec = previewCounts.get(userId);
  if (!rec || now > rec.resetAt) {
    previewCounts.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (rec.count >= 20) return false;
  rec.count += 1;
  return true;
}

/**
 * POST /api/voice/chunk
 * Body: { planId, index, text, tone?, voiceId, modelId?, language?, speed? }
 *
 * Synthesizes ONE chunk and returns base64 audio. The client drives the
 * loop, shows percentage progress, and assembles the final MP3 locally.
 * Requires a valid planId (credits were deducted at plan time).
 */
export async function POST(req: Request) {
  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    const auth = gate.auth;

    const body = await req.json().catch(() => ({}));
    const isPreview = body.preview === true;
    const planId = typeof body.planId === 'string' ? body.planId : '';
    const index = Number(body.index) || 0;
    let text = typeof body.text === 'string' ? body.text : '';

    // Preview path: fixed sample text, rate-limited, no plan/credits needed.
    if (isPreview) {
      if (!previewAllowed(auth.userId)) {
        return NextResponse.json(
          { error: 'Preview limit reached. Try again later.' },
          { status: 429 }
        );
      }
      text = PREVIEW_TEXT;
    } else {
      const plan = planId ? getVoicePlan(planId) : undefined;
      if (!plan || plan.userId !== auth.userId) {
        return NextResponse.json(
          { error: 'Invalid or expired synthesis plan. Please start again.' },
          { status: 400 }
        );
      }
    }

    if (!text.trim() || text.length > MAX_CHUNK_CHARS + 200) {
      return NextResponse.json({ error: 'Invalid chunk text.' }, { status: 400 });
    }

    const model = await resolveVoiceModel(
      typeof body.modelId === 'string' ? body.modelId : undefined,
      auth.serverSupabase
    );

    const { audio, mimeType } = await synthesizeVoiceChunk({
      modelId: model.modelId,
      text,
      voiceId: typeof body.voiceId === 'string' ? body.voiceId : undefined,
      language: typeof body.language === 'string' ? body.language : undefined,
      languageId: typeof body.languageId === 'string' ? body.languageId : undefined,
      tone: typeof body.tone === 'string' && body.tone ? body.tone : undefined,
      expressiveness: typeof body.expressiveness === 'number' ? body.expressiveness : 50,
    });

    const base64 = Buffer.from(audio).toString('base64');

    return NextResponse.json({
      success: true,
      index,
      audioBase64: base64,
      mimeType,
      bytes: audio.byteLength,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chunk synthesis failed.';
    console.error('[voice/chunk] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
