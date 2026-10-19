'use client';

import { ShieldCheck, Youtube } from 'lucide-react';

export const CONNECT_URL = '/api/youtube/oauth/start?return_to=/youtube-doctor';

/** Screen 1: what the feature does, the privacy note, and Connect YouTube. */
export function IntroCard({ canConnect }: { canConnect: boolean }) {
  return (
    <section className="card p-6 sm:p-8 space-y-6">
      <div className="space-y-2 max-w-2xl">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Understand Why Your Channel Isn&apos;t Growing
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Connect your YouTube channel to identify performance bottlenecks and get practical, evidence-based
          recommendations.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {[
          ['What limits your reach', 'Packaging, retention, topics, traffic sources and upload consistency.'],
          ['Backed by your numbers', 'Every finding shows the data behind it, and what could not be measured.'],
          ['What to fix first', 'A short, prioritized list of actions.'],
        ].map(([title, text]) => (
          <li key={title} className="p-3 rounded-lg bg-bg-elevated border border-bg-border">
            <p className="font-semibold text-white">{title}</p>
            <p className="text-xs text-zinc-400 mt-1">{text}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {canConnect ? (
          <a href={CONNECT_URL} className="btn-primary">
            <Youtube size={16} />
            Connect YouTube
          </a>
        ) : (
          <button type="button" className="btn-primary" disabled>
            <Youtube size={16} />
            Connect YouTube
          </button>
        )}
        <p className="text-xs text-zinc-500">Read-only access. We can&apos;t upload, edit or delete anything.</p>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-bg-elevated border border-bg-border text-xs text-zinc-400">
        <ShieldCheck size={15} className="text-emerald-400 shrink-0 mt-0.5" />
        <p>
          We fetch your channel data only when you run an analysis and don&apos;t store it on our servers. The report is
          kept only in this browser tab until you close it. Titles, thumbnails and summary metrics are sent to our AI
          provider to write the report. Disconnecting removes our access.
        </p>
      </div>
    </section>
  );
}
