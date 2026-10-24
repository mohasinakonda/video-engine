import React from 'react';
import Link from 'next/link';
import { Ban, Target } from 'lucide-react';

/** What Rendoza is for, and what it must never be used for (Google API Terms: no AI NCII). */
export const ResponsibleUseSection: React.FC = () => {
  return (
    <section id="responsible-use" className="py-16 px-6 border-b border-[#E5E0D8] bg-[#FAF8F5] text-zinc-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-[#E5E0D8] p-6 space-y-3">
          <p className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            <Target size={15} className="text-[#E05A30]" />
            What Rendoza is for
          </p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            Rendoza is a tool for YouTube creators: it analyzes your own channel, researches what to make next, writes scripts, titles and descriptions,
            and turns a script into a video with illustrated scenes and narration. Our YouTube features use YouTube&apos;s official, read-only access only to
            analyze channel and public video data; Google and YouTube APIs are never used to create or edit images.
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-[#E5E0D8] p-6 space-y-3">
          <p className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            <Ban size={15} className="text-rose-600" />
            Never allowed
          </p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            Rendoza must not be used to create nude, sexual or intimate images of anyone, including AI-generated non-consensual intimate imagery (NCII) of
            real people, any sexual content involving minors, or content that impersonates a real person without consent. Accounts that do are closed.
          </p>
          <Link href="/acceptable-use" className="inline-block text-sm font-semibold text-[#E05A30] hover:underline">
            Read our Acceptable Use Policy →
          </Link>
        </div>
      </div>
    </section>
  );
};
