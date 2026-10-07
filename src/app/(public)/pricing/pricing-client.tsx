'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  validateAndApplyPromoCode,
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

// Global & Modular Pricing Components
import { PricingHeader } from '@/components/pricing/pricing-header';
import { CreditsExplainerSection } from '@/components/pricing/credits-explainer-section';
import { RoiCalculatorSection } from '@/components/pricing/roi-calculator-section';
import { PromoCodeBar } from '@/components/pricing/promo-code-bar';
import { PricingPlansGrid } from '@/components/pricing/pricing-plans-grid';
import { CreatorTrustPillars } from '@/components/pricing/creator-trust-pillars';
import { ComparisonTableSection } from '@/components/pricing/comparison-table-section';
import { FaqSection } from '@/components/pricing/faq-section';
import { WhatsAppCtaSection } from '@/components/pricing/whatsapp-cta-section';
import { PaymentCheckoutModal } from '@/components/pricing/payment-checkout-modal';

interface PricingClientProps {
  initialUser: User | null;
}

export default function PricingClient({ initialUser }: PricingClientProps) {
  // Centralized pricing, plans, settings & auth hook
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

  // Interactive Guest States
  const [calculatorVideos, setCalculatorVideos] = useState<number>(20);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(true);

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

  // Synchronize promo code from URL (?promo=CODE or ?ref=CODE) and sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('promo') || params.get('ref');
      const savedCode = sessionStorage.getItem('pending_promo_code');
      const candidateCode = (urlCode || savedCode || '').trim().toUpperCase();

      if (candidateCode) {
        setPromoCodeInput(candidateCode);
        const userIdentifier = initialUser?.id || initialUser?.email || undefined;
        const res = validateAndApplyPromoCode(candidateCode, 1000, userIdentifier);
        setPromoResult(res);
        if (res.valid) {
          setPromoAppliedCode(candidateCode);
          sessionStorage.setItem('pending_promo_code', candidateCode);
        } else {
          sessionStorage.removeItem('pending_promo_code');
        }
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

  const handleApplyPromo = (codeToApply?: string) => {
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
          ? (selectedPlan.priceQuarterly ?? Math.round(selectedPlan.priceMonthly * 2.7))
          : billingCycle === 'yearly'
          ? (selectedPlan.priceYearly ?? selectedPlan.priceMonthly * 10)
          : selectedPlan.priceMonthly)
      : (selectedTopup ? selectedTopup.priceBDT : 1000);
    const userIdentifier = initialUser?.id || initialUser?.email || userEmail || undefined;
    const planId = selectedPlan ? selectedPlan.id : undefined;

    const res = validateAndApplyPromoCode(rawCode, samplePrice, userIdentifier, planId);
    setPromoResult(res);
    setPromoCodeInput(rawCode);

    if (res.valid) {
      setPromoAppliedCode(rawCode);
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

  return (
    <div className="w-full py-12 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-14">
        <PricingHeader />

        <CreditsExplainerSection />

        <RoiCalculatorSection
          plans={plans}
          billingCycle={billingCycle}
          calculatorVideos={calculatorVideos}
          setCalculatorVideos={setCalculatorVideos}
          onSelectPlan={(planId) => {
            const targetId = `plan-${planId}`;
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <PromoCodeBar
          promoCodeInput={promoCodeInput}
          setPromoCodeInput={setPromoCodeInput}
          promoResult={promoResult}
          onApplyPromo={handleApplyPromo}
        />

        <PricingPlansGrid
          plans={plans}
          billingCycle={billingCycle}
          setBillingCycle={setBillingCycle}
          promoAppliedCode={promoAppliedCode}
          settings={settings}
          calculatorVideos={calculatorVideos}
          onSelectPlan={openCheckoutForPlan}
        />

        <CreatorTrustPillars />

        <ComparisonTableSection
          showComparison={showComparison}
          setShowComparison={setShowComparison}
        />

        <FaqSection openFaq={openFaq} setOpenFaq={setOpenFaq} />

        <WhatsAppCtaSection whatsappNumber={settings?.whatsappNumber} />
      </div>

      {/* Manual Payment Checkout Modal (WhatsApp Assisted) */}
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
