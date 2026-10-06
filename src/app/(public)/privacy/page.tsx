import React from 'react';
import { ShieldCheck, Lock, Eye, FileText } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Rendoza AI',
  description: 'Privacy Policy and Data Protection standards for Rendoza AI Video Studio.',
};

export default function PrivacyPage() {
  return (
    <div className="py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3 border-b border-[#E5E0D8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold border border-emerald-200">
            <ShieldCheck size={14} />
            <span>Compliance & Security</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Last Updated: October 2026 • Effective for all Rendoza AI users
          </p>
        </div>

        {/* Policy Content Card */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] p-6 sm:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Eye size={18} className="text-[#E05A30]" />
              1. Information We Collect
            </h2>
            <p>
              When you use Rendoza AI, we collect minimal data required to render your scripts into videos:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li><strong>Account Information:</strong> Your Google OAuth profile (name, email address, avatar).</li>
              <li><strong>Content & Scripts:</strong> Script text, narration ideas, prompt parameters, and audio inputs submitted for video generation.</li>
              <li><strong>Payment & Verification Data:</strong> Transaction IDs (TrxID) submitted for bKash, Nagad, or Bank transfers for credit purchases. We do not store PINs or banking credentials.</li>
              <li><strong>Usage Analytics:</strong> Credit consumption rates, rendering times, and error telemetry to improve our cloud engine.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Lock size={18} className="text-[#E05A30]" />
              2. How We Protect & Use Your Data
            </h2>
            <p>
              We treat your creative intellectual property with strict confidentiality:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>Your scripts and private video projects are never sold to data brokers or third-party advertisers.</li>
              <li>AI inference requests to Pollinations AI and speech synthesis APIs are processed securely over encrypted HTTPS connections.</li>
              <li>Rendered video outputs and intermediate image frames are stored in secure cloud storage and are only accessible by your authenticated account.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <FileText size={18} className="text-[#E05A30]" />
              3. Data Retention & Deletion Rights
            </h2>
            <p>
              You maintain full ownership of your created videos. You may delete individual scenes, projects, or request complete account deletion at any time by contacting our support team via WhatsApp or email.
            </p>
          </section>

          <section className="space-y-3 border-t border-[#E5E0D8] pt-6">
            <h2 className="text-base font-bold text-zinc-950">
              4. Contact Us
            </h2>
            <p>
              If you have any questions or data privacy inquiries, please reach out to our privacy officer via our official WhatsApp Support channel or email us at support@rendoza.ai.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
