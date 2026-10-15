'use client';

import Link from 'next/link';

interface CharCounterProps {
  length: number;
  limit: number;
  /** Fraction of the limit at which the counter appears. 0 = always visible. */
  showFrom?: number;
  /** Plan that unlocks a higher limit — shown as an upgrade link when over. */
  upgrade?: { label: string; limit: number } | null;
  className?: string;
}

/**
 * Quiet character counter: hidden until the text nears the limit, amber when
 * close, rose with an over-by count (and optional upgrade link) when over.
 */
export default function CharCounter({ length, limit, showFrom = 0.8, upgrade, className = '' }: CharCounterProps) {
  if (length === 0 || length < limit * showFrom) return null;

  const over = length - limit;
  const tone = over > 0 ? 'text-rose-400' : length >= limit * 0.95 ? 'text-amber-400' : 'text-zinc-500';

  return (
    <div className={`flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums ${tone} ${className}`}>
      <span>
        {length.toLocaleString()} / {limit.toLocaleString()}
      </span>
      {over > 0 && (
        <>
          <span>· {over.toLocaleString()} characters over limit</span>
          {upgrade && (
            <Link href="/plan" className="underline underline-offset-2 hover:text-rose-300">
              Upgrade to {upgrade.label} for {upgrade.limit.toLocaleString()}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
