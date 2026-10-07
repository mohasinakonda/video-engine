import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  fetchAllProfilesRemote,
  updateProfileRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import {
  getAllUsers,
  setUserBlockStatus,
  adjustUserCredits,
  assignUserPromoCode,
  getAllPayoutRequests,
} from '@/lib/subscription-store';
import type { UserProfile } from '@/types/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  let isLiveSupabase = false;
  let users: UserProfile[] | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient();
      const remote = await fetchAllProfilesRemote(supabase);
      if (remote !== null && remote.length > 0) {
        users = remote;
        isLiveSupabase = true;
      } else if (remote !== null) {
        users = remote;
        isLiveSupabase = true;
      }
    } catch (err) {
      console.warn('[API /api/admin/users] Remote fetch failed:', err);
    }
  }

  // Use fetched users, or fall back to local store
  const finalUsers = (users && users.length > 0) ? users : getAllUsers();
  const payouts = getAllPayoutRequests();

  return NextResponse.json({
    success: true,
    isLiveSupabase,
    users: finalUsers,
    payouts,
  });
}

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const { action, userId, amount, isBlocked, reason, promoCode } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    let remoteUpdated = false;

    if (action === 'toggleBlock') {
      if (isSupabaseConfigured()) {
        try {
          remoteUpdated = await updateProfileRemote(userId, { isBlocked, blockReason: reason }, supabase);
        } catch {}
      }
      setUserBlockStatus(userId, isBlocked, reason);
      return NextResponse.json({ success: true, remoteUpdated });
    }

    if (action === 'adjustCredits') {
      if (isSupabaseConfigured()) {
        try {
          // Adjust in Supabase
          const profiles = await fetchAllProfilesRemote(supabase);
          const target = profiles?.find((p) => p.id === userId);
          if (target) {
            const nextCredits = Math.max(0, target.creditsRemaining + amount);
            remoteUpdated = await updateProfileRemote(userId, { creditsRemaining: nextCredits }, supabase);
          }
        } catch {}
      }
      adjustUserCredits(userId, amount);
      return NextResponse.json({ success: true, remoteUpdated });
    }

    if (action === 'assignPromo') {
      if (isSupabaseConfigured()) {
        try {
          remoteUpdated = await updateProfileRemote(userId, { assignedPromoCode: promoCode }, supabase);
        } catch {}
      }
      assignUserPromoCode(userId, promoCode);
      return NextResponse.json({ success: true, remoteUpdated });
    }

    if (action === 'updateReferralRates') {
      const { referralCode, discountPercent, commissionPercent } = body;
      if (isSupabaseConfigured()) {
        try {
          const updatePayload: Record<string, any> = {};
          if (referralCode !== undefined && String(referralCode).trim()) {
            updatePayload.referral_code = String(referralCode).trim().toUpperCase();
          }
          if (discountPercent !== undefined) {
            updatePayload.referral_discount_percent = Math.max(1, Math.min(100, Number(discountPercent)));
          }
          if (commissionPercent !== undefined) {
            updatePayload.referral_commission_percent = Math.max(1, Math.min(100, Number(commissionPercent)));
          }

          const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
          remoteUpdated = !error;
        } catch (err) {
          console.warn('Error updating referral rates:', err);
        }
      }
      return NextResponse.json({ success: true, remoteUpdated });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error' },
      { status: 500 }
    );
  }
}
