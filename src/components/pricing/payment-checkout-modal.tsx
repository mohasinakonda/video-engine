'use client';

import React from 'react';
import { XCircle } from 'lucide-react';
import { DEFAULT_ADMIN_SETTINGS } from '@/lib/subscription-store';
import type { PaymentSubmission } from '@/types/subscription';
import { PaymentCheckoutForm, type PaymentCheckoutFormProps } from './payment-checkout-form';
import { PaymentSubmittedView } from './payment-submitted-view';

interface PaymentCheckoutModalProps extends PaymentCheckoutFormProps {
  isOpen: boolean;
  onClose: () => void;
  submitSuccess: boolean;
  lastSubmittedReq: PaymentSubmission | null;
}

/** Modal shell: the checkout form, then the WhatsApp follow-up once the payment is submitted. */
export function PaymentCheckoutModal({
  isOpen,
  onClose,
  submitSuccess,
  lastSubmittedReq,
  ...formProps
}: PaymentCheckoutModalProps) {
  if (!isOpen) return null;

  const { selectedPlan, selectedTopup, settings, copiedText, handleCopy } = formProps;
  const adminWhatsApp = (settings?.whatsappNumber || DEFAULT_ADMIN_SETTINGS.whatsappNumber || '').trim();
  const isSubmitted = submitSuccess && Boolean(lastSubmittedReq);
  const itemName = selectedPlan ? `Plan ${selectedPlan.name}` : `Topup ${selectedTopup?.name}`;

  return (
    <div className="modal-overlay">
      <div
        className={`modal-panel ${isSubmitted ? 'max-w-lg' : 'max-w-4xl'} p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto text-white`}
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
        >
          <XCircle size={22} />
        </button>

        {isSubmitted && lastSubmittedReq ? (
          <PaymentSubmittedView
            submission={lastSubmittedReq}
            itemName={itemName}
            adminWhatsApp={adminWhatsApp}
            copiedText={copiedText}
            handleCopy={handleCopy}
          />
        ) : (
          <PaymentCheckoutForm {...formProps} />
        )}
      </div>
    </div>
  );
}
