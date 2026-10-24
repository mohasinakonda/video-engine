import React from 'react';
import Link from 'next/link';
import { Ban, Flag, ShieldCheck, Target } from 'lucide-react';
import { formatWhatsAppLink, DEFAULT_ADMIN_SETTINGS } from '@/lib/subscription-store';

export const metadata = {
  title: 'Acceptable Use Policy | Rendoza AI',
  description: 'What Rendoza AI is for, and the content it must never be used to create, including non-consensual intimate imagery.',
};

export default function AcceptableUsePage() {
  const whatsappUrl = formatWhatsAppLink(DEFAULT_ADMIN_SETTINGS.whatsappNumber, 'Hello! I want to report content made with Rendoza AI.');

  return (
    <div className="py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-3 border-b border-[#E5E0D8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold border border-emerald-200">
            <ShieldCheck size={14} />
            <span>Responsible use</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">Acceptable Use Policy</h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">Last updated: October 2026 · Applies to every Rendoza AI account and plan</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Target size={18} className="text-[#E05A30]" />
              1. What Rendoza AI is for
            </h2>
            <p>
              Rendoza AI is a tool for YouTube creators. It helps them understand their channel&apos;s performance, research what to make next, write video
              scripts, titles and descriptions, and turn a script into a video with illustrated scenes and narration. Images are generated only as scene
              illustrations and thumbnails for these videos.
            </p>
            <p>
              Our YouTube features use Google and YouTube APIs with read-only access, only to analyze the creator&apos;s own channel and public YouTube data.
              Google and YouTube APIs are never used to generate, edit or process images of people.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Ban size={18} className="text-rose-600" />
              2. Content you must never create
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Non-consensual intimate imagery (NCII)</strong>, including AI-generated or edited nude, sexual or intimate images of any real
                person, whether or not they are identifiable by name.
              </li>
              <li>Any sexual or sexually explicit content, and any nudity.</li>
              <li>Any sexual content involving minors, or any content that sexualizes minors. We report such content to the authorities.</li>
              <li>Images, video or voice that impersonate a real person, or depict a real person in a false or degrading situation, without their consent.</li>
              <li>Harassment, threats, hate, or content that promotes violence or self-harm.</li>
              <li>Content that infringes someone else&apos;s copyright, trademark, privacy or other rights.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Flag size={18} className="text-amber-600" />
              3. Enforcement and reporting
            </h2>
            <p>
              Accounts that create prohibited content are suspended or closed without refund. Where the law requires it, we report it to the
              authorities.
            </p>
            <p>
              To report content made with Rendoza AI, contact us on{' '}
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-[#E05A30] underline">
                WhatsApp
              </a>
              . We review reports and act on them.
            </p>
          </section>

          <p className="text-xs text-zinc-500 border-t border-[#E5E0D8] pt-4">
            This policy is part of our{' '}
            <Link href="/terms" className="text-[#E05A30] underline">
              Terms of Service
            </Link>
            . See also our{' '}
            <Link href="/privacy" className="text-[#E05A30] underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
