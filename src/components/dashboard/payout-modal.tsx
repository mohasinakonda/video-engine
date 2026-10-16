'use client';

import React, { useState } from 'react';
import { DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { formatBdt, requestAffiliatePayout, type AffiliatePayoutMethod } from '@/lib/affiliate';

interface PayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBdt: number;
  minPayoutBdt: number;
  onSubmitted: () => void;
}

export default function PayoutModal({
  isOpen,
  onClose,
  availableBdt,
  minPayoutBdt,
  onSubmitted,
}: PayoutModalProps) {
  const [method, setMethod] = useState<AffiliatePayoutMethod>('bkash');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState(availableBdt);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < minPayoutBdt) {
      setError(`Minimum payout is ${formatBdt(minPayoutBdt)}.`);
      return;
    }
    if (amount > availableBdt) {
      setError(`You can withdraw up to ${formatBdt(availableBdt)}.`);
      return;
    }
    if (!account.trim()) {
      setError('Please enter your bKash or Nagad number.');
      return;
    }

    setSubmitting(true);
    // The server re-checks the balance; these checks above are only for quick feedback.
    const res = await requestAffiliatePayout(amount, method, account);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Could not submit the request. Please try again.');
      return;
    }

    showToast('Payout request sent! You will be notified once it is transferred.');
    setError('');
    setAccount('');
    onSubmitted();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-md p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-400" />
          Withdraw Commission
        </h3>
        <p className="text-xs text-zinc-400">
          Available to withdraw:{' '}
          <strong className="text-emerald-400 font-mono">{formatBdt(availableBdt)}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1">Select Wallet</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('bkash')}
                className={`py-2 px-3 rounded-lg border font-bold text-center transition-colors ${method === 'bkash'
                  ? 'border-pink-500 bg-pink-500/10 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
              >
                bKash
              </button>
              <button
                type="button"
                onClick={() => setMethod('nagad')}
                className={`py-2 px-3 rounded-lg border font-bold text-center transition-colors ${method === 'nagad'
                  ? 'border-orange-500 bg-orange-500/10 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
              >
                Nagad
              </button>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Your {method === 'bkash' ? 'bKash' : 'Nagad'} Personal Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 017XXXXXXXX"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="input font-mono"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Withdrawal Amount (BDT) *</label>
            <input
              type="number"
              min={minPayoutBdt}
              max={availableBdt}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input font-mono font-bold"
            />
            <p className="text-2xs text-zinc-500 mt-1">Minimum {formatBdt(minPayoutBdt)}</p>
          </div>

          {error && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-accent flex-1 flex items-center justify-center gap-1.5">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
