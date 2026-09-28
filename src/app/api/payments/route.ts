import { NextResponse } from 'next/server';
import {
  submitPaymentRemote,
  fetchUserPaymentsRemote,
  fetchSupabaseProfile,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import {
  submitPaymentRequest,
  getAllPaymentSubmissions,
  incrementPromoCodeUsage,
} from '@/lib/subscription-store';
import type { PaymentSubmission } from '@/types/subscription';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');

    if (isSupabaseConfigured() && (userId || userEmail)) {
      const remotePayments = await fetchUserPaymentsRemote(
        userId || undefined,
        userEmail || undefined
      );
      if (remotePayments !== null) {
        return NextResponse.json({
          success: true,
          payments: remotePayments,
          isLiveSupabase: true,
        });
      }
    }

    const localList = getAllPaymentSubmissions().filter((p) => {
      if (userId && p.userId === userId) return true;
      if (userEmail && p.userEmail.toLowerCase() === userEmail.toLowerCase()) return true;
      return false;
    });

    return NextResponse.json({
      success: true,
      payments: localList,
      isLiveSupabase: false,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userId,
      userEmail,
      userName,
      itemType,
      planId,
      billingCycle,
      topupId,
      originalPriceBDT,
      discountedPriceBDT,
      promoCodeApplied,
      creditsToGrant,
      paymentMethod,
      senderNumber,
    } = body;

    // 1. Basic validation
    if (!userEmail || !userEmail.trim()) {
      return NextResponse.json(
        { success: false, error: 'User email is required' },
        { status: 400 }
      );
    }

    if (!senderNumber || !senderNumber.trim()) {
      return NextResponse.json(
        { success: false, error: 'Sender mobile number is required' },
        { status: 400 }
      );
    }

    if (!['bkash', 'nagad', 'bank'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    if (!['subscription', 'topup'].includes(itemType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid item type' },
        { status: 400 }
      );
    }

    // 2. Strict Subscriber Restriction for Top-Up Packs
    if (itemType === 'topup') {
      let isSubscriber = false;

      if (isSupabaseConfigured() && userId && UUID_REGEX.test(userId)) {
        const profile = await fetchSupabaseProfile(userId);
        if (profile && profile.tier && profile.tier !== 'TRIAL') {
          isSubscriber = true;
        }
      }

      if (!isSubscriber) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Credit top-up packs are exclusively reserved for active plan subscribers (Starter, Creator, or Studio Pro). Please subscribe to a plan first.',
          },
          { status: 403 }
        );
      }
    }

    // 3. Prepare submission object
    const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const validUserId = userId && UUID_REGEX.test(userId) ? userId : undefined;

    const submissionData: PaymentSubmission = {
      id,
      userId: validUserId || 'usr_guest',
      userEmail: userEmail.trim(),
      userName: userName || 'Creator',
      itemType,
      planId: itemType === 'subscription' ? planId : undefined,
      billingCycle: itemType === 'subscription' ? billingCycle : undefined,
      topupId: itemType === 'topup' ? topupId : undefined,
      originalPriceBDT: Number(originalPriceBDT) || 0,
      discountedPriceBDT: Number(discountedPriceBDT) || 0,
      promoCodeApplied: promoCodeApplied ? String(promoCodeApplied).toUpperCase() : undefined,
      creditsToGrant: Number(creditsToGrant) || 0,
      paymentMethod,
      senderNumber: senderNumber.trim(),
      status: 'PENDING',
      submittedAt: Date.now(),
    };

    // 4. Save to Supabase Cloud Database
    let recordedInSupabase = false;
    if (isSupabaseConfigured()) {
      try {
        const remoteResult = await submitPaymentRemote(submissionData);
        if (remoteResult) {
          recordedInSupabase = true;
        }
      } catch (err) {
        console.warn('[API /api/payments] Remote insert warning:', err);
      }
    }

    // 5. Also save in local store fallback & increment promo usage
    submitPaymentRequest(submissionData);
    if (submissionData.promoCodeApplied) {
      incrementPromoCodeUsage(submissionData.promoCodeApplied);
    }

    return NextResponse.json({
      success: true,
      recordedInSupabase,
      payment: submissionData,
      message: recordedInSupabase
        ? 'Payment submitted successfully to Supabase! Admin will verify soon.'
        : 'Payment recorded. Admin will verify soon.',
    });
  } catch (err: unknown) {
    console.error('[API /api/payments] Error:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Server error submitting payment' },
      { status: 500 }
    );
  }
}
