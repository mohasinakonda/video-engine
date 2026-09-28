import { NextResponse } from 'next/server';
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
      const remote = await fetchAllProfilesRemote();
      if (remote !== null) {
        users = remote;
        isLiveSupabase = true;
      }
    } catch (err) {
      console.warn('[API /api/admin/users] Remote fetch failed:', err);
    }
  }

  const finalUsers = users || [];
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
    const body = await req.json();
    const { action, userId, amount, isBlocked, reason, promoCode } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    let remoteUpdated = false;

    if (action === 'toggleBlock') {
      if (isSupabaseConfigured()) {
        try {
          remoteUpdated = await updateProfileRemote(userId, { isBlocked, blockReason: reason });
        } catch {}
      }
      setUserBlockStatus(userId, isBlocked, reason);
      return NextResponse.json({ success: true, remoteUpdated });
    }

    if (action === 'adjustCredits') {
      if (isSupabaseConfigured()) {
        try {
          // Adjust in Supabase
          const profiles = await fetchAllProfilesRemote();
          const target = profiles?.find((p) => p.id === userId);
          if (target) {
            const nextCredits = Math.max(0, target.creditsRemaining + amount);
            remoteUpdated = await updateProfileRemote(userId, { creditsRemaining: nextCredits });
          }
        } catch {}
      }
      adjustUserCredits(userId, amount);
      return NextResponse.json({ success: true, remoteUpdated });
    }

    if (action === 'assignPromo') {
      if (isSupabaseConfigured()) {
        try {
          remoteUpdated = await updateProfileRemote(userId, { assignedPromoCode: promoCode });
        } catch {}
      }
      assignUserPromoCode(userId, promoCode);
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
