'use client';

import { AlertCircle, CheckCircle2, X } from 'lucide-react';

/** Messages for the ?yt=<outcome> set by the OAuth callback. */
const OUTCOMES: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  connected: { tone: 'success', text: 'YouTube connected. Now pick a period and check your channel.' },
  cancelled: { tone: 'warning', text: 'Connection cancelled. Nothing was changed.' },
  missing_scope: {
    tone: 'warning',
    text: 'Both permissions are needed (YouTube data and YouTube Analytics). Please connect again and keep both ticked.',
  },
  no_channel: {
    tone: 'warning',
    text: 'That Google account has no YouTube channel. Connect again and choose the account (or Brand Account) that owns your channel.',
  },
  multiple_channels: {
    tone: 'warning',
    text: 'Google returned more than one channel. Connect again and choose the one account that owns the channel you want to analyze.',
  },
  invalid_state: { tone: 'error', text: 'The connection request expired or was not valid. Please try again.' },
  not_configured: { tone: 'error', text: 'YouTube connection is not set up on this server yet. Please contact support.' },
  api_not_enabled: {
    tone: 'error',
    text: 'YouTube access is not switched on for this app yet, so your channel could not be read. Please contact support.',
  },
  error: { tone: 'error', text: 'Something went wrong while connecting YouTube. Please try again.' },
};

const TONE_CLASSES = {
  success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
  warning: 'bg-amber-500/10 border-amber-500/25 text-amber-100',
  error: 'bg-rose-500/10 border-rose-500/25 text-rose-200',
};

export function OAuthResultBanner({ outcome, onDismiss }: { outcome: string | null; onDismiss: () => void }) {
  const message = outcome ? OUTCOMES[outcome] : null;
  if (!message) return null;
  const Icon = message.tone === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div role="status" className={`flex items-start gap-3 p-4 rounded-xl border text-base ${TONE_CLASSES[message.tone]}`}>
      <Icon size={20} className="shrink-0 mt-0.5" />
      <p className="flex-1">{message.text}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-zinc-400 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}
