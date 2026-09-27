'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  Check,
  Tag,
  ArrowRight,
  Clock,
  Sparkles,
  CreditCard,
  Building,
  Smartphone,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import {
  getSubscriptionPlans,
  getTopupPacks,
  getAdminSettings,
  getUserSubscription,
  validateAndApplyPromoCode,
  submitPaymentRequest,
  getAllPaymentSubmissions,
  getWhatsAppVerificationUrl,
  type PromoValidationResult,
} from '@/lib/subscription-store';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  PaymentMethod,
  PaymentSubmission,
  UserSubscription,
  AdminSettings,
  BillingCycle,
} from '@/types/subscription';

export default function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [topupPacks, setTopupPacks] = useState<CreditTopupPack[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [userSub, setUserSub] = useState<UserSubscription | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
  const [promoAppliedCode, setPromoAppliedCode] = useState('');
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);

  // Modal State
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedTopup, setSelectedTopup] = useState<CreditTopupPack | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastSubmittedReq, setLastSubmittedReq] = useState<PaymentSubmission | null>(null);

  // Load state on client
  useEffect(() => {
    setPlans(getSubscriptionPlans());
    setTopupPacks(getTopupPacks());
    setSettings(getAdminSettings());
    setUserSub(getUserSubscription());
    setSubmissions(getAllPaymentSubmissions());
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) {
      setPromoResult(null);
      setPromoAppliedCode('');
      return;
    }
    const samplePrice = 1000;
    const res = validateAndApplyPromoCode(promoCodeInput, samplePrice);
    setPromoResult(res);
    if (res.valid) {
      setPromoAppliedCode(promoCodeInput.trim().toUpperCase());
    } else {
      setPromoAppliedCode('');
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

  const openCheckoutForTopup = (pack: CreditTopupPack) => {
    setSelectedTopup(pack);
    setSelectedPlan(null);
    setSubmitSuccess(false);
    setSubmitError('');
    setLastSubmittedReq(null);
    setPaymentModalOpen(true);
  };

  // Pricing calculations
  const calculateFinalPrice = () => {
    let originalPrice = 0;
    let creditsToGrant = 0;

    if (selectedPlan) {
      originalPrice = billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly;
      creditsToGrant = selectedPlan.creditsPerMonth;
    } else if (selectedTopup) {
      originalPrice = selectedTopup.priceBDT;
      creditsToGrant = selectedTopup.credits;
    }

    let finalPrice = originalPrice;
    let bonusCredits = 0;

    if (promoAppliedCode) {
      const res = validateAndApplyPromoCode(promoAppliedCode, originalPrice);
      if (res.valid && res.discountedPriceBDT !== undefined) {
        finalPrice = res.discountedPriceBDT;
        bonusCredits = res.bonusCredits || 0;
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

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderNumber.trim()) {
      setSubmitError('Please enter your sender mobile / phone number.');
      return;
    }

    const { originalPrice, finalPrice, creditsToGrant } = calculateFinalPrice();

    try {
      const created = submitPaymentRequest({
        userId: 'usr_me',
        userEmail: userEmail.trim() || 'creator@example.com',
        planId: selectedPlan?.id,
        topupId: selectedTopup?.id,
        itemType: selectedPlan ? 'subscription' : 'topup',
        billingCycle: selectedPlan ? billingCycle : undefined,
        originalPriceBDT: originalPrice,
        discountedPriceBDT: finalPrice,
        promoCodeApplied: promoAppliedCode || undefined,
        creditsToGrant,
        paymentMethod,
        senderNumber: senderNumber.trim(),
      });

      setLastSubmittedReq(created);
      setSubmitSuccess(true);
      setSubmissions(getAllPaymentSubmissions());
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Failed to submit payment. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Global Announcement Banner */}
        {settings?.globalBannerActive && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-purple-500/20 border border-amber-500/30 text-xs font-medium text-amber-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              <span>{settings.globalBannerText}</span>
            </div>
            {settings.globalDiscountActive && (
              <span className="bg-amber-400 text-zinc-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                {settings.globalDiscountPercent}% OFF ACTIVE
              </span>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={14} />
            Affordable Bangladeshi Creator Pricing
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Create AI Videos Without Limits
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg">
            Pay easily with <strong className="text-zinc-200">bKash</strong>, <strong className="text-zinc-200">Nagad</strong>, or <strong className="text-zinc-200">Bank Transfer</strong>. 
            Confirm instantly via WhatsApp and get your account activated immediately.
          </p>

          {/* Current Balance Bar */}
          {userSub && (
            <div className="inline-flex items-center gap-4 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm shadow-sm mt-3">
              <span className="text-zinc-400">Current Plan:</span>
              <span className="font-semibold text-emerald-400 uppercase tracking-wide">
                {userSub.tier} ({userSub.status})
              </span>
              <span className="w-px h-4 bg-zinc-800" />
              <span className="text-zinc-400">Remaining Credits:</span>
              <span className="font-bold text-white flex items-center gap-1">
                <Zap size={15} className="text-amber-400 fill-amber-400" />
                {userSub.creditsRemaining} credits
              </span>
            </div>
          )}
        </div>

        {/* Promo Code Input Bar */}
        <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-md backdrop-blur-sm">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Tag size={13} className="text-amber-400" />
              Have a Promo Code or Creator Referral Code?
            </span>
            <span className="text-[11px] text-zinc-500 font-normal">Try: EARLY50 or HAZRAT25</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCodeInput}
              onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. EARLY50, HAZRAT25"
              className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            <button
              onClick={handleApplyPromo}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Apply
            </button>
          </div>

          {promoResult && (
            <div
              className={`mt-3 text-xs p-2.5 rounded-lg flex items-center gap-2 ${
                promoResult.valid
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              {promoResult.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{promoResult.message}</span>
              {promoResult.valid && (
                <span className="ml-auto font-bold uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
                  Applied
                </span>
              )}
            </div>
          )}
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              billingCycle === 'yearly'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Yearly Billing</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase">
              Save 20%
            </span>
          </button>
        </div>

        {/* Subscription Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const rawPrice = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
            let displayPrice = rawPrice;
            if (promoAppliedCode) {
              const res = validateAndApplyPromoCode(promoAppliedCode, rawPrice);
              if (res.valid && res.discountedPriceBDT !== undefined) {
                displayPrice = res.discountedPriceBDT;
              }
            } else if (settings?.globalDiscountActive && settings.globalDiscountPercent > 0) {
              displayPrice = Math.round(rawPrice * (1 - settings.globalDiscountPercent / 100));
            }

            const isCurrent = userSub?.tier === plan.id && userSub?.status === 'ACTIVE';

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl p-6 sm:p-8 transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-b from-zinc-850 to-zinc-900 border-2 border-emerald-500/70 shadow-2xl shadow-emerald-950/30'
                    : 'bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-zinc-950 font-bold text-xs uppercase tracking-wider shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {plan.creditsPerMonth} image credits / month
                  </p>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">৳{displayPrice}</span>
                    <span className="text-xs text-zinc-400">
                      / {billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                    {displayPrice < rawPrice && (
                      <span className="text-xs line-through text-zinc-500 font-mono">
                        ৳{rawPrice}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 text-sm text-zinc-300 flex-1 mb-8">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-xs leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => openCheckoutForPlan(plan)}
                  disabled={isCurrent}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-white hover:bg-zinc-200 text-zinc-950'
                  }`}
                >
                  {isCurrent ? (
                    'Active Plan'
                  ) : (
                    <>
                      <span>Choose {plan.name}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Credit Top-up Packs Section */}
        <div className="pt-8 border-t border-zinc-800/80 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <Zap size={22} className="text-amber-400 fill-amber-400" />
              Pay-As-You-Go Credit Packs
            </h2>
            <p className="text-zinc-400 text-sm">
              Need extra credits for a project without committing to a monthly plan? Top up instantly. Credits never expire!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {topupPacks.map((pack) => {
              let displayPrice = pack.priceBDT;
              if (promoAppliedCode) {
                const res = validateAndApplyPromoCode(promoAppliedCode, pack.priceBDT);
                if (res.valid && res.discountedPriceBDT !== undefined) {
                  displayPrice = res.discountedPriceBDT;
                }
              }

              return (
                <div
                  key={pack.id}
                  className={`rounded-2xl p-6 bg-zinc-900/60 border transition-all relative ${
                    pack.popular
                      ? 'border-amber-400/60 shadow-lg shadow-amber-950/20'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-bold text-[10px] uppercase tracking-wider">
                      Best Value
                    </span>
                  )}
                  <h4 className="text-base font-semibold text-white">{pack.name}</h4>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white">৳{displayPrice}</span>
                    {displayPrice < pack.priceBDT && (
                      <span className="text-xs line-through text-zinc-500 font-mono">৳{pack.priceBDT}</span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-400 font-medium mt-1">
                    {pack.credits} Image Credits (~{Math.round(pack.credits / 15)} videos)
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    ৳{pack.perCreditBDT.toFixed(2)} per credit
                  </p>

                  <button
                    onClick={() => openCheckoutForTopup(pack)}
                    className="w-full mt-5 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Zap size={14} className="text-amber-400 fill-amber-400" />
                    Top-up Now
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Manual Payment Checkout Modal (WhatsApp Assisted) */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setPaymentModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
            >
              <XCircle size={22} />
            </button>

            {submitSuccess && lastSubmittedReq ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl font-bold text-white">Payment Request Submitted!</h3>
                <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
                  Click the button below to message the admin directly on WhatsApp with your details. 
                  Your account will be approved instantly!
                </p>

                {/* Direct WhatsApp CTA */}
                <div className="pt-2">
                  <a
                    href={getWhatsAppVerificationUrl(
                      lastSubmittedReq.senderNumber,
                      lastSubmittedReq.discountedPriceBDT,
                      selectedPlan ? `Plan ${selectedPlan.name}` : `Topup ${selectedTopup?.name}`,
                      lastSubmittedReq.userEmail
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-transform hover:scale-105"
                  >
                    <MessageCircle size={18} />
                    Message Admin on WhatsApp Now
                  </a>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => setPaymentModalOpen(false)}
                    className="px-6 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-xs hover:bg-zinc-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPayment} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CreditCard size={18} className="text-emerald-400" />
                    Complete Your Purchase
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Pay manually via bKash, Nagad, or Bank Transfer
                  </p>
                </div>

                {/* Order Summary Box */}
                {(() => {
                  const { originalPrice, finalPrice, creditsToGrant, bonusCredits } = calculateFinalPrice();
                  return (
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
                      <div className="flex justify-between text-zinc-300">
                        <span>Item:</span>
                        <span className="font-semibold text-white">
                          {selectedPlan ? `${selectedPlan.name} (${billingCycle})` : selectedTopup?.name}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span>Credits:</span>
                        <span className="font-semibold text-emerald-400">
                          {creditsToGrant} Credits {bonusCredits > 0 && `(+${bonusCredits} promo bonus)`}
                        </span>
                      </div>
                      {promoAppliedCode && (
                        <div className="flex justify-between text-amber-400">
                          <span>Promo Applied ({promoAppliedCode}):</span>
                          <span>-৳{originalPrice - finalPrice}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline font-bold text-white">
                        <span>Total Payable:</span>
                        <span className="text-lg text-emerald-400">৳{finalPrice} BDT</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    Select Payment Method:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bkash')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'bkash'
                          ? 'border-pink-500 bg-pink-500/10 text-white shadow-sm'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Smartphone size={16} className="text-pink-400" />
                      <span>bKash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('nagad')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'nagad'
                          ? 'border-orange-500 bg-orange-500/10 text-white shadow-sm'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Smartphone size={16} className="text-orange-400" />
                      <span>Nagad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'bank'
                          ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Building size={16} className="text-blue-400" />
                      <span>Bank</span>
                    </button>
                  </div>
                </div>

                {/* Receiver Info & Copy Box */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-2">
                  <p className="font-semibold text-zinc-200">
                    Step 1: Send Money to the following account:
                  </p>
                  {paymentMethod === 'bkash' && (
                    <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                      <div>
                        <p className="text-[11px] text-zinc-400">bKash Personal / Merchant</p>
                        <p className="font-mono font-bold text-white text-sm">
                          {settings?.bkashNumber || '01712345678'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings?.bkashNumber || '01712345678', 'bkash')}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1"
                      >
                        <Copy size={12} />
                        {copiedText === 'bkash' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'nagad' && (
                    <div className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                      <div>
                        <p className="text-[11px] text-zinc-400">Nagad Personal</p>
                        <p className="font-mono font-bold text-white text-sm">
                          {settings?.nagadNumber || '01712345678'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings?.nagadNumber || '01712345678', 'nagad')}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1"
                      >
                        <Copy size={12} />
                        {copiedText === 'nagad' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'bank' && (
                    <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                      <p className="text-zinc-300 font-semibold">{settings?.bankDetails || 'Bank Transfer'}</p>
                    </div>
                  )}
                </div>

                {/* Form Fields: Sender Number */}
                <div className="space-y-3">
                  <p className="font-semibold text-zinc-200 text-xs">
                    Step 2: Enter your phone number so admin can verify:
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Your bKash / Nagad Sender Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      placeholder="e.g. 017XXXXXXXX"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Your Account Email (optional)
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {submitError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Submit & Open WhatsApp
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
