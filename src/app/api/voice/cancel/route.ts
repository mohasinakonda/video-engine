import { NextResponse } from 'next/server';
import { calculateVoiceCredits } from '@/lib/voice-chunker';
import {
  authenticateVoiceRequest,
  getVoicePlan,
  deleteVoicePlan,
  refundVoiceCredits,
} from '@/lib/voice-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/voice/cancel
 * Body: { planId, charsDone }
 *
 * Cancels an in-progress generation and refunds the undone portion:
 * refund = charged - max(1, ceil(charsDone / charsPerCredit)).
 */
export async function POST(req: Request) {
  try {
    const gate = await authenticateVoiceRequest();
    if ('error' in gate) return gate.error;
    const auth = gate.auth;

    const body = await req.json().catch(() => ({}));
    const planId = typeof body.planId === 'string' ? body.planId : '';
    const charsDone = Math.max(0, Number(body.charsDone) || 0);

    const plan = planId ? getVoicePlan(planId) : undefined;
    if (!plan || plan.userId !== auth.userId) {
      return NextResponse.json({ success: true, refunded: 0 });
    }

    const used = calculateVoiceCredits(charsDone, plan.charsPerCredit);
    const refund = Math.max(0, plan.charged - used);
    if (refund > 0) await refundVoiceCredits(auth, refund);
    deleteVoicePlan(planId);

    return NextResponse.json({ success: true, refunded: refund });
  } catch (err) {
    console.error('[voice/cancel] error:', err);
    return NextResponse.json({ error: 'Cancel failed.' }, { status: 500 });
  }
}
