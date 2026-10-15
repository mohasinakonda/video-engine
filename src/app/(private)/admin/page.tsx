'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  XCircle,
  Tag,
  Zap,
  Plus,
  Trash2,
  Smartphone,
  Building,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertCircle,
  Copy,
  ChevronDown,
  Database,
  Loader2,
  Palette,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import {
  getAllPaymentSubmissions,
  approvePaymentRequest,
  rejectPaymentRequest,
  getAllPromoCodes,
  createNewPromoCode,
  deletePromoCode,
  getRevenueAnalytics,
  getUserSubscription,
  grantUserCredits,
} from '@/lib/subscription-store';
import type {
  PaymentSubmission,
  PaymentStatus,
  PromoCode,
  RevenueAnalytics,
  UserSubscription,
  PromoDiscountType,
} from '@/types/subscription';

export default function AdminHubPage() {
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [userSub, setUserSub] = useState<UserSubscription | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Promo Code Modal
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<PromoDiscountType>('PERCENTAGE');
  const [newPromoValue, setNewPromoValue] = useState(20);
  const [newPromoBonusCredits, setNewPromoBonusCredits] = useState(0);
  const [newPromoMaxUses, setNewPromoMaxUses] = useState(100);
  const [newPromoDays, setNewPromoDays] = useState(30);
  const [newPromoDesc, setNewPromoDesc] = useState('');

  // Quick Credit Adjustment State
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState(100);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch payments & revenue analytics
      const payRes = await fetch('/api/admin/payments');
      if (payRes.ok) {
        const payData = await payRes.json();
        if (payData.success) {
          setSubmissions(payData.payments || []);
          setAnalytics(payData.analytics || null);
          setIsLiveSupabase(!!payData.isLiveSupabase);
        } else {
          setAnalytics(getRevenueAnalytics());
          setSubmissions(getAllPaymentSubmissions());
        }
      } else {
        setAnalytics(getRevenueAnalytics());
        setSubmissions(getAllPaymentSubmissions());
      }

      // 2. Fetch promo codes
      const promoRes = await fetch('/api/admin/promos');
      if (promoRes.ok) {
        const promoData = await promoRes.json();
        if (promoData.success && promoData.promos) {
          setPromoCodes(promoData.promos);
        } else {
          setPromoCodes(getAllPromoCodes());
        }
      } else {
        setPromoCodes(getAllPromoCodes());
      }
    } catch (err) {
      console.warn('Error fetching admin data, using local fallback:', err);
      setAnalytics(getRevenueAnalytics());
      setSubmissions(getAllPaymentSubmissions());
      setPromoCodes(getAllPromoCodes());
    } finally {
      setUserSub(getUserSubscription());
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApprove = async (submissionId: string) => {
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', submissionId, adminNote: 'Approved by admin' }),
      });
      const data = await res.json();
      if (data.success) {
        approvePaymentRequest(submissionId, 'Approved by admin');
        showToast(
          data.remoteUpdated
            ? 'Payment approved! Supabase database updated & user credited.'
            : 'Payment approved! Account updated.'
        );
        refreshData();
        return;
      }
    } catch (err) {
      console.warn('Remote approve failed, applying fallback:', err);
    }

    const ok = approvePaymentRequest(submissionId, 'Approved by admin');
    if (ok) {
      showToast('Payment approved in local store.');
      refreshData();
    }
  };

  const handleReject = async (submissionId: string) => {
    const reason = prompt('Enter rejection reason (e.g. Invalid sender number, TrxID mismatch, or unpaid):');
    if (reason === null) return;
    const finalReason = reason.trim() || 'Transaction could not be verified.';

    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', submissionId, adminNote: finalReason }),
      });
      const data = await res.json();
      if (data.success) {
        rejectPaymentRequest(submissionId, finalReason);
        showToast('Payment marked as rejected in database.');
        refreshData();
        return;
      }
    } catch (err) {
      console.warn('Remote reject failed, applying fallback:', err);
    }

    const ok = rejectPaymentRequest(submissionId, finalReason);
    if (ok) {
      showToast('Payment submission marked as rejected.');
      refreshData();
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode.trim()) return;

    const code: PromoCode = {
      code: newPromoCode.trim().toUpperCase(),
      type: newPromoType,
      discountValue: newPromoValue,
      bonusCredits: newPromoType === 'CREDIT_BONUS' ? newPromoBonusCredits : undefined,
      validUntil: Date.now() + newPromoDays * 24 * 60 * 60 * 1000,
      maxUses: newPromoMaxUses,
      currentUses: 0,
      description: newPromoDesc.trim() || `${newPromoCode} promotional discount`,
      isActive: true,
    };

    try {
      await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code),
      });
    } catch (err) {
      console.warn('Remote promo creation failed:', err);
    }

    createNewPromoCode(code);
    setPromoModalOpen(false);
    setNewPromoCode('');
    setNewPromoDesc('');
    showToast(`Promo code "${code.code}" created successfully!`);
    refreshData();
  };

  const handleDeletePromo = async (code: string) => {
    if (!confirm(`Are you sure you want to delete promo code "${code}"?`)) return;

    try {
      await fetch('/api/admin/promos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
    } catch (err) {
      console.warn('Remote promo deletion failed:', err);
    }

    deletePromoCode(code);
    showToast(`Promo code "${code}" removed.`);
    refreshData();
  };

  const handleGrantCredits = (amount: number) => {
    grantUserCredits(amount, 'Admin Manual Adjustment');
    showToast(`Granted +${amount} credits to user account!`);
    refreshData();
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={22} />
              </span>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Admin Monetization & Revenue Hub
                  </h1>

                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Manage manual bKash/Nagad/Bank payments, promo codes, and credit quotas
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/admin/models"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Zap size={14} /> AI Models
            </Link>
            <Link
              href="/admin/styles"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Palette size={14} /> Art Styles
            </Link>
            <Link
              href="/admin/plan"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              Plans & Pricing
            </Link>
            <Link
              href="/admin/users"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              User Directory
            </Link>

            <button
              onClick={refreshData}
              disabled={isLoading}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Analytics KPIs */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-bg-surface border border-bg-border">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium">Total Revenue</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign size={16} />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-white">৳{analytics.totalRevenueBDT.toLocaleString()} BDT</p>
              <p className="text-xxs text-emerald-400 mt-1">Verified earnings</p>
            </div>

            <div className="p-5 rounded-2xl bg-bg-surface border border-bg-border">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium">Pending Verifications</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Clock size={16} />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-amber-400">{analytics.pendingApprovals}</p>
              <p className="text-xxs text-zinc-500 mt-1">Needs your approval</p>
            </div>

            <div className="p-5 rounded-2xl bg-bg-surface border border-bg-border">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium">Active Subscribers</span>
                <span className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <Users size={16} />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-white">{analytics.activeSubscribers}</p>
              <p className="text-xxs text-zinc-500 mt-1">Paying customers</p>
            </div>

            <div className="p-5 rounded-2xl bg-bg-surface border border-bg-border">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-xs font-medium">Images Generated</span>
                <span className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <Zap size={16} />
                </span>
              </div>
              <p className="text-2xl font-extrabold text-white">{analytics.totalImagesGenerated}</p>
              <p className="text-xxs text-zinc-500 mt-1">{analytics.totalCreditsUsed} credits consumed</p>
            </div>
          </div>
        )}

        {/* Section 1: Payment Verification Queue */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={18} className="text-amber-400" />
                Payment Verification Queue
              </h2>
              <p className="text-xs text-zinc-400">
                Verify user bKash/Nagad/Bank transactions and grant credits with 1-click
              </p>
            </div>

            <div className="flex items-center gap-2">
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === filter
                    ? 'bg-zinc-100 text-zinc-950 font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg-surface border border-bg-border rounded-2xl overflow-hidden shadow-sm">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No payment submissions found matching filter &quot;{statusFilter}&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-base border-b border-bg-border text-zinc-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Item & Plan</th>
                      <th className="py-3 px-4">User Details</th>
                      <th className="py-3 px-4">Method & Sender</th>
                      <th className="py-3 px-4">TrxID</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Credits</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bg-border/60">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white block">
                            {sub.planId ? `Plan: ${sub.planId}` : `Top-up Pack`}
                          </span>
                          <span className="text-2xs text-zinc-500">
                            {new Date(sub.submittedAt).toLocaleTimeString()} · {new Date(sub.submittedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-zinc-200 block font-mono">{sub.userEmail}</span>
                          {sub.promoCodeApplied && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-400/10 text-amber-400 rounded text-2xs font-mono">
                              Promo: {sub.promoCodeApplied}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="uppercase font-bold text-2xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {sub.paymentMethod}
                            </span>
                            <span className="font-mono text-zinc-300">{sub.senderNumber}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {sub.trxId ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-white bg-bg-base px-2 py-1 rounded border border-bg-border">
                                {sub.trxId}
                              </span>
                              <button
                                onClick={() => handleCopy(sub.trxId!, sub.id)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copy TrxID"
                              >
                                <Copy size={13} />
                              </button>
                              {copiedId === sub.id && <span className="text-2xs text-emerald-400">Copied!</span>}
                            </div>
                          ) : (
                            <span className="text-xxs text-zinc-400 font-mono">📱 WhatsApp/Phone</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          ৳{sub.discountedPriceBDT}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          +{sub.creditsToGrant}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${sub.status === 'APPROVED'
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
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprove(sub.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xxs transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(sub.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-medium text-xxs transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xxs text-zinc-500 italic">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Promo Codes & Growth Engine */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag size={18} className="text-zinc-400" />
                Promo Codes & Discount Engine
              </h2>
              <p className="text-xs text-zinc-400">
                Create promotional coupons for YouTube influencers, Facebook groups, or launch events
              </p>
            </div>
            <button
              onClick={() => setPromoModalOpen(true)}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <Plus size={15} />
              Create Promo Code
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promoCodes.map((promo) => {
              const isExpired = promo.validUntil < Date.now();
              return (
                <div
                  key={promo.code}
                  className="p-5 rounded-2xl bg-bg-surface border border-bg-border space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-extrabold text-lg text-white bg-bg-base px-2.5 py-1 rounded-lg border border-bg-border">
                        {promo.code}
                      </span>
                      <p className="text-xs text-zinc-400 mt-2 font-medium">{promo.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeletePromo(promo.code)}
                      className="text-zinc-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete code"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-bg-border/80 flex items-center justify-between text-xs">
                    <span className="text-zinc-200 font-semibold">
                      {promo.type === 'PERCENTAGE'
                        ? `${promo.discountValue}% OFF`
                        : promo.type === 'FIXED'
                          ? `৳${promo.discountValue} OFF`
                          : `+${promo.bonusCredits} Bonus Credits`}
                    </span>
                    <span className="text-zinc-400">
                      Used: <strong className="text-white">{promo.currentUses}</strong> / {promo.maxUses}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xxs text-zinc-500">
                    <span>
                      {isExpired ? 'Expired' : `Expires in ${Math.round((promo.validUntil - Date.now()) / (24 * 3600 * 1000))} days`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-bold ${promo.isActive && !isExpired ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-800'
                        }`}
                    >
                      {promo.isActive && !isExpired ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: User Quota & Live Support Granter */}
        <div className="p-6 rounded-2xl bg-bg-surface border border-bg-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-zinc-300" />
                Live Customer Support Credit Granter
              </h2>
              <p className="text-xs text-zinc-400">
                Grant instant bonus credits to users for support, refunds, or VIP customer care
              </p>
            </div>
            {userSub && (
              <div className="text-right">
                <p className="text-xs text-zinc-400">Target User Balance</p>
                <p className="text-sm font-bold text-emerald-400">{userSub.creditsRemaining} Credits</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleGrantCredits(50)}
              className="btn-secondary text-xs py-2 px-4"
            >
              +50 Credits
            </button>
            <button
              onClick={() => handleGrantCredits(100)}
              className="btn-secondary text-xs py-2 px-4"
            >
              +100 Credits
            </button>
            <button
              onClick={() => handleGrantCredits(250)}
              className="btn-secondary text-xs py-2 px-4"
            >
              +250 Credits
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="number"
                value={creditAdjustmentAmount}
                onChange={(e) => setCreditAdjustmentAmount(Number(e.target.value))}
                className="w-24 bg-bg-base border border-bg-border rounded-xl px-3 py-1.5 text-xs text-white"
                placeholder="Amount"
              />
              <button
                onClick={() => handleGrantCredits(creditAdjustmentAmount)}
                className="btn-primary text-xs py-1.5 px-4"
              >
                Grant Custom
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Promo Code Modal */}
      {promoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag size={16} className="text-zinc-400" />
                Create New Promo Code
              </h3>
              <button onClick={() => setPromoModalOpen(false)} className="text-zinc-400 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Coupon Code (Uppercase)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. YOUTUBE50"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                  className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white font-mono uppercase focus:border-zinc-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Discount Type</label>
                <select
                  value={newPromoType}
                  onChange={(e) => setNewPromoType(e.target.value as PromoDiscountType)}
                  className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white focus:border-zinc-500 outline-none"
                >
                  <option value="PERCENTAGE">Percentage Discount (%)</option>
                  <option value="FIXED">Fixed Amount Discount (BDT)</option>
                  <option value="CREDIT_BONUS">Bonus Image Credits (+Credits)</option>
                </select>
              </div>

              {newPromoType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Percentage Off (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newPromoValue}
                    onChange={(e) => setNewPromoValue(Number(e.target.value))}
                    className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              )}

              {newPromoType === 'FIXED' && (
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Discount Amount (BDT)</label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoValue}
                    onChange={(e) => setNewPromoValue(Number(e.target.value))}
                    className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              )}

              {newPromoType === 'CREDIT_BONUS' && (
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Bonus Credits to Grant</label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoBonusCredits}
                    onChange={(e) => setNewPromoBonusCredits(Number(e.target.value))}
                    className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Max Uses Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoMaxUses}
                    onChange={(e) => setNewPromoMaxUses(Number(e.target.value))}
                    className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Valid Days</label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoDays}
                    onChange={(e) => setNewPromoDays(Number(e.target.value))}
                    className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Description / Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Eid special 50% discount"
                  value={newPromoDesc}
                  onChange={(e) => setNewPromoDesc(e.target.value)}
                  className="w-full bg-bg-surface border border-bg-border rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="btn-primary w-full py-2.5 rounded-xl font-bold"
                >
                  Create & Launch Promo Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
