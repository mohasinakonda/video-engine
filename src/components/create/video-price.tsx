import { Check } from 'lucide-react';
import type { CreateConfig } from './types';

/**
 * The one moment a video's price is shown: what it includes, before starting. After this, the
 * project's buttons carry no prices while the included runs last.
 */
export function VideoPrice({ config }: { config: CreateConfig }) {
  const i = config.bundle.includes;
  const times = (n: number) => (n === 1 ? 'once' : `up to ${n} times`);
  const items = [
    i.brief > 0 && `AI brief, ${times(i.brief)}`,
    i.script > 0 && `AI script, ${times(i.script)}${i.section > 0 ? `, plus ${i.section} part rewrites` : ''}`,
    i.packaging > 0 && `Title and thumbnail ideas, ${times(i.packaging)}`,
    i.topicSearch > 0 && `Who made videos on this (YouTube search), ${times(i.topicSearch)}`,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="rounded-xl bg-bg-elevated border border-bg-border p-4 space-y-2">
      <p className="text-sm text-zinc-300">
        <span className="font-semibold text-white">{config.bundle.cost} credits</span> for this video, once. It includes:
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {items.map((x) => (
          <li key={x} className="text-sm text-zinc-300 flex gap-1.5">
            <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            {x}
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">Writing and editing yourself is always free.</p>
    </div>
  );
}
