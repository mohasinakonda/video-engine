import React from 'react';
import Image from 'next/image';
import banglaQrLogo from '@/qr-code/bangla-qr-logo.png';
import { QrCode, Smartphone, Landmark, MessageCircle, CheckCircle2 } from 'lucide-react';

const PAY_APPS = ['bKash', 'Nagad', 'Rocket', 'Any bank app'];

const STEPS = [
  {
    icon: CheckCircle2,
    title: 'Choose a plan',
    text: 'Pick monthly or 3 months. The checkout shows the exact amount to pay.',
  },
  {
    icon: QrCode,
    title: 'Scan the Bangla QR',
    text: 'Open bKash, Nagad, Rocket or your bank app, scan our QR and pay. Using bKash? Tap Payment, not Send Money.',
  },
  {
    icon: MessageCircle,
    title: 'Confirm on WhatsApp',
    text: 'Submit the number you paid from, then message us on WhatsApp. Your credits are added as soon as we verify the payment.',
  },
];

export const PaymentMethodsSection = () => {
  return (
    <section id="payment-methods" className="py-24 px-6 border-b border-[#E5E0D8] bg-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* Left: what Bangla QR is */}
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <Image
              src={banglaQrLogo}
              alt="Bangla QR"
              className="w-20 sm:w-24 h-auto shrink-0 rounded-xl border border-[#E5E0D8] bg-white p-2 shadow-sm"
              sizes="96px"
            />
            <div className="space-y-2">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
                PAYMENT METHODS
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
                Pay from any app with Bangla QR
              </h2>
            </div>
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Bangla QR is Bangladesh Bank&apos;s national QR standard. One QR code works across mobile wallets and
            banks, so you can pay us from the app you already use. No card, no dollar payment.
          </p>

          <div className="flex flex-wrap gap-2">
            {PAY_APPS.map((app) => (
              <span
                key={app}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF8F5] border border-[#E5E0D8] text-xs font-semibold text-zinc-800"
              >
                {app === 'Any bank app' ? (
                  <Landmark size={13} className="text-[#E05A30]" />
                ) : (
                  <Smartphone size={13} className="text-[#E05A30]" />
                )}
                {app}
              </span>
            ))}
          </div>

          <p className="text-xs text-zinc-500">
            Prefer not to scan? You can also pay to our bKash merchant number shown at checkout.
          </p>
        </div>

        {/* Right: how a payment works */}
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 p-5 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8]"
            >
              <div className="w-9 h-9 rounded-xl bg-[#E05A30]/10 text-[#E05A30] flex items-center justify-center shrink-0">
                <step.icon size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-950">
                  {i + 1}. {step.title}
                </p>
                <p className="text-xs text-zinc-600 leading-relaxed">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

      </div>
    </section>
  );
};
