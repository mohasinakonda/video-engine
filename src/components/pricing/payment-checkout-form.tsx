'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import bkashQr from '@/qr-code/bkash-qr.jpeg';
import {
  CreditCard,
  Building,
  Smartphone,
  Copy,
  AlertCircle,
  Tag,
  Download,
  QrCode,
} from 'lucide-react';
import type { PromoValidationResult } from '@/lib/subscription-store';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  PaymentMethod,
  AdminSettings,
  BillingCycle,
  PlanTier,
} from '@/types/subscription';
import { getPlanChange } from '@/lib/plan-pricing';

const METHOD_STYLES: Record<
  PaymentMethod,
  { label: string; accountLabel: string; Icon: typeof Smartphone; iconClass: string; activeClass: string }
> = {
  bkash: { label: 'bKash', accountLabel: 'bKash Merchant', Icon: Smartphone, iconClass: 'text-pink-400', activeClass: 'border-pink-500' },
  nagad: { label: 'Nagad', accountLabel: 'Nagad', Icon: Smartphone, iconClass: 'text-orange-400', activeClass: 'border-orange-500 bg-orange-500/10' },
  bank: { label: 'Bank', accountLabel: 'Bank Transfer', Icon: Building, iconClass: 'text-blue-400', activeClass: 'border-blue-500 bg-blue-500/10' },
};

const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

/** Payment methods the admin has set an account for, in display order. */
function getAvailableMethods(settings: AdminSettings | null): { id: PaymentMethod; account: string }[] {
  const accounts: [PaymentMethod, string | undefined][] = [
    ['bkash', settings?.bkashNumber],
    ['nagad', settings?.nagadNumber],
    ['bank', settings?.bankDetails],
  ];
  return accounts
    .map(([id, account]) => ({ id, account: (account || '').trim() }))
    .filter((m) => m.account.length > 0);
}

export interface PaymentCheckoutFormProps {
  /** The user's effective tier, to explain what an upgrade does. */
  currentTier?: PlanTier;
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
  copiedText: string | null;
  handleCopy: (text: string, label: string) => void;
}

/** Manual bKash / Nagad / bank checkout: promo code, order summary, receiver account and sender details. */
export function PaymentCheckoutForm({
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
  copiedText,
  handleCopy,
  currentTier = 'TRIAL',
}: PaymentCheckoutFormProps) {
  const [modalCodeInput, setModalCodeInput] = useState('');
  const { originalPrice, finalPrice, creditsToGrant, bonusCredits } = calculateFinalPrice();
  const itemLabel = selectedPlan
    ? `${selectedPlan.name} (${billingCycle === 'quarterly' ? '3 Months' : 'Monthly'})`
    : selectedTopup?.name;

  const isUpgrade = Boolean(selectedPlan) && getPlanChange(currentTier, selectedPlan!.id) === 'upgrade';

  const availableMethods = getAvailableMethods(settings);
  const activeMethod = availableMethods.find((m) => m.id === paymentMethod);

  // Keep the selection on a method that is actually offered.
  useEffect(() => {
    if (availableMethods.length > 0 && !activeMethod) {
      setPaymentMethod(availableMethods[0].id);
    }
  }, [availableMethods, activeMethod, setPaymentMethod]);

  return (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {/* Left: how and where to pay */}
        <div className="space-y-4">
          <StepHeading step={1} title={`Send ৳${finalPrice}`} />
          {/* Method selector: only methods the admin has filled in are offered */}
          {availableMethods.length === 0 ? (
            <p className="text-xs text-amber-300 flex items-center gap-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={14} className="shrink-0" />
              {settings ? 'Payments are not available right now. Please contact support.' : 'Loading payment details...'}
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Select Payment Method:
                </label>
                <div className={`grid gap-2 ${GRID_COLS[availableMethods.length]}`}>
                  {availableMethods.map((method) => {
                    const { label, Icon, iconClass, activeClass } = METHOD_STYLES[method.id];
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`py-1.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${paymentMethod === method.id
                          ? `${activeClass} text-white shadow-sm`
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                          }`}
                      >
                        <Icon size={14} className={iconClass} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Receiver Info */}
              {activeMethod && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-2">
                  {activeMethod.id === 'bank' ? (
                    <div className="bg-zinc-900 px-2.5 py-2 rounded-lg border border-zinc-800 space-y-1">
                      <p className="text-zinc-300 font-semibold whitespace-pre-line">{activeMethod.account}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 bg-zinc-900 pl-2.5 pr-1.5 py-1.5 rounded-lg border border-zinc-800">
                      <p className="min-w-0 truncate">
                        <span className="text-[11px] text-zinc-400">{METHOD_STYLES[activeMethod.id].accountLabel}: </span>
                        <span className="font-mono font-bold text-white text-sm">{activeMethod.account}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeMethod.account, activeMethod.id)}
                        className="shrink-0 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1"
                      >
                        <Copy size={12} />
                        {copiedText === activeMethod.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {/* A merchant number only takes "Payment"; "Send Money" to it fails. */}
                  {activeMethod.id === 'bkash' && (
                    <div className="flex flex-col items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-100">

                      <p className="text-xs font-semibold text-white text-center flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        In the bKash app, tap <span className="font-bold text-white">Payment</span>, not Send Money.
                      </p>
                      <p className="text-xs font-semibold text-white text-center flex items-center gap-1.5">
                        <QrCode size={14} className="text-emerald-400 shrink-0" />
                        Or scan with bKash, Nagad, Rocket or any bank app
                      </p>
                    </div>
                  )}

                  {/* Bangla QR: any bKash, Nagad, Rocket or bank app can pay it */}
                  {activeMethod.id === 'bkash' && (
                    <div className="flex flex-col items-center gap-1.5">

                      <Image
                        src={bkashQr}
                        alt="bKash payment QR code"
                        className="w-full max-w-[15rem] h-auto rounded-lg bg-white"
                        sizes="240px"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* Right: order details and the submission */}
        <div className="space-y-4 md:border-l md:border-zinc-800 md:pl-6">
          <StepHeading step={2} title="Confirm your payment" />
          {/* Order summary */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5">
            <div className="flex justify-between text-zinc-300">
              <span>Item:</span>
              <span className="font-semibold text-white">{itemLabel}</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Credits:</span>
              <span className="font-semibold text-emerald-400">
                {creditsToGrant} Credits {bonusCredits > 0 && `(+${bonusCredits} promo bonus)`}
              </span>
            </div>
            {selectedPlan && promoAppliedCode && (
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

          {/* Promo / Referral Code Drawer: plans only, top-ups never take a code */}
          {selectedPlan && (
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
          )}

          {isUpgrade && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-100 flex items-start gap-2.5">
              <AlertCircle size={14} className="text-sky-400 shrink-0 mt-0.5" />
              <p>
                {selectedPlan!.name} starts as soon as your payment is approved, with a fresh{' '}
                {billingCycle === 'quarterly' ? '3-month' : '1-month'} period. The days left on your current plan are
                replaced, and all your remaining credits carry over.
              </p>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Phone or account number you paid from *
              </label>
              <input
                type="text"
                required
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="e.g. 017XXXXXXXX"
                className="border border-gray-400 input text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xxs font-medium text-zinc-400 mb-1">
                Your Account Email (optional)
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="input text-xs"
              />
            </div>
          </div>

          {submitError && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertCircle size={14} />
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !activeMethod}
            className="btn-accent w-full py-3 text-sm flex items-center justify-center gap-2"
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
        </div>
      </div>
    </form>
  );
}

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <p className="text-xs font-semibold text-white flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 text-[11px] font-bold flex items-center justify-center">
        {step}
      </span>
      {title}
    </p>
  );
}
