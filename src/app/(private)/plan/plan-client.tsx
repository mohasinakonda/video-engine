'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  validateAndApplyPromoCode,
  cacheValidatedPromo,
  type PromoValidationResult,
} from '@/lib/subscription-store';
import type { User } from '@supabase/supabase-js';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  PaymentMethod,
  PaymentSubmission,
  BillingCycle,
} from '@/types/subscription';
import { usePricing } from '@/hooks/use-pricing';

import { UserQuotaCards } from '@/components/pricing/user-quota-cards';
import { TopupPacksSection } from '@/components/pricing/topup-packs-section';
import { UserPlanRenewSection } from '@/components/pricing/user-plan-renew-section';
import { PaymentHistorySection } from '@/components/pricing/payment-history-section';
import { PaymentCheckoutModal } from '@/components/pricing/payment-checkout-modal';

interface PlanClientProps {
  initialUser: User | null;
}

export default function PlanClient({ initialUser }: PlanClientProps) {
  const {
    plans,
    topupPacks,
    settings,
    isLoggedIn,
    userEmail,
    setUserEmail,
    userSub,
    userProfile,
    submissions,
    setSubmissions,
  } = usePricing({ initialUser });

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
  const [promoAppliedCode, setPromoAppliedCode] = useState('');

  // Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedTopup, setSelectedTopup] = useState<CreditTopupPack | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastSubmittedReq, setLastSubmittedReq] = useState<PaymentSubmission | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize promo code from URL and sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('promo') || params.get('ref');
      const savedCode = sessionStorage.getItem('pending_promo_code');
      const candidateCode = (urlCode || savedCode || '').trim().toUpperCase();

      if (candidateCode) {
        setPromoCodeInput(candidateCode);
        handleApplyPromo(candidateCode);
      }
    } catch (e) {
      console.error('Error restoring promo code:', e);
    }
  }, [initialUser]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleApplyPromo = async (codeToApply?: string) => {
    const rawCode = (codeToApply !== undefined ? codeToApply : promoCodeInput).trim().toUpperCase();
    if (!rawCode) {
      setPromoResult(null);
      setPromoAppliedCode('');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pending_promo_code');
      }
      return;
    }

    const samplePrice = selectedPlan
      ? (billingCycle === 'quarterly'
          ? (selectedPlan.priceQuarterly ?? (selectedPlan.priceYearly ? Math.round(selectedPlan.priceYearly / 4) : Math.round(selectedPlan.priceMonthly * 3 * 0.9)))
          : billingCycle === 'yearly'
          ? (selectedPlan.priceYearly ?? (selectedPlan.priceQuarterly ? selectedPlan.priceQuarterly * 4 : selectedPlan.priceMonthly * 10))
          : selectedPlan.priceMonthly)
      : (selectedTopup ? selectedTopup.priceBDT : 1000);
    const userIdentifier = initialUser?.id || initialUser?.email || userEmail || undefined;
    const planId = selectedPlan ? selectedPlan.id : undefined;

    // Remote validation via /api/promos/validate (handles Supabase referral codes like REF-BBD2D and promo codes)
    try {
      const resp = await fetch('/api/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rawCode,
          originalPriceBDT: samplePrice,
          userIdentifier,
          planId,
        }),
      });
      const data = await resp.json();
      if (data && typeof data.valid === 'boolean') {
        setPromoResult(data);
        setPromoCodeInput(rawCode);
        if (data.valid) {
          setPromoAppliedCode(rawCode);
          cacheValidatedPromo(rawCode, data);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('pending_promo_code', rawCode);
          }
        } else {
          setPromoAppliedCode('');
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pending_promo_code');
          }
        }
        return;
      }
    } catch (err) {
      console.warn('API promo validation failed, falling back to local:', err);
    }

    const res = validateAndApplyPromoCode(rawCode, samplePrice, userIdentifier, planId);
    setPromoResult(res);
    setPromoCodeInput(rawCode);

    if (res.valid) {
      setPromoAppliedCode(rawCode);
      cacheValidatedPromo(rawCode, res);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pending_promo_code', rawCode);
      }
    } else {
      setPromoAppliedCode('');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pending_promo_code');
      }
    }
  };

  const handleRemovePromo = () => {
    setPromoAppliedCode('');
    setPromoCodeInput('');
    setPromoResult(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pending_promo_code');
    }
  };

  const openCheckoutForPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setSelectedTopup(null);
    setSubmitSuccess(false);
    setSubmitError('');
    setLastSubmittedReq(null);
    setPaymentModalOpen(true);
  };

  const hasActiveSubscription = Boolean(
    (userProfile?.tier && userProfile.tier !== 'TRIAL') ||
    (userSub?.tier && userSub.tier !== 'TRIAL')
  );

  const openCheckoutForTopup = (pack: CreditTopupPack) => {
    if (!hasActiveSubscription) {
      const plansElement = document.getElementById('plans-section');
      if (plansElement) {
        plansElement.scrollIntoView({ behavior: 'smooth' });
      }
      setToastMessage(
        '🔒 Top-up packs are available exclusively for active plan subscribers. Please choose a subscription plan below to unlock top-ups!'
      );
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    setSelectedTopup(pack);
    setSelectedPlan(null);
    setSubmitSuccess(false);
    setSubmitError('');
    setLastSubmittedReq(null);
    setPaymentModalOpen(true);
  };

  const calculateFinalPrice = () => {
    let originalPrice = 0;
    let creditsToGrant = 0;

    if (selectedPlan) {
      originalPrice =
        billingCycle === 'quarterly'
          ? (selectedPlan.priceQuarterly ?? Math.round(selectedPlan.priceMonthly * 2.7))
          : billingCycle === 'yearly'
          ? (selectedPlan.priceYearly ?? selectedPlan.priceMonthly * 10)
          : selectedPlan.priceMonthly;
      creditsToGrant =
        billingCycle === 'quarterly'
          ? selectedPlan.creditsPerMonth * 3
          : billingCycle === 'yearly'
          ? selectedPlan.creditsPerMonth * 12
          : selectedPlan.creditsPerMonth;
    } else if (selectedTopup) {
      originalPrice = selectedTopup.priceBDT;
      creditsToGrant = selectedTopup.credits;
    }

    let finalPrice = originalPrice;
    let bonusCredits = 0;

    if (promoAppliedCode) {
      const userIdentifier = initialUser?.id || initialUser?.email || userEmail || undefined;
      const planId = selectedPlan ? selectedPlan.id : undefined;
      const res = validateAndApplyPromoCode(promoAppliedCode, originalPrice, userIdentifier, planId);
      if (res.valid) {
        if (res.discountedPriceBDT !== undefined) finalPrice = res.discountedPriceBDT;
        if (res.bonusCredits) bonusCredits = res.bonusCredits;
      }
    } else if (settings?.globalDiscountActive && settings.globalDiscountPercent > 0) {
      finalPrice = Math.round(originalPrice * (1 - settings.globalDiscountPercent / 100));
    }

    return {
      originalPrice,
      finalPrice,
      creditsToGrant: creditsToGrant + bonusCredits,
      bonusCredits,
    };
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!senderNumber.trim()) {
      setSubmitError('Please enter your sender mobile number');
      return;
    }

    if (selectedTopup && !hasActiveSubscription) {
      setSubmitError(
        'Credit top-ups are exclusively available for active plan subscribers. Please subscribe to a plan first.'
      );
      return;
    }

    const { originalPrice, finalPrice, creditsToGrant } = calculateFinalPrice();
    setIsSubmitting(true);

    try {
      const payload = {
        userId: initialUser?.id || userProfile?.id || undefined,
        userEmail: userEmail.trim() || initialUser?.email || 'user@creator.com',
        userName: userProfile?.name || 'Creator',
        itemType: selectedPlan ? 'subscription' : 'topup',
        planId: selectedPlan ? selectedPlan.id : undefined,
        billingCycle: selectedPlan ? billingCycle : undefined,
        topupId: selectedTopup ? selectedTopup.id : undefined,
        originalPriceBDT: originalPrice,
        discountedPriceBDT: finalPrice,
        promoCodeApplied: promoAppliedCode || undefined,
        creditsToGrant,
        paymentMethod,
        senderNumber: senderNumber.trim(),
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit payment. Please try again.');
      }

      const created: PaymentSubmission = data.payment;
      setLastSubmittedReq(created);
      setSubmitSuccess(true);
      setSubmissions((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Failed to submit payment. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const creditsRemaining = userProfile?.creditsRemaining ?? userSub?.creditsRemaining ?? 30;
  const creditsUsed = userProfile?.creditsUsed ?? userSub?.creditsUsed ?? 0;
  const totalCredits = creditsRemaining + creditsUsed;
  const creditsPercent = Math.min(100, Math.round((creditsRemaining / Math.max(1, totalCredits)) * 100));
  const isExpiringSoon =
    userSub?.status === 'ACTIVE' && userSub.expiresAt - Date.now() < 3 * 24 * 3600 * 1000;
  const isExpired = userSub?.status === 'EXPIRED';

  return (
    <div className="w-full py-8 px-4 sm:px-8 text-zinc-100">
      <div className="max-w-6xl mx-auto space-y-10">
        <UserQuotaCards
          userSub={userSub}
          userProfile={userProfile}
          creditsRemaining={creditsRemaining}
          creditsUsed={creditsUsed}
          creditsPercent={creditsPercent}
          isExpiringSoon={isExpiringSoon}
          isExpired={isExpired}
          whatsappNumber={settings?.whatsappNumber}
        />

        <TopupPacksSection
          topupPacks={topupPacks}
          hasActiveSubscription={hasActiveSubscription}
          onSelectTopup={openCheckoutForTopup}
        />

        <UserPlanRenewSection
          plans={plans}
          billingCycle={billingCycle}
          setBillingCycle={setBillingCycle}
          userSub={userSub}
          onSelectPlan={openCheckoutForPlan}
        />

        <PaymentHistorySection
          submissions={submissions}
          whatsappNumber={settings?.whatsappNumber}
        />
      </div>

      {/* Manual Payment Checkout Modal */}
      <PaymentCheckoutModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        selectedPlan={selectedPlan}
        selectedTopup={selectedTopup}
        billingCycle={billingCycle}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        setUserEmail={setUserEmail}
        senderNumber={senderNumber}
        setSenderNumber={setSenderNumber}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        settings={settings}
        promoAppliedCode={promoAppliedCode}
        promoResult={promoResult}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={handleRemovePromo}
        calculateFinalPrice={calculateFinalPrice}
        onSubmitPayment={handleSubmitPayment}
        isSubmitting={isSubmitting}
        submitError={submitError}
        submitSuccess={submitSuccess}
        lastSubmittedReq={lastSubmittedReq}
        copiedText={copiedText}
        handleCopy={handleCopy}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-amber-400 text-zinc-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom border border-amber-300">
          <AlertCircle size={16} className="text-zinc-950 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
