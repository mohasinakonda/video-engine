import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { validatePromoOrReferralRemote, isSupabaseConfigured } from '@/lib/supabase-service';
import { validateAndApplyPromoCode } from '@/lib/subscription-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, originalPriceBDT = 1000, userIdentifier, planId } = body;

    if (!code || !String(code).trim()) {
      return NextResponse.json({
        valid: false,
        message: 'Promo code is required',
      });
    }

    const cleanCode = String(code).trim().toUpperCase();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createServerClient();
        const remoteResult = await validatePromoOrReferralRemote(
          cleanCode,
          Number(originalPriceBDT) || 1000,
          userIdentifier ? String(userIdentifier).trim() : undefined,
          planId ? String(planId) : undefined,
          supabase
        );

        return NextResponse.json({
          success: true,
          ...remoteResult,
        });
      } catch (remoteErr) {
        console.warn('[API /api/promos/validate] Remote validation error, falling back:', remoteErr);
      }
    }

    // Local fallback
    const localResult = validateAndApplyPromoCode(
      cleanCode,
      Number(originalPriceBDT) || 1000,
      userIdentifier ? String(userIdentifier).trim() : undefined,
      planId
    );

    return NextResponse.json({
      success: true,
      ...localResult,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, valid: false, message: (err as Error).message || 'Validation failed' },
      { status: 500 }
    );
  }
}
