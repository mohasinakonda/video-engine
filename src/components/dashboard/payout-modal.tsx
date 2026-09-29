'use client';

import React, { Dispatch, SetStateAction, useState } from 'react';
import { DollarSign, AlertCircle } from 'lucide-react';
import { UserProfile } from '@/types/subscription';
import { submitPayoutRemote } from '@/lib/supabase-service';
import { submitPayoutRequest } from '@/lib/subscription-store';

interface PayoutModalProps {
  isOpen: boolean;
  setPayoutModalOpen: Dispatch<SetStateAction<boolean>>
  onClose: () => void;
  pendingBDT: number;
  payoutMethod: 'bkash' | 'nagad';
  setPayoutMethod: (method: 'bkash' | 'nagad') => void;
  payoutAccount: string;
  setPayoutAccount: (account: string) => void;
  payoutAmount: number;
  setPayoutAmount: (amount: number) => void;
  profile: UserProfile
  refreshData: () => Promise<void>
  isLiveSupabase: boolean;
  isLoggedIn: boolean;
}

export default function PayoutModal({
  isOpen,
  onClose,
  pendingBDT,
  payoutMethod,
  setPayoutMethod,
  payoutAccount,
  setPayoutAccount,
  payoutAmount,
  setPayoutAmount,
  profile,
  setPayoutModalOpen,
  refreshData,
  isLiveSupabase,
  isLoggedIn
}: PayoutModalProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState('');
  if (!isOpen) return null;


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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
      const okRemote = await submitPayoutRemote(
        profile.id,
        profile.email,
        payoutAmount,
        payoutMethod,
        payoutAccount.trim()
      );
      if (okRemote) {
        showToast('Payout request submitted to Supabase! Admin notified.');
        setPayoutModalOpen(false);
        setPayoutError('');
        setPayoutAccount('');
        await refreshData();
        return;
      }
    }

    const ok = submitPayoutRequest(
      profile.id,
      profile.email,
      payoutAmount,
      payoutMethod,
      payoutAccount.trim()
    );
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-400" />
          Withdraw Referral Commission
        </h3>
        <p className="text-xs text-zinc-400">
          Available Pending Balance:{' '}
          <strong className="text-emerald-400 font-mono">৳{pendingBDT} BDT</strong>
        </p>

        <form onSubmit={handleRequestPayout} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Select Wallet</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayoutMethod('bkash')}
                className={`py-2 px-3 rounded-xl border font-bold text-center ${payoutMethod === 'bkash'
                  ? 'border-pink-500 bg-pink-500/10 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  }`}
              >
                bKash
              </button>
              <button
                type="button"
                onClick={() => setPayoutMethod('nagad')}
                className={`py-2 px-3 rounded-xl border font-bold text-center ${payoutMethod === 'nagad'
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
              max={pendingBDT}
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
              onClick={onClose}
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
  );
}
