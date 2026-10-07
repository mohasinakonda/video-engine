import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  createPromoCodeRemote,
  deletePromoCodeRemote,
  fetchPromoCodesRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import {
  createNewPromoCode,
  deletePromoCode,
  getAllPromoCodes,
} from '@/lib/subscription-store';
import type { PromoCode } from '@/types/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const remote = await fetchPromoCodesRemote();
      if (remote && remote.length > 0) {
        return NextResponse.json({ success: true, promoCodes: remote, isLive: true });
      }
    } catch {}
  }
  return NextResponse.json({
    success: true,
    promoCodes: getAllPromoCodes(),
    isLive: false,
  });
}

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const promo: PromoCode = await req.json();
    let savedToSupabase = false;

    if (isSupabaseConfigured()) {
      try {
        savedToSupabase = await createPromoCodeRemote(promo, supabase);
      } catch (err) {
        console.warn('[API /api/admin/promos] Remote promo creation failed:', err);
      }
    }

    // Always update local store
    createNewPromoCode(promo);

    return NextResponse.json({
      success: true,
      savedToSupabase,
      promoCode: promo,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Failed to create promo' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Promo code parameter required' },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      try {
        await deletePromoCodeRemote(code, supabase);
      } catch (err) {
        console.warn('[API /api/admin/promos] Remote promo delete failed:', err);
      }
    }

    // Always remove from local store
    deletePromoCode(code);

    return NextResponse.json({ success: true, deletedCode: code });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Failed to delete promo' },
      { status: 500 }
    );
  }
}
