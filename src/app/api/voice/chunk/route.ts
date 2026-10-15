import { NextResponse } from 'next/server';
import { MAX_CHUNK_CHARS } from '@/lib/voice-chunker';
import {
  authenticateVoiceRequest,
  resolveVoiceModel,
  synthesizeVoiceChunk,
  getVoicePlan,
} from '@/lib/voice-server';
import { TEXT_LIMITS, clampText } from '@/lib/input-limits';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Fixed preview lines per language — server-side, so previews can't be abused as free TTS. */
const PREVIEW_TEXT_BY_LANG: Record<string, string> = {
  en: 'Hello! This is a preview of my voice. I can narrate your stories, explain your ideas, and bring your scripts to life.',
  hi: 'नमस्ते! यह मेरी आवाज़ का एक नमूना है। मैं आपकी कहानियों और विचारों को जीवंत बना सकता हूँ।',
  es: '¡Hola! Esta es una vista previa de mi voz. Puedo narrar tus historias y dar vida a tus proyectos.',
  fr: 'Bonjour ! Ceci est un aperçu de ma voix. Je peux raconter vos histoires et donner vie à vos projets.',
  de: 'Hallo! Dies ist eine Vorschau meiner Stimme. Ich kann deine Geschichten erzählen und zum Leben erwecken.',
  it: 'Ciao! Questa è un anteprima della mia voce. Posso raccontare le tue storie e dare vita alle tue idee.',
  pt: 'Olá! Esta é uma prévia da minha voz. Posso narrar suas histórias e dar vida aos seus roteiros.',
  ja: 'こんにちは！これは私の声のプレビューです。あなたのストーリーを生き生きと語ることができます。',
  zh: '你好！这是我的声音预览。我可以为你生动地讲述故事和脚本。',
  ar: 'مرحباً! هذه معاينة لصوتي. يمكنني رواية قصصك وإحياء نصوصك.',
  ru: 'Привет! Это пример моего голоса. Я могу озвучивать ваши истории и оживлять ваши тексты.',
};

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
    const totalChunks = Number(body.totalChunks) || 1;
    let text = typeof body.text === 'string' ? body.text : '';

    // Preview path: rate-limited, no plan/credits needed (sample preview)
    if (isPreview) {
      if (!previewAllowed(auth.userId)) {
        return NextResponse.json(
          { error: 'Preview limit reached (20 previews/hr). Try again later.' },
          { status: 429 }
        );
      }
      const langKey = (
        typeof body.languageId === 'string'
          ? body.languageId
          : typeof body.language === 'string'
            ? body.language
            : 'en'
      )
        .toLowerCase()
        .trim();

      const userSample = typeof body.text === 'string' ? body.text.trim() : '';
      if (userSample.length > 0 && userSample.length <= 250) {
        text = userSample;
      } else {
        text = PREVIEW_TEXT_BY_LANG[langKey] || PREVIEW_TEXT_BY_LANG.en;
      }
    } else {
      const plan = planId ? getVoicePlan(planId) : undefined;
      if (!plan || plan.userId !== auth.userId) {
        return NextResponse.json(
          { error: 'Invalid or expired synthesis plan. Please start again.' },
          { status: 400 }
        );
      }
    }

    const model = await resolveVoiceModel(
      typeof body.modelId === 'string' ? body.modelId : undefined,
      auth.serverSupabase
    );

    const isChatterbox = model.modelId.toLowerCase().includes('chatterbox');
    const maxChunkLimit = isChatterbox ? 5000 : MAX_CHUNK_CHARS + 200;

    if (!text.trim() || text.length > maxChunkLimit) {
      return NextResponse.json({ error: `Invalid chunk text (max ${maxChunkLimit} chars).` }, { status: 400 });
    }

    const rawVoicePrompt =
      typeof body.voicePrompt === 'string' && body.voicePrompt.trim()
        ? body.voicePrompt.trim()
        : typeof body.voiceDescription === 'string' && body.voiceDescription.trim()
          ? body.voiceDescription.trim()
          : undefined;
    // Clamp rather than reject: older saved voices may carry longer prompts.
    const voicePrompt = rawVoicePrompt ? clampText(rawVoicePrompt, TEXT_LIMITS.voiceDescription) : undefined;

    const { audio, mimeType, sessionVoiceId } = await synthesizeVoiceChunk({
      modelId: model.modelId,
      text,
      voiceId: typeof body.voiceId === 'string' ? body.voiceId : undefined,
      voicePrompt,
      language: typeof body.language === 'string' ? body.language : undefined,
      languageId: typeof body.languageId === 'string' ? body.languageId : undefined,
      tone: typeof body.tone === 'string' && body.tone ? body.tone : undefined,
      expressiveness: typeof body.expressiveness === 'number' ? body.expressiveness : 50,
      // Voice-style drawer overrides (optional — absent = existing behaviour).
      cfgWeight: typeof body.cfgWeight === 'number' ? body.cfgWeight : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      planId: isPreview ? undefined : planId,
      index,
      totalChunks,
      seed: typeof body.seed === 'number' && Number.isFinite(body.seed) ? body.seed : undefined,
      sessionVoiceId:
        typeof body.sessionVoiceId === 'string' && body.sessionVoiceId.trim()
          ? body.sessionVoiceId.trim()
          : undefined,
    });

    const base64 = Buffer.from(audio).toString('base64');

    return NextResponse.json({
      success: true,
      index,
      audioBase64: base64,
      mimeType,
      bytes: audio.byteLength,
      // Session anchor voice (created on chunk 0 of voice-design jobs) —
      // the client echoes this back on later chunks for voice consistency.
      ...(sessionVoiceId ? { sessionVoiceId } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chunk synthesis failed.';
    console.error('[voice/chunk] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
