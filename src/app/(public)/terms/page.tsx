import React from 'react';
import { Scale, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | Rendoza AI',
  description: 'Terms and conditions governing the use of Rendoza AI Video Studio.',
};

export default function TermsPage() {
  return (
    <div className="py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3 border-b border-[#E5E0D8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-mono font-semibold border border-blue-200">
            <Scale size={14} />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Last Updated: October 2026 • Governing Rendoza AI Platform Services
          </p>
        </div>

        {/* Terms Content Card */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] p-6 sm:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#E05A30]" />
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Rendoza AI (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#E05A30]" />
              2. Commercial Rights & Content Ownership
            </h2>
            <p>
              Creators using Rendoza AI retain full commercial rights and monetization licenses to all generated video and audio assets created on active paid subscriptions (including YouTube Partner Program, Facebook Reels, client deliverables, and broadcast advertising). You are responsible for ensuring your scripts do not infringe upon third-party copyrights or promote illegal content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Scale size={18} className="text-[#E05A30]" />
              3. Credits, Top-ups & Account Tiers
            </h2>
            <p>
              Credits are allocated on subscription renewal and via top-up packs. Image generations, audio syntheses, and video muxing consume credits according to the published pricing schedule. Credits on recurring subscriptions renew monthly, and top-up credits carry forward with an active subscription.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              4. Prohibited Uses & Safety Policies
            </h2>
            <p>
              You agree not to use Rendoza AI to generate defamatory, obscene, sexually explicit, abusive, or harmful material, or to impersonate living individuals without legal authorization. In particular, you must never create non-consensual intimate imagery (NCII): nude, sexual or intimate images of any real person, whether AI-generated or edited. Any sexual content involving minors is strictly prohibited and is reported to the authorities. The full rules are in our{' '}
              <a href="/acceptable-use" className="text-[#E05A30] underline">Acceptable Use Policy</a>. We suspend or close accounts that break them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950">
              5. YouTube API Services
            </h2>
            <p>
              Channel Doctor, Discover, Create and video and channel analysis use YouTube API Services. By using them you agree to be bound by the{' '}
              <a href="https://www.youtube.com/t/terms" className="text-[#E05A30] underline" target="_blank" rel="noopener noreferrer">
                YouTube Terms of Service
              </a>
              . Google&apos;s handling of your data is described in the{' '}
              <a href="https://policies.google.com/privacy" className="text-[#E05A30] underline" target="_blank" rel="noopener noreferrer">
                Google Privacy Policy
              </a>
              , and ours in our <a href="/privacy#youtube-data" className="text-[#E05A30] underline">Privacy Policy</a>. Channel Doctor reports
              are analysis and suggestions based on the data YouTube provides; they do not guarantee any change in views or growth.
            </p>
          </section>

          <section className="space-y-3 border-t border-[#E5E0D8] pt-6">
            <h2 className="text-base font-bold text-zinc-950">
              6. Governing Law
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the applicable laws of Bangladesh and international copyright standards.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
