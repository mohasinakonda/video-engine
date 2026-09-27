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
  TrendingUp,
  ShieldCheck,
  Coins,
  ChevronRight,
} from 'lucide-react';
import {
  getSubscriptionPlans,
  getTopupPacks,
  getAdminSettings,
  getUserSubscription,
  getCurrentUserProfile,
  validateAndApplyPromoCode,
  submitPaymentRequest,
  getAllPaymentSubmissions,
  getWhatsAppVerificationUrl,
  type PromoValidationResult,
} from '@/lib/subscription-store';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  PaymentMethod,
  PaymentSubmission,
  UserSubscription,
  UserProfile,
  AdminSettings,
  BillingCycle,
} from '@/types/subscription';

interface PricingClientProps {
  initialUser: User | null;
}

export default function PricingClient({ initialUser }: PricingClientProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(initialUser));
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [topupPacks, setTopupPacks] = useState<CreditTopupPack[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [userSub, setUserSub] = useState<UserSubscription | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
  const [promoAppliedCode, setPromoAppliedCode] = useState('');
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);

  // Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedTopup, setSelectedTopup] = useState<CreditTopupPack | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [userEmail, setUserEmail] = useState(initialUser?.email || '');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastSubmittedReq, setLastSubmittedReq] = useState<PaymentSubmission | null>(null);

  const refreshData = async () => {
    setPlans(getSubscriptionPlans());
    setTopupPacks(getTopupPacks());
    setSettings(getAdminSettings());
    const sub = getUserSubscription();
    setUserSub(sub);
    const profile = getCurrentUserProfile();
    setUserProfile(profile);
    setSubmissions(getAllPaymentSubmissions());

    // Verify authentication via Supabase client session
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        setUserEmail(session.user.email || '');
      } else {
        // Fallback to initialUser from server if available
        setIsLoggedIn(Boolean(initialUser));
      }
    } catch {
      setIsLoggedIn(Boolean(initialUser));
    }
  };

  useEffect(() => {
    refreshData();

    // Listen to real-time auth changes (e.g. login/logout)
    try {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setIsLoggedIn(true);
          setUserEmail(session.user.email || '');
        } else {
          setIsLoggedIn(false);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // Supabase listener silent fallback
    }
  }, [initialUser]);

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

    // Apply promo if entered
    if (promoAppliedCode) {
      const res = validateAndApplyPromoCode(promoAppliedCode, originalPrice);
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

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!senderNumber.trim()) {
      setSubmitError('Please enter your sender mobile number');
      return;
    }

    const { originalPrice, finalPrice, creditsToGrant } = calculateFinalPrice();

    try {
      const created = submitPaymentRequest({
        userId: initialUser?.id || userProfile?.id || ('user_' + Date.now()),
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
      });

      setLastSubmittedReq(created);
      setSubmitSuccess(true);
      setSubmissions(getAllPaymentSubmissions());
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Failed to submit payment. Try again.');
    }
  };

  const creditsRemaining = userProfile?.creditsRemaining ?? userSub?.creditsRemaining ?? 30;
  const creditsUsed = userProfile?.creditsUsed ?? userSub?.creditsUsed ?? 0;
  const totalCredits = creditsRemaining + creditsUsed;
  const creditsPercent = Math.min(100, Math.round((creditsRemaining / Math.max(1, totalCredits)) * 100));
  const isExpiringSoon = userSub?.status === 'ACTIVE' && userSub.expiresAt - Date.now() < 3 * 24 * 3600 * 1000;
  const isExpired = userSub?.status === 'EXPIRED';

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Top Breadcrumb & User Status */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pb-2 border-b border-zinc-850">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <span className="text-zinc-300 font-medium">
              {isLoggedIn ? 'Credits & Subscription Summary' : 'Plans & Pricing'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {userEmail || 'Active Session'}
              </span>
            ) : (
              <Link
                href="/login"
                className="text-[11px] text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <span>Existing creator?</span>
                <span className="text-emerald-400 font-semibold underline">Sign In &rarr;</span>
              </Link>
            )}
          </div>
        </div>

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

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW A: LOGGED-IN USAGE SUMMARY & ACTION HUB
           ══════════════════════════════════════════════════════════════════════ */}
        {isLoggedIn ? (
          <div className="space-y-10">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                <ShieldCheck size={14} />
                Your Account & Quota Status
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Credits & Subscription Usage
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Monitor your current image quota, renewal dates, and instantly top up or upgrade when needed.
              </p>
            </div>

            {/* Top 3 Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Subscription Status & Renewal */}
              <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Current Plan
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isExpired
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isExpiringSoon
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {userSub?.status || 'ACTIVE'}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-white">{userSub?.tier || 'TRIAL'}</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {userSub?.status === 'ACTIVE'
                      ? `Active cycle · Renews in ${Math.round(
                          (userSub.expiresAt - Date.now()) / (24 * 3600 * 1000)
                        )} days`
                      : isExpired
                      ? 'Subscription has expired. Renew to resume 1080p rendering.'
                      : 'Free trial tier (30 starter credits)'}
                  </p>
                </div>

                <div className="pt-1">
                  <a
                    href="#plans-section"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>{isExpired ? 'Renew Subscription' : 'Upgrade Plan'}</span>
                    <ChevronRight size={14} />
                  </a>
                </div>
              </div>

              {/* Card 2: Live Credit Balance Meter */}
              <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Available Image Credits
                  </span>
                  <Zap size={18} className="text-amber-400 fill-amber-400" />
                </div>

                <div>
                  <p className="text-2xl font-black text-emerald-400">{creditsRemaining} Credits</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {creditsUsed} credits consumed for generated scenes
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        creditsRemaining > 20 ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.max(5, creditsPercent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span
                      className={`font-semibold ${
                        creditsRemaining > 20 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {creditsRemaining > 50
                        ? '🟢 Ready for ~15+ videos'
                        : creditsRemaining > 10
                        ? '🟡 Low credits warning'
                        : '🔴 Recharging needed'}
                    </span>
                    <a href="#topup-section" className="text-amber-400 hover:underline font-semibold">
                      + Top Up &rarr;
                    </a>
                  </div>
                </div>
              </div>

              {/* Card 3: Account & Support */}
              <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Account & Support
                  </span>
                  <Smartphone size={18} className="text-blue-400" />
                </div>

                <div>
                  <p className="text-2xl font-black text-white">
                    ৳{userProfile?.totalSpentBDT || 0} BDT
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Total investment across subscriptions & top-ups
                  </p>
                </div>

                <div className="pt-1">
                  <a
                    href="https://wa.me/8801712345678"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp VIP Support</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Action 1: Instant Credit Top-ups */}
            <div id="topup-section" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Coins size={20} className="text-amber-400" />
                    Instant Credit Top-Up Packs
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Add image credits immediately via bKash or Nagad. Credits never expire!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {topupPacks.map((pack) => (
                  <div
                    key={pack.id}
                    className={`rounded-3xl p-6 bg-zinc-900/80 border transition-all relative ${
                      pack.popular
                        ? 'border-amber-400/60 shadow-lg shadow-amber-950/20'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-bold text-[10px] uppercase tracking-wider">
                        Most Popular
                      </span>
                    )}
                    <h4 className="text-base font-bold text-white">{pack.name}</h4>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">৳{pack.priceBDT}</span>
                      <span className="text-xs text-zinc-400">BDT</span>
                    </div>
                    <p className="text-xs text-emerald-400 font-semibold mt-1">
                      {pack.credits} Image Credits (~{Math.round(pack.credits / 15)} videos)
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      ৳{pack.perCreditBDT.toFixed(2)} per credit
                    </p>

                    <button
                      onClick={() => openCheckoutForTopup(pack)}
                      className="w-full mt-5 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Zap size={14} className="fill-zinc-950" />
                      Top-up {pack.credits} Credits
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action 2: Change or Renew Subscription Plan */}
            <div id="plans-section" className="space-y-4 pt-6 border-t border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-emerald-400" />
                    Renew or Change Subscription Plan
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Switch to a higher quota tier or extend your existing monthly subscription
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      billingCycle === 'monthly' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                      billingCycle === 'yearly' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Yearly</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9px] font-bold">
                      20% OFF
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const rawPrice = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
                  const isCurrent = userSub?.tier === plan.id && userSub?.status === 'ACTIVE';

                  return (
                    <div
                      key={plan.id}
                      className={`p-6 rounded-3xl border transition-all flex flex-col ${
                        isCurrent
                          ? 'bg-zinc-850/60 border-emerald-500'
                          : plan.popular
                          ? 'bg-zinc-900 border-zinc-700'
                          : 'bg-zinc-900/40 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-white text-base">{plan.name}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-zinc-950">
                            Active Plan
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <span className="text-3xl font-extrabold text-white">৳{rawPrice}</span>
                        <span className="text-xs text-zinc-400"> / {billingCycle}</span>
                        <p className="text-xs text-emerald-400 font-semibold mt-1">
                          {plan.creditsPerMonth} Image Credits / month
                        </p>
                      </div>

                      <ul className="space-y-2 text-xs text-zinc-300 flex-1 mb-6">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => openCheckoutForPlan(plan)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors ${
                          isCurrent
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-white hover:bg-zinc-200 text-zinc-950'
                        }`}
                      >
                        {isCurrent ? 'Renew This Plan' : `Switch to ${plan.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Payment History */}
            {submissions.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Clock size={16} />
                  Your Recent Payment Submissions
                </h3>
                <div className="space-y-2">
                  {submissions.slice(0, 4).map((sub) => {
                    const waUrl = getWhatsAppVerificationUrl(
                      sub.senderNumber,
                      sub.discountedPriceBDT,
                      sub.planId ? `Plan ${sub.planId}` : `Topup (+${sub.creditsToGrant} Credits)`,
                      sub.userEmail
                    );

                    return (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {sub.planId ? `Plan: ${sub.planId}` : `Top-up: +${sub.creditsToGrant} Credits`}
                            </span>
                            <span className="text-zinc-500 ml-2">
                              via {sub.paymentMethod.toUpperCase()} ({sub.senderNumber})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-400">
                            ৳{sub.discountedPriceBDT} BDT
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sub.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : sub.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {sub.status}
                          </span>
                          {sub.status === 'PENDING' && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[10px] flex items-center gap-1"
                            >
                              <MessageCircle size={12} /> Confirm on WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════════
              VIEW B: GUEST VIEW (CLEAN GENERAL CREATOR PRICING)
             ══════════════════════════════════════════════════════════════════════ */
          <div className="space-y-12">
            {/* Header */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles size={14} />
                Predictable Bangladeshi Creator Pricing
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Simple, Transparent Subscriptions
              </h1>
              <p className="text-zinc-400 text-base sm:text-lg">
                Pay easily via <strong className="text-zinc-200">bKash</strong>, <strong className="text-zinc-200">Nagad</strong>, or <strong className="text-zinc-200">Bank Transfer</strong>. 
                Instant WhatsApp verification with zero hidden charges.
              </p>

              {/* Free Trial Banner */}
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <Coins size={14} className="text-amber-400" />
                  <span>New creator? <strong>Sign in to get 30 Free Credits</strong> &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Promo Code Input Bar */}
            <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-md backdrop-blur-sm">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag size={13} className="text-amber-400" />
                  Have a Promo Code or Referral Coupon?
                </span>
                <span className="text-[11px] text-zinc-500 font-normal">Try: EARLY50</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. EARLY50, LAUNCH20"
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

            {/* The 3 Core Subscription Cards (No Top-ups on Guest View) */}
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

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-3xl p-6 sm:p-8 transition-all ${
                      plan.popular
                        ? 'bg-zinc-900 border-2 border-emerald-500/70 shadow-2xl'
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
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        plan.popular
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20'
                          : 'bg-white hover:bg-zinc-200 text-zinc-950'
                      }`}
                    >
                      <span>Choose {plan.name}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Manual Payment Checkout Modal (WhatsApp Assisted) */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
                  Click the button below to message the admin directly on WhatsApp with your phone number. 
                  Your credits will be activated immediately!
                </p>

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

                {/* Method selector */}
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

                {/* Receiver Info */}
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

                {/* Form fields */}
                <div className="space-y-3">
                  <p className="font-semibold text-zinc-200 text-xs">
                    Step 2: Enter your sender phone number:
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
