'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Tag,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Gift,
  Coins,
  RefreshCw,
  Percent,
} from 'lucide-react';
import {
  getAllUsers,
  saveAllUsers,
  setUserBlockStatus,
  adjustUserCredits,
  assignUserPromoCode,
  getAllPayoutRequests,
  approvePayoutRequest,
} from '@/lib/subscription-store';
import type { UserProfile, AffiliatePayoutRequest } from '@/types/subscription';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayoutRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modal State for Credits / Promo assignment
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState(100);

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [assignedCode, setAssignedCode] = useState('');

  // Influencer Rates Modal State
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [customRefCode, setCustomRefCode] = useState('');
  const [customDiscountPct, setCustomDiscountPct] = useState(20);
  const [customCommissionPct, setCustomCommissionPct] = useState(15);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const remoteUsers = data.users || [];
          const localUsers = getAllUsers();
          setUsers(remoteUsers.length > 0 ? remoteUsers : localUsers);
          setPayouts(data.payouts || getAllPayoutRequests());
          setIsLiveSupabase(!!data.isLiveSupabase);
        } else {
          setUsers(getAllUsers());
          setPayouts(getAllPayoutRequests());
        }
      } else {
        setUsers(getAllUsers());
        setPayouts(getAllPayoutRequests());
      }
    } catch (err) {
      console.warn('Error fetching users from API, falling back:', err);
      setUsers(getAllUsers());
      setPayouts(getAllPayoutRequests());
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

  const handleToggleBlock = async (user: UserProfile) => {
    if (user.isBlocked) {
      try {
        await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggleBlock', userId: user.id, isBlocked: false }),
        });
      } catch (err) {
        console.warn('Remote unblock failed:', err);
      }
      setUserBlockStatus(user.id, false);
      showToast(`Unblocked user ${user.name}`);
    } else {
      const reason = prompt(`Enter reason for blocking ${user.name}:`, 'Suspected fake payment submissions or terms violation');
      if (reason === null) return;
      try {
        await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggleBlock', userId: user.id, isBlocked: true, reason }),
        });
      } catch (err) {
        console.warn('Remote block failed:', err);
      }
      setUserBlockStatus(user.id, true, reason);
      showToast(`Blocked user ${user.name}`);
    }
    refreshData();
  };

  const handleGrantCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjustCredits', userId: selectedUser.id, amount: creditAmount }),
      });
    } catch (err) {
      console.warn('Remote credit grant failed:', err);
    }
    adjustUserCredits(selectedUser.id, creditAmount);
    showToast(`Granted ${creditAmount > 0 ? `+${creditAmount}` : creditAmount} credits to ${selectedUser.name}`);
    setCreditModalOpen(false);
    refreshData();
  };

  const handleAssignPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !assignedCode.trim()) return;
    const code = assignedCode.trim().toUpperCase();
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assignPromo', userId: selectedUser.id, promoCode: code }),
      });
    } catch (err) {
      console.warn('Remote promo assign failed:', err);
    }
    assignUserPromoCode(selectedUser.id, code);
    showToast(`Assigned promo code ${code} to ${selectedUser.name}`);
    setPromoModalOpen(false);
    refreshData();
  };

  const handleOpenRatesModal = (user: UserProfile) => {
    setSelectedUser(user);
    setCustomRefCode(user.referralCode || '');
    setCustomDiscountPct(user.referralDiscountPercent ?? 20);
    setCustomCommissionPct(user.referralCommissionPercent ?? 15);
    setRatesModalOpen(true);
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateReferralRates',
          userId: selectedUser.id,
          referralCode: customRefCode.trim().toUpperCase(),
          discountPercent: Number(customDiscountPct),
          commissionPercent: Number(customCommissionPct),
        }),
      });
      showToast(`Updated rates for ${selectedUser.name}: ${customDiscountPct}% user discount, ${customCommissionPct}% affiliate commission`);
    } catch (err) {
      console.warn('Failed to update referral rates:', err);
      showToast('Failed to update referral rates');
    }
    setRatesModalOpen(false);
    refreshData();
  };

  const handleApprovePayout = (payoutId: string) => {
    if (confirm('Did you send the money to this user via bKash/Nagad? Mark as paid?')) {
      approvePayoutRequest(payoutId, 'Paid via bKash/Nagad by Admin');
      showToast('Payout marked as PAID!');
      refreshData();
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      (u.referralCode || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft size={13} /> Back to Admin Hub
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <Users size={26} className="text-blue-400" />
                User Directory & Anti-Abuse Manager
              </h1>

            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Monitor active users, block fraudulent accounts, grant credits, and manage affiliate payouts
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/admin/models"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-cyan-500/30 text-xs font-semibold text-cyan-400 transition-colors"
            >
              AI Models
            </Link>
            <Link
              href="/admin/plan"
              className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-colors"
            >
              Edit Plans & Pricing
            </Link>
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Search Bar & User Table */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>All Registered Users ({users.length})</span>
            </h2>
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search user by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Plan & Status</th>
                    <th className="py-3 px-4">Credits</th>
                    <th className="py-3 px-4">Total Spent</th>
                    <th className="py-3 px-4">Referral Code & Earnings</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        <Users size={32} className="mx-auto mb-2 opacity-30 text-zinc-400" />
                        <p className="font-medium text-zinc-400 text-sm">
                          {searchQuery ? 'No users matching your search' : 'No registered users found'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {searchQuery
                            ? 'Try clearing the search query'
                            : 'When users sign up with Google or Email, they will appear here.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-zinc-850/40 transition-colors ${user.isBlocked ? 'bg-rose-950/20' : ''
                          }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-8 h-8 rounded-full border border-zinc-700 object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                {(user.name || 'C').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-white block truncate">{user.name}</span>
                              <span className="text-[11px] text-zinc-400 font-mono block truncate">{user.email}</span>
                              {user.phone && (
                                <span className="text-[10px] text-zinc-500 block font-mono">📱 {user.phone}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300">
                            {user.tier}
                          </span>
                          {user.isBlocked ? (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              BLOCKED
                            </span>
                          ) : (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                          {user.role === 'admin' && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              ADMIN
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-emerald-400 flex items-center gap-1 font-mono">
                            <Zap size={13} className="fill-emerald-400" />
                            {user.creditsRemaining} Left
                          </span>
                          <span className="text-[10px] text-zinc-500">{user.creditsUsed} used</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          ৳{user.totalSpentBDT} BDT
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-amber-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              {user.referralCode}
                            </span>
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                              {user.referralDiscountPercent ?? 20}% off
                            </span>
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 font-medium">
                              {user.referralCommissionPercent ?? 15}% comm
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-1">
                            {user.referralCount} users · ৳{user.referralEarningsBDT} earned
                          </span>
                          {user.assignedPromoCode && (
                            <span className="text-[10px] text-purple-400 block mt-0.5">
                              Special Code: {user.assignedPromoCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setCreditModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1"
                              title="Adjust Credits"
                            >
                              <Coins size={12} className="text-amber-400" />
                              Credit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setPromoModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1"
                              title="Assign Promo Code"
                            >
                              <Tag size={12} className="text-purple-400" />
                              Promo
                            </button>
                            <button
                              onClick={() => handleOpenRatesModal(user)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium flex items-center gap-1"
                              title="Custom Influencer Rates"
                            >
                              <Percent size={12} className="text-emerald-400" />
                              Rates
                            </button>
                            <button
                              onClick={() => handleToggleBlock(user)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${user.isBlocked
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400'
                                }`}
                            >
                              {user.isBlocked ? (
                                <>
                                  <ShieldCheck size={12} /> Unblock
                                </>
                              ) : (
                                <>
                                  <ShieldAlert size={12} /> Block
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 2: Affiliate & Creator Payout Requests */}
        <div className="space-y-4 pt-6 border-t border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-400" />
              Affiliate Commission Payout Queue
            </h2>
            <p className="text-xs text-zinc-400">
              When users earn commission from promo code referrals, send money to their bKash/Nagad and approve here
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {payouts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No affiliate payout requests at the moment.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method & Account</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {payouts.map((req) => (
                    <tr key={req.id}>
                      <td className="py-3 px-4 text-white font-medium">{req.userEmail}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">৳{req.amountBDT}</td>
                      <td className="py-3 px-4">
                        <span className="uppercase font-bold text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 mr-2">
                          {req.paymentMethod}
                        </span>
                        <span className="font-mono text-zinc-200">{req.accountNumber}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                            }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'PENDING' ? (
                          <button
                            onClick={() => handleApprovePayout(req.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[11px]"
                          >
                            Mark as Paid
                          </button>
                        ) : (
                          <span className="text-zinc-500 text-[11px] italic">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Credit Adjustment Modal */}
      {creditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Coins size={16} className="text-amber-400" />
              Adjust Credits for {selectedUser.name}
            </h3>
            <p className="text-xs text-zinc-400">
              Current balance: <strong className="text-emerald-400">{selectedUser.creditsRemaining} Credits</strong>
            </p>
            <form onSubmit={handleGrantCredits} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Add/Deduct Credits (+ or -)</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Promo Modal */}
      {promoModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag size={16} className="text-purple-400" />
              Assign Promo Code to {selectedUser.name}
            </h3>
            <form onSubmit={handleAssignPromo} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Promo Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP50"
                  value={assignedCode}
                  onChange={(e) => setAssignedCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono uppercase"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPromoModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold"
                >
                  Assign Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Influencer Custom Rates Modal */}
      {ratesModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Percent size={16} className="text-emerald-400" />
                Influencer Rates & Referral Code
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Customize negotiated terms for {selectedUser.name} ({selectedUser.email})
              </p>
            </div>
            <form onSubmit={handleSaveRates} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Referral / Promo Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HAZRAT15 or REF-BBD2D"
                  value={customRefCode}
                  onChange={(e) => setCustomRefCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  User Discount Percentage (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={customDiscountPct}
                    onChange={(e) => setCustomDiscountPct(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-sm"
                  />
                  <span className="text-zinc-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Audience who uses this code will get {customDiscountPct}% off the plan price.
                </p>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  Influencer Commission Percentage (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={customCommissionPct}
                    onChange={(e) => setCustomCommissionPct(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-sm"
                  />
                  <span className="text-zinc-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Influencer will earn {customCommissionPct}% of the purchase in their payout wallet.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRatesModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
                >
                  Save Rates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
