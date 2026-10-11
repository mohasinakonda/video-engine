import { NextResponse } from 'next/server';
import { buildChunkPlan } from '@/lib/voice-chunker';
import {
  authenticateVoiceRequest,
  resolveVoiceModel,
  deepinfraChat,
  createVoicePlan,
  priceVoiceGeneration,
  chargeVoiceCredits,
  refundVoiceCredits,
  type VoiceAuth,
} from '@/lib/voice-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/voice/plan
 * Body: { text, modelId?, mode: 'clip' | 'longform' }
 *
 * Runs the 4-layer chunker, prices the job with
 * Math.max(1, Math.ceil(chars / charsPerCredit)), deducts credits upfront,
 * and returns the chunk plan. The client then drives synthesis chunk by
 * chunk via /api/voice/chunk (robust for hour-long jobs: no long-lived
 * request, resumable, cancellable with pro-rata refund).
 */
export async function POST(req: Request) {
  let charged = 0;
  let auth: VoiceAuth | null = null;

  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    auth = gate.auth;

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const mode = body.mode === 'longform' ? 'longform' : 'clip';

    if (!text) {
      return NextResponse.json({ error: 'Script text is required.' }, { status: 400 });
    }

    const maxChars = mode === 'longform' ? 500_000 : 5_000;
    if (text.length > maxChars) {
      return NextResponse.json(
        { error: `Script too long (max ${maxChars.toLocaleString()} characters in ${mode} mode).` },
        { status: 400 }
      );
    }

    const model = await resolveVoiceModel(
      typeof body.modelId === 'string' ? body.modelId : undefined,
      auth.serverSupabase
    );

    // Plan restriction check.
    if (model.allowedPlans.length > 0 && !model.allowedPlans.includes(auth.tier)) {
      return NextResponse.json(
        {
          error: `The "${model.name}" engine is exclusive to ${model.allowedPlans.join(' and ')} plans.`,
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    // Build the chunk plan (semantic sectioning is best-effort inside).
    const plan = await buildChunkPlan(text, deepinfraChat);
    if (plan.chunks.length === 0) {
      return NextResponse.json({ error: 'Could not build a synthesis plan from this text.' }, { status: 400 });
    }

    const credits = priceVoiceGeneration(plan.totalChars, model.charsPerCredit);
    const charge = await chargeVoiceCredits(auth, credits);
    if (!charge.ok) {
      return NextResponse.json(
        {
          error: `Insufficient credits. This narration needs ${credits} credits. You have ${auth.creditsRemaining}.`,
        },
        { status: 402 }
      );
    }
    charged = credits;

    const planId = createVoicePlan({
      userId: auth.userId,
      totalChars: plan.totalChars,
      charsPerCredit: model.charsPerCredit,
      charged: credits,
    });

    return NextResponse.json({
      success: true,
      planId,
      chunks: plan.chunks.map((c) => ({ index: c.index, text: c.text, tone: c.tone || null })),
      totalChunks: plan.chunks.length,
      totalChars: plan.totalChars,
      creditsCharged: credits,
      creditsRemaining: charge.remaining,
      engine: { id: model.id, name: model.name },
    });
  } catch (err) {
    console.error('[voice/plan] error:', err);
    // Refund if we charged but failed before returning a plan.
    if (charged > 0 && auth) {
      try {
        await refundVoiceCredits(auth, charged);
      } catch {
        /* best effort */
      }
    }
    return NextResponse.json({ error: 'Failed to plan narration.' }, { status: 500 });
  }
}
