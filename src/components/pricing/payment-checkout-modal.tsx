'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Building,
  Smartphone,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageCircle,
  Tag,
  Sparkles,
} from 'lucide-react';
import {
  getWhatsAppVerificationUrl,
  DEFAULT_ADMIN_SETTINGS,
  type PromoValidationResult,
} from '@/lib/subscription-store';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  PaymentMethod,
  PaymentSubmission,
  AdminSettings,
  BillingCycle,
} from '@/types/subscription';

interface PaymentCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: SubscriptionPlan | null;
  selectedTopup: CreditTopupPack | null;
  billingCycle: BillingCycle;
  isLoggedIn: boolean;
  userEmail: string;
  setUserEmail: (email: string) => void;
  senderNumber: string;
  setSenderNumber: (number: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  settings: AdminSettings | null;
  promoAppliedCode: string;
  promoResult?: PromoValidationResult | null;
  onApplyPromo?: (code: string) => void;
  onRemovePromo?: () => void;
  calculateFinalPrice: () => {
    originalPrice: number;
    finalPrice: number;
    creditsToGrant: number;
    bonusCredits: number;
  };
  onSubmitPayment: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  submitError: string;
  submitSuccess: boolean;
  lastSubmittedReq: PaymentSubmission | null;
  copiedText: string | null;
  handleCopy: (text: string, label: string) => void;
}

export function PaymentCheckoutModal({
  isOpen,
  onClose,
  selectedPlan,
  selectedTopup,
  billingCycle,
  isLoggedIn,
  userEmail,
  setUserEmail,
  senderNumber,
  setSenderNumber,
  paymentMethod,
  setPaymentMethod,
  settings,
  promoAppliedCode,
  promoResult,
  onApplyPromo,
  onRemovePromo,
  calculateFinalPrice,
  onSubmitPayment,
  isSubmitting,
  submitError,
  submitSuccess,
  lastSubmittedReq,
  copiedText,
  handleCopy,
}: PaymentCheckoutModalProps) {
  const [modalCodeInput, setModalCodeInput] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          type="button"
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
                  lastSubmittedReq.userEmail,
                  settings?.whatsappNumber
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
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-xs hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmitPayment} className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400" />
                Complete Your Purchase
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pay manually via bKash, Nagad, or Bank Transfer · Instant WhatsApp Activation
              </p>
            </div>

            {!isLoggedIn && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-white text-xs">Guest Checkout Notice:</p>
                  <p className="text-[11px] text-zinc-300">
                    Credits will be automatically linked to your entered email address upon verification. For seamless instant syncing with your dashboard, we recommend{' '}
                    <Link href="/login" className="text-emerald-400 font-bold underline hover:text-emerald-300">
                      signing in first
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Promo / Referral Code Drawer */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Tag size={13} className="text-emerald-400" />
                  Promo or Referral Code
                </span>
                {promoAppliedCode && onRemovePromo && (
                  <button
                    type="button"
                    onClick={onRemovePromo}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              {promoAppliedCode ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">{promoAppliedCode}</span>
                    <span className="text-[11px] text-zinc-400">
                      {promoResult?.message || 'Discount Active'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded tracking-wide uppercase">
                    APPLIED
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={modalCodeInput}
                      onChange={(e) => setModalCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (modalCodeInput.trim() && onApplyPromo) {
                            onApplyPromo(modalCodeInput.trim().toUpperCase());
                            setModalCodeInput('');
                          }
                        }
                      }}
                      placeholder="e.g. EARLY50 or LAUNCH20"
                      className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white uppercase placeholder:normal-case placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!modalCodeInput.trim()) return;
                        if (onApplyPromo) {
                          onApplyPromo(modalCodeInput.trim().toUpperCase());
                          setModalCodeInput('');
                        }
                      }}
                      disabled={!modalCodeInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-zinc-950 font-bold text-xs transition-colors shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  {promoResult && !promoResult.valid && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertCircle size={12} className="shrink-0" /> {promoResult.message}
                    </p>
                  )}
                </div>
              )}
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
                      {settings?.bkashNumber || DEFAULT_ADMIN_SETTINGS.bkashNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(settings?.bkashNumber || DEFAULT_ADMIN_SETTINGS.bkashNumber, 'bkash')}
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
                      {settings?.nagadNumber || DEFAULT_ADMIN_SETTINGS.nagadNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(settings?.nagadNumber || DEFAULT_ADMIN_SETTINGS.nagadNumber, 'nagad')}
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
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Recording Payment...</span>
                </>
              ) : (
                <span>Submit & Open WhatsApp</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
