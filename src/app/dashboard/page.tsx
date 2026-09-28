'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  TrendingUp,
  DollarSign,
  Share2,
  Copy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Smartphone,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getCurrentUserProfile,
  getUserSubscription,
  getAllPaymentSubmissions,
  submitPayoutRequest,
  getAdminSettings,
  getWhatsAppVerificationUrl,
  GUEST_USER_PROFILE,
} from '@/lib/subscription-store';
import {
  getSupabaseUser,
  ensureUserProfileRemote,
  fetchUserPaymentsRemote,
  fetchAdminSettingsRemote,
  submitPayoutRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import type {
  UserProfile,
  UserSubscription,
  PaymentSubmission,
  AdminSettings,
} from '@/types/subscription';

export default function UserDashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sub, setSub] = useState<UserSubscription | null>(null);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Payout request modal
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState(500);
  const [payoutError, setPayoutError] = useState('');

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // 1. Check if Supabase Auth has an active user
      if (isSupabaseConfigured()) {
        const authUser = await getSupabaseUser();
        if (authUser) {
          setIsLoggedIn(true);
          // 2. Fetch or create profile in Supabase
          const remoteProf = await ensureUserProfileRemote(authUser);
          if (remoteProf) {
            setProfile(remoteProf);
            setIsLiveSupabase(true);

            // 3. User subscription derivation
            const localSub = getUserSubscription();
            setSub({
              tier: remoteProf.tier,
              creditsRemaining: remoteProf.creditsRemaining,
              creditsUsed: remoteProf.creditsUsed,
              totalCreditsPurchased: remoteProf.creditsRemaining + remoteProf.creditsUsed,
              startDate: remoteProf.joinedAt,
              expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
              billingCycle: localSub?.billingCycle || 'monthly',
              status: remoteProf.tier === 'TRIAL' ? 'EXPIRED' : 'ACTIVE',
            });

            // 4. Fetch user payments from Supabase
            const userPayments = await fetchUserPaymentsRemote(authUser.id, authUser.email);
            if (userPayments) {
              setSubmissions(userPayments);
            } else {
              setSubmissions(getAllPaymentSubmissions().filter((s) => s.userId === authUser.id || s.userEmail === authUser.email));
            }

            // 5. Admin Settings
            const remoteSettings = await fetchAdminSettingsRemote();
            setSettings(remoteSettings || getAdminSettings());
            setPayoutAmount(Math.min(remoteProf.referralPendingBDT, 500) || 500);
            return;
          }
        }
      }

      // Fallback if not logged in or Supabase offline
      setIsLoggedIn(false);
      setIsLiveSupabase(false);
      const prof = getCurrentUserProfile() || GUEST_USER_PROFILE;
      setProfile(prof);
      const guestSub: UserSubscription = {
        tier: 'TRIAL',
        creditsRemaining: 0,
        creditsUsed: 0,
        totalCreditsPurchased: 0,
        startDate: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
        billingCycle: 'monthly',
        status: 'ACTIVE',
      };
      setSub(getUserSubscription() || guestSub);
      setSubmissions([]);
      setSettings(getAdminSettings());
      setPayoutAmount(500);
    } catch (err) {
      console.warn('Dashboard fetch error, falling back:', err);
      const prof = getCurrentUserProfile() || GUEST_USER_PROFILE;
      setProfile(prof);
      const guestSub: UserSubscription = {
        tier: 'TRIAL',
        creditsRemaining: 0,
        creditsUsed: 0,
        totalCreditsPurchased: 0,
        startDate: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
        billingCycle: 'monthly',
        status: 'ACTIVE',
      };
      setSub(getUserSubscription() || guestSub);
      setSubmissions([]);
      setSettings(getAdminSettings());
      setPayoutAmount(500);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyCode = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopiedCode(true);
    showToast('Promo code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (payoutAmount > profile.referralPendingBDT) {
      setPayoutError(`Amount exceeds your pending balance of ৳${profile.referralPendingBDT}`);
      return;
    }
    if (payoutAmount < 100) {
      setPayoutError('Minimum payout amount is ৳100 BDT');
      return;
    }
    if (!payoutAccount.trim()) {
      setPayoutError('Please provide your bKash or Nagad phone number');
      return;
    }

    if (isLiveSupabase && isLoggedIn) {
      const okRemote = await submitPayoutRemote(profile.id, profile.email, payoutAmount, payoutMethod, payoutAccount.trim());
      if (okRemote) {
        showToast('Payout request submitted to Supabase! Admin notified.');
        setPayoutModalOpen(false);
        setPayoutError('');
        setPayoutAccount('');
        await refreshData();
        return;
      }
    }

    const ok = submitPayoutRequest(profile.id, profile.email, payoutAmount, payoutMethod, payoutAccount.trim());
    if (ok) {
      showToast('Payout request submitted to admin!');
      setPayoutModalOpen(false);
      setPayoutError('');
      setPayoutAccount('');
      refreshData();
    } else {
      setPayoutError('Failed to submit payout request. Try again.');
    }
  };

  if (!profile || !sub) {
    return (
      <div className="min-h-screen bg-bg-base text-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  const creditsPercent = Math.min(
    100,
    Math.round((profile.creditsRemaining / Math.max(1, profile.creditsRemaining + profile.creditsUsed)) * 100)
  );

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Guest Banner if not authenticated */}
        {!isLoggedIn && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <span>
                You are currently browsing in <strong>Guest Demo Mode</strong>. Log in with Google or Email to link your personal bKash/Nagad payments, save generated scenes, and earn 15% affiliate cash.
              </span>
            </div>
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shrink-0 transition-colors"
            >
              Sign In Now &rarr;
            </Link>
          </div>
        )}

        {/* Global Announcement Banner (if active) */}
        {settings?.globalBannerActive && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-purple-500/20 border border-amber-500/30 text-xs font-medium text-amber-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              <span>{settings.globalBannerText}</span>
            </div>
            <Link
              href="/pricing"
              className="text-white underline hover:text-amber-300 font-semibold shrink-0 ml-4"
            >
              View Offers &rarr;
            </Link>
          </div>
        )}

        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Creator Dashboard
              </h1>
              {isLoggedIn && isLiveSupabase ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Supabase Cloud Synced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Guest / Demo Mode
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Welcome back, <strong className="text-zinc-200">{profile.name}</strong> ({profile.email})
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <Link
              href="/project/new"
              className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
            >
              + Create New Video
            </Link>
          </div>
        </div>

        {/* Top 3 KPI Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Subscription Tier */}
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Subscription Plan
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {sub.status}
              </span>
            </div>

            <div>
              <p className="text-2xl font-black text-white tracking-tight">{profile.tier}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {sub.status === 'ACTIVE'
                  ? `Active billing · Renews in ${Math.round((sub.expiresAt - Date.now()) / (24 * 3600 * 1000))} days`
                  : 'Free Trial Plan'}
              </p>
            </div>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
            >
              <span>Upgrade Plan</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* Card 2: Image Credits Meter */}
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Image Credits Balance
              </span>
              <Zap size={18} className="text-amber-400 fill-amber-400" />
            </div>

            <div>
              <p className="text-2xl font-black text-emerald-400 tracking-tight">
                {profile.creditsRemaining} Credits
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {profile.creditsUsed} credits used for videos
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="bg-emerald-400 h-full transition-all duration-500"
                  style={{ width: `${Math.max(5, creditsPercent)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-zinc-500">
                <span>Remaining: {profile.creditsRemaining}</span>
                <Link href="/pricing" className="text-amber-400 hover:underline font-semibold">
                  Top-up Now &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Card 3: Total Spent */}
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Total Invested
              </span>
              <DollarSign size={18} className="text-blue-400" />
            </div>

            <div>
              <p className="text-2xl font-black text-white tracking-tight">
                ৳{profile.totalSpentBDT} BDT
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Across subscriptions and credit packs
              </p>
            </div>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors pt-1"
            >
              <span>Add More Credits</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Affiliate & Promo-code Referral Hub */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Share2 size={13} />
                Creator Affiliate & Referral Program
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Earn 15% Commission on Every Referral
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Share your personal promo code with other content creators or YouTube subscribers. 
                They get <strong>20% discount</strong> and you get <strong>15% cash commission</strong> straight to your bKash/Nagad!
              </p>
            </div>

            {/* Referral Code Box */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-700/80 flex items-center gap-3">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Your Promo Code</p>
                <p className="font-mono font-extrabold text-base text-amber-400">{profile.referralCode}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                title="Copy code"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Referral Analytics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
              <span className="text-[11px] text-zinc-400">Total Code Uses</span>
              <p className="text-2xl font-black text-white mt-1">
                {profile.referralCount}{' '}
                <span className="text-xs font-normal text-zinc-500">creators</span>
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Used your promo code</p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
              <span className="text-[11px] text-zinc-400">Total Money Earned</span>
              <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                ৳{profile.referralEarningsBDT} BDT
              </p>
              <p className="text-[10px] text-emerald-500/80 mt-0.5">Lifetime earnings</p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
              <span className="text-[11px] text-zinc-400">Pending Payout</span>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                ৳{profile.referralPendingBDT} BDT
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Available to withdraw</p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
              <span className="text-[11px] text-zinc-400">Paid Out</span>
              <p className="text-2xl font-black text-zinc-300 mt-1 font-mono">
                ৳{profile.referralPaidBDT} BDT
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Sent to bKash/Nagad</p>
            </div>
          </div>

          {/* Request Payout Action */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800/80">
            <p className="text-xs text-zinc-400">
              Withdraw your commission earnings directly to your personal bKash or Nagad wallet anytime (minimum ৳100).
            </p>
            <button
              onClick={() => {
                setPayoutError('');
                setPayoutModalOpen(true);
              }}
              disabled={profile.referralPendingBDT < 100}
              className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-purple-500/20 shrink-0"
            >
              Withdraw Earnings (৳{profile.referralPendingBDT})
            </button>
          </div>
        </div>

        {/* Payment History & WhatsApp Verification */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={18} className="text-zinc-400" />
                Payment & Order Verification History
              </h2>
              <p className="text-xs text-zinc-400">
                Track your manual bKash/Nagad payment submissions and contact admin on WhatsApp for instant approval
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            {submissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No recent payment submissions. You are currently on the {profile.tier} tier.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Sender Phone</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Credits</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Support Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {submissions.map((sub) => {
                      const waUrl = getWhatsAppVerificationUrl(
                        sub.senderNumber,
                        sub.discountedPriceBDT,
                        sub.planId ? `Plan ${sub.planId}` : `Top-up ${sub.creditsToGrant} Credits`,
                        sub.userEmail
                      );

                      return (
                        <tr key={sub.id} className="hover:bg-zinc-850/40 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            {sub.planId ? `Plan: ${sub.planId}` : `Credit Pack (+${sub.creditsToGrant})`}
                            <span className="text-[10px] text-zinc-500 block font-normal">
                              via {sub.paymentMethod.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-zinc-300">{sub.senderNumber}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            ৳{sub.discountedPriceBDT} BDT
                          </td>
                          <td className="py-3.5 px-4 text-zinc-200">+{sub.creditsToGrant}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                sub.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : sub.status === 'REJECTED'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-amber-500/20 text-amber-400 animate-pulse'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {sub.status === 'PENDING' ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[11px] transition-colors"
                              >
                                <MessageCircle size={13} />
                                Confirm on WhatsApp
                              </a>
                            ) : (
                              <span className="text-zinc-500 text-[11px] italic">Verified</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payout Withdrawal Modal */}
      {payoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-400" />
              Withdraw Referral Commission
            </h3>
            <p className="text-xs text-zinc-400">
              Available Pending Balance:{' '}
              <strong className="text-emerald-400 font-mono">৳{profile.referralPendingBDT} BDT</strong>
            </p>

            <form onSubmit={handleRequestPayout} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Select Wallet</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('bkash')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center ${
                      payoutMethod === 'bkash'
                        ? 'border-pink-500 bg-pink-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    bKash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('nagad')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center ${
                      payoutMethod === 'nagad'
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    Nagad
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Your {payoutMethod.toUpperCase()} Personal Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 017XXXXXXXX"
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Withdrawal Amount (BDT) *</label>
                <input
                  type="number"
                  min="100"
                  max={profile.referralPendingBDT}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
              </div>

              {payoutError && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {payoutError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
