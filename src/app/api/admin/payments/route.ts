import { NextResponse } from 'next/server';
import {
  fetchPaymentsRemote,
  approvePaymentRemote,
  rejectPaymentRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import {
  getAllPaymentSubmissions,
  approvePaymentRequest,
  rejectPaymentRequest,
  getRevenueAnalytics,
} from '@/lib/subscription-store';
import type { PaymentSubmission, RevenueAnalytics } from '@/types/subscription';

export const dynamic = 'force-dynamic';

function calculateAnalytics(subs: PaymentSubmission[]): RevenueAnalytics {
  const approved = subs.filter((s) => s.status === 'APPROVED');
  const totalRevenueBDT = approved.reduce((sum, s) => sum + s.discountedPriceBDT, 0);

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthlyRevenueBDT = approved
    .filter((s) => s.submittedAt >= currentMonthStart)
    .reduce((sum, s) => sum + s.discountedPriceBDT, 0);

  const pendingApprovals = subs.filter((s) => s.status === 'PENDING').length;
  const totalCreditsPurchased = approved.reduce((sum, s) => sum + s.creditsToGrant, 0);

  return {
    totalRevenueBDT,
    monthlyRevenueBDT,
    activeSubscribers: approved.length,
    pendingApprovals,
    totalCreditsUsed: totalCreditsPurchased,
    totalImagesGenerated: totalCreditsPurchased,
    topPromoCodes: [],
  };
}

export async function GET() {
  let isLiveSupabase = false;
  let payments: PaymentSubmission[] | null = null;

  if (isSupabaseConfigured()) {
    try {
      const remote = await fetchPaymentsRemote();
      if (remote !== null) {
        isLiveSupabase = true;
        payments = remote;
      }
    } catch (err) {
      console.warn('[API /api/admin/payments] Remote fetch failed, falling back:', err);
    }
  }

  const finalPayments = payments !== null ? payments : [];
  const analytics = calculateAnalytics(finalPayments);

  return NextResponse.json({
    success: true,
    isLiveSupabase,
    payments: finalPayments,
    analytics,
  });
}

export async function POST(req: Request) {
  try {
    const { action, submissionId, adminNote }: { action: 'approve' | 'reject'; submissionId: string; adminNote?: string } = await req.json();

    if (!submissionId) {
      return NextResponse.json({ success: false, error: 'submissionId is required' }, { status: 400 });
    }

    let remoteUpdated = false;

    if (action === 'approve') {
      if (isSupabaseConfigured()) {
        try {
          remoteUpdated = await approvePaymentRemote(submissionId, adminNote);
        } catch (err) {
          console.warn('[API /api/admin/payments] Remote approval failed:', err);
        }
      }
      // Always update local store
      approvePaymentRequest(submissionId, adminNote);

      return NextResponse.json({
        success: true,
        action: 'approved',
        remoteUpdated,
        message: remoteUpdated ? 'Payment approved in Supabase & credits granted!' : 'Payment approved in local store.',
      });
    }

    if (action === 'reject') {
      if (isSupabaseConfigured()) {
        try {
          remoteUpdated = await rejectPaymentRemote(submissionId, adminNote || 'Rejected by admin');
        } catch (err) {
          console.warn('[API /api/admin/payments] Remote rejection failed:', err);
        }
      }
      // Always update local store
      rejectPaymentRequest(submissionId, adminNote);

      return NextResponse.json({
        success: true,
        action: 'rejected',
        remoteUpdated,
        message: remoteUpdated ? 'Payment rejected in Supabase.' : 'Payment rejected in local store.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error processing payment action' },
      { status: 500 }
    );
  }
}
