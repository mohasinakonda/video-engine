/**
 * A badge shows information; it never does anything. Pill-shaped, no border, a small dot,
 * no hover: so it can't be mistaken for a button (which is square-cornered, with a border or fill).
 */
export type BadgeTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

const TONE: Record<BadgeTone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-white/[0.07] text-zinc-300', dot: 'bg-zinc-400' },
  good: { pill: 'bg-emerald-500/15 text-emerald-200', dot: 'bg-emerald-400' },
  warn: { pill: 'bg-amber-500/15 text-amber-200', dot: 'bg-amber-400' },
  bad: { pill: 'bg-rose-500/15 text-rose-200', dot: 'bg-rose-400' },
  info: { pill: 'bg-sky-500/15 text-sky-200', dot: 'bg-sky-400' },
};

export function Badge({ tone = 'neutral', dot = true, title, children }: { tone?: BadgeTone; dot?: boolean; title?: string; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap cursor-default select-none ${t.pill}`}>
      {dot && <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />}
      {children}
    </span>
  );
}
