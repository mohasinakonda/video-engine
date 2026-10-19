'use client';

import { ListChecks, Lock, SearchCheck, TrendingUp, Youtube } from 'lucide-react';

export const CONNECT_URL = '/api/youtube/oauth/start?return_to=/youtube-doctor';

const BENEFITS = [
  { icon: SearchCheck, title: 'Find the real problem', text: 'Clicks, watch time, topics or uploads: we show which one holds you back.' },
  { icon: ListChecks, title: 'Get a short to-do list', text: 'Up to three steps, starting with the one that matters most.' },
  { icon: TrendingUp, title: 'Backed by your numbers', text: 'Every point comes from your own YouTube data, not guesses.' },
];

/** Screen 1: the promise, one button, and the reassurance people look for before connecting. */
export function IntroCard({ canConnect }: { canConnect: boolean }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-10 space-y-8">
      <div className="space-y-3 max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
          Why isn&apos;t your channel growing?
        </h2>
        <p className="text-lg text-zinc-300">Connect your channel and get a clear answer, plus what to fix first.</p>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="p-5 rounded-xl bg-bg-elevated border border-bg-border space-y-2">
            <Icon size={22} className="text-emerald-400" />
            <p className="text-base font-semibold text-white">{title}</p>
            <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        {canConnect ? (
          <a href={CONNECT_URL} className="btn-primary px-7 py-3.5 text-base font-semibold">
            <Youtube size={20} />
            Connect YouTube
          </a>
        ) : (
          <button type="button" className="btn-primary px-7 py-3.5 text-base font-semibold" disabled>
            <Youtube size={20} />
            Connect YouTube
          </button>
        )}
        <p className="text-sm text-zinc-400 flex items-start gap-2">
          <Lock size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Read-only: we can never post, edit or delete anything. Your data isn&apos;t saved on our servers.{' '}
            <a href="/privacy#youtube-data" className="text-zinc-200 underline">
              How we handle your data
            </a>
          </span>
        </p>
      </div>
    </section>
  );
}
