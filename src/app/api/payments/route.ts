import { NextResponse } from 'next/server';
import {
  submitPaymentRemote,
  fetchUserPaymentsRemote,
  fetchSupabaseProfile,
  isSupabaseConfigured,
  incrementPromoUsageRemote,
  validatePromoOrReferralRemote,
  fetchPlansRemote,
  fetchTopupPacksRemote,
} from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
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
import { getPlanPrice, getPlanCredits, isBillingCycle, getPlanChange } from '@/lib/plan-pricing';
import { profileEffectiveTier } from '@/lib/input-limits';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId');
    const requestedUserEmail = searchParams.get('userEmail');

    if (isSupabaseConfigured()) {
      const serverSupabase = createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized. Please sign in.' },
          { status: 401 }
        );
      }

      // Check if user has admin role
      const profile = await fetchSupabaseProfile(user.id, serverSupabase);
      const isAdmin = profile?.role === 'admin';

      // Anti-IDOR: Non-admins can strictly only query their own payments
      const effectiveUserId = isAdmin && requestedUserId ? requestedUserId : user.id;
      const effectiveUserEmail = isAdmin && requestedUserEmail ? requestedUserEmail : (user.email || undefined);

      const remotePayments = await fetchUserPaymentsRemote(
        effectiveUserId,
        effectiveUserEmail
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
      if (requestedUserId && p.userId === requestedUserId) return true;
      if (requestedUserEmail && p.userEmail.toLowerCase() === requestedUserEmail.toLowerCase()) return true;
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

    // Identity comes from the authenticated session, never from the request body.
    let sessionUserId: string | undefined;
    let sessionEmail: string | undefined;
    let serverSupabase: ReturnType<typeof createServerClient> | undefined;
    if (isSupabaseConfigured()) {
      serverSupabase = createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized. Please sign in.' },
          { status: 401 }
        );
      }
      sessionUserId = user.id;
      sessionEmail = user.email || undefined;
    }

    const {
      userId: bodyUserId,
      userEmail: bodyUserEmail,
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

    const userId: string | undefined = sessionUserId ?? bodyUserId;
    const userEmail: string | undefined = sessionEmail ?? bodyUserEmail;

    // 1. Basic validation
    if (!userEmail || typeof userEmail !== 'string' || !userEmail.trim()) {
      return NextResponse.json(
        { success: false, error: 'User email is required' },
        { status: 400 }
      );
    }

    if (!senderNumber || typeof senderNumber !== 'string' || !senderNumber.trim()) {
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

    // 2. Plan rules, based on the plan the user has right now (an expired plan counts as TRIAL).
    let currentTier: PlanTier = 'TRIAL';
    if (isSupabaseConfigured() && userId && UUID_REGEX.test(userId)) {
      const profile = await fetchSupabaseProfile(userId, serverSupabase);
      currentTier = profileEffectiveTier(profile);
    }

    // Top-up packs are for active subscribers only, so lapsed users must renew first.
    if (itemType === 'topup' && currentTier === 'TRIAL') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Credit top-up packs are exclusively reserved for active plan subscribers (Starter, Creator, or Studio Pro). Please subscribe to a plan first.',
        },
        { status: 403 }
      );
    }

    // No downgrades while a plan is active; the lower plan can be bought once it ends.
    if (itemType === 'subscription' && getPlanChange(currentTier, planId as PlanTier) === 'downgrade') {
      return NextResponse.json(
        {
          success: false,
          error: 'You cannot switch to a lower plan while your current plan is active. You can choose it after your plan ends.',
        },
        { status: 403 }
      );
    }

    // 3. Official Server Price & Credits Verification (Anti-Tamper & Strict Promo Validation)
    let officialOriginalPrice = 0;
    let baseCredits = 0;

    if (itemType === 'subscription') {
      const dbPlans = await fetchPlansRemote();
      const plan = dbPlans?.find((p) => p.id === planId) || DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return NextResponse.json(
          { success: false, error: `Invalid subscription plan: ${planId}` },
          { status: 400 }
        );
      }
      if (!isBillingCycle(billingCycle)) {
        return NextResponse.json(
          { success: false, error: 'Invalid billing cycle. Choose monthly or 3 months.' },
          { status: 400 }
        );
      }
      officialOriginalPrice = getPlanPrice(plan, billingCycle);
      baseCredits = getPlanCredits(plan, billingCycle);
    } else if (itemType === 'topup') {
      const dbTopups = await fetchTopupPacksRemote();
      const allTopups = (dbTopups && dbTopups.length > 0) ? dbTopups : (getTopupPacks() || DEFAULT_TOPUP_PACKS);
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

    // Promo and referral codes are for plans only, so a top-up never pays an affiliate commission.
    if (itemType === 'topup' && promoCodeApplied && String(promoCodeApplied).trim()) {
      return NextResponse.json(
        { success: false, error: 'Promo codes can only be used on subscription plans, not credit top-ups.' },
        { status: 400 }
      );
    }

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

      let promoResult;
      if (isSupabaseConfigured()) {
        const serverSupabase = createServerClient();
        promoResult = await validatePromoOrReferralRemote(
          cleanCode,
          officialOriginalPrice,
          userIdentifier,
          itemType === 'subscription' ? (planId as PlanTier) : undefined,
          serverSupabase
        );
      } else {
        promoResult = validateAndApplyPromoCode(
          cleanCode,
          officialOriginalPrice,
          userIdentifier,
          itemType === 'subscription' ? (planId as PlanTier) : undefined
        );
      }

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
        // Signed-in session client: the submit RPC is not executable by anon.
        const remoteResult = await submitPaymentRemote(submissionData, createServerClient());
        if (remoteResult) {
          recordedInSupabase = true;
        }
      } catch (err) {
        console.warn('[API /api/payments] Remote insert warning:', err);
      }
    }

    // 5. Also save in local store fallback (which records submission and tracks promo usage)
    submitPaymentRequest(submissionData);

    // 6. Increment promo code counter in Supabase cloud DB
    if (isSupabaseConfigured() && validatedPromoCode) {
      await incrementPromoUsageRemote(validatedPromoCode);
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
