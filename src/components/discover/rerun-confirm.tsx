'use client';

/** Results this recent are still current: searching again would mostly spend quota for the same answer. */
export const FRESH_RESULT_MS = 6 * 60 * 60 * 1000;

export const isFresh = (analyzedAt: string | undefined, now = Date.now()) => !!analyzedAt && now - new Date(analyzedAt).getTime() < FRESH_RESULT_MS;

/** Asked before repeating a search whose results on screen are still fresh. */
export function RerunConfirm({ analyzedAt, cost, onConfirm, onCancel }: { analyzedAt: string; cost: string; onConfirm: () => void; onCancel: () => void }) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(analyzedAt).getTime()) / 60_000));
  const ago = minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
      <p className="text-sm text-amber-100">
        You ran this search {ago} ago and YouTube rarely changes much in a few hours. Searching again uses {cost}.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>
          Keep these results
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onConfirm}>
          Search anyway
        </button>
      </div>
    </div>
  );
}
