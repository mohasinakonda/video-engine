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
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_TOPUP_PACKS,
  getTopupPacks,
  validateAndApplyPromoCode,
  getAdminSettings,
} from '@/lib/subscription-store';
import type { PaymentSubmission, PlanTier, BillingCycle } from '@/types/subscription';

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

    // 3. Official Server Price & Credits Verification (Anti-Tamper & Strict Promo Validation)
    let officialOriginalPrice = 0;
    let baseCredits = 0;

    if (itemType === 'subscription') {
      const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return NextResponse.json(
          { success: false, error: `Invalid subscription plan: ${planId}` },
          { status: 400 }
        );
      }
      officialOriginalPrice = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
      baseCredits = plan.creditsPerMonth;
    } else if (itemType === 'topup') {
      const allTopups = getTopupPacks() || DEFAULT_TOPUP_PACKS;
      const pack = allTopups.find((p) => p.id === topupId);
      if (!pack) {
        return NextResponse.json(
          { success: false, error: `Invalid top-up pack: ${topupId}` },
          { status: 400 }
        );
      }
      officialOriginalPrice = pack.priceBDT;
      baseCredits = pack.credits;
    }

    let officialDiscountedPrice = officialOriginalPrice;
    let bonusCredits = 0;
    let validatedPromoCode: string | undefined = undefined;

    const userIdentifier = (userId && UUID_REGEX.test(userId)) ? userId : userEmail.trim().toLowerCase();

    if (promoCodeApplied && String(promoCodeApplied).trim()) {
      const cleanCode = String(promoCodeApplied).trim().toUpperCase();

      // Multi-layer check: query Supabase cloud database for previous redemptions
      if (isSupabaseConfigured()) {
        const remotePayments = await fetchUserPaymentsRemote(
          userId && UUID_REGEX.test(userId) ? userId : undefined,
          userEmail.trim()
        );
        if (remotePayments) {
          const pastUses = remotePayments.filter(
            (p) => p.promoCodeApplied?.toUpperCase() === cleanCode && p.status !== 'REJECTED'
          ).length;
          if (pastUses >= 1) {
            return NextResponse.json(
              {
                success: false,
                error: `This promo code (${cleanCode}) has already been redeemed on this account (${userEmail.trim()}).`,
              },
              { status: 400 }
            );
          }
        }
      }

      const promoResult = validateAndApplyPromoCode(
        cleanCode,
        officialOriginalPrice,
        userIdentifier,
        itemType === 'subscription' ? (planId as PlanTier) : undefined
      );

      if (!promoResult.valid) {
        return NextResponse.json(
          { success: false, error: promoResult.message || 'Invalid or expired promo code.' },
          { status: 400 }
        );
      }

      officialDiscountedPrice = promoResult.discountedPriceBDT ?? officialOriginalPrice;
      bonusCredits = promoResult.bonusCredits ?? 0;
      validatedPromoCode = cleanCode;
    } else {
      const settings = getAdminSettings();
      if (settings.globalDiscountActive && settings.globalDiscountPercent > 0) {
        officialDiscountedPrice = Math.max(
          0,
          Math.round(officialOriginalPrice * (1 - settings.globalDiscountPercent / 100))
        );
      }
    }

    // 4. Prepare verified submission object
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
      originalPriceBDT: officialOriginalPrice,
      discountedPriceBDT: officialDiscountedPrice,
      promoCodeApplied: validatedPromoCode,
      creditsToGrant: baseCredits + bonusCredits,
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

    // 5. Also save in local store fallback (which records submission and tracks promo usage)
    submitPaymentRequest(submissionData);

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
