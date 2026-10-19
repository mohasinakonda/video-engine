import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import type { DiagnosisError } from '@/components/youtube-doctor/use-diagnosis';

const ACTIONS: Partial<Record<NonNullable<DiagnosisError['code']>, { href: string; label: string }>> = {
  reauth: { href: '/youtube-doctor', label: 'Reconnect YouTube' },
  not_connected: { href: '/youtube-doctor', label: 'Connect YouTube' },
  credits: { href: '/plan', label: 'Get more credits' },
  plan: { href: '/plan', label: 'See plans' },
};

/** A failed run: the server's plain message, whether credits came back, and the one thing to do next. */
export function StreamError({ error }: { error: DiagnosisError }) {
  const action = error.code ? ACTIONS[error.code] : undefined;
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
      <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
      <div className="space-y-2">
        <p className="text-base text-rose-100">{error.message}</p>
        {error.refunded && <p className="text-sm text-rose-200/80">Your credits were returned.</p>}
        {action && (
          <Link href={action.href} className="btn-secondary btn-sm w-fit">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
