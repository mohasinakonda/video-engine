/** Will the channel's Shorts grow: the verdict, the two numbers behind it, and how the same reading did a month ago. */
import type { GrowthOutlook, GrowthOutlookId } from '@/lib/youtube/views-check/types';
import { num, pct } from './format';

const TONE: Record<GrowthOutlookId, { pill: string; box: string }> = {
  growing: { pill: 'bg-emerald-950 text-emerald-200', box: 'border-emerald-800' },
  held_back: { pill: 'bg-sky-950 text-sky-200', box: 'border-sky-800' },
  will_stall: { pill: 'bg-amber-950 text-amber-200', box: 'border-amber-800' },
  not_growing: { pill: 'bg-rose-950 text-rose-200', box: 'border-rose-800' },
  too_early: { pill: 'bg-zinc-800 text-zinc-300', box: 'border-bg-border' },
};

const SAID: Record<GrowthOutlookId, string> = {
  growing: 'likely to grow',
  held_back: 'ready to grow, reach not moving',
  will_stall: 'growing for now',
  not_growing: 'unlikely to grow',
  too_early: 'too early',
};

const REACH: Record<GrowthOutlook['reach']['state'], string> = { rising: 'Rising', flat: 'About the same', falling: 'Falling', unknown: 'Not enough Shorts' };
const CONTENT: Record<GrowthOutlook['content']['state'], string> = { good: 'Viewers stay', weak: 'Most swipe away', unknown: 'Not enough views' };

export function OutlookCard({ outlook }: { outlook: GrowthOutlook }) {
  const tone = TONE[outlook.id];
  const { reach, content, check } = outlook;
  const recentValue = reach.recent ? (reach.by === 'first_day' ? reach.recent.medianFirstDay : reach.recent.medianViews) : null;
  const previousValue = reach.previous ? (reach.by === 'first_day' ? reach.previous.medianFirstDay : reach.previous.medianViews) : null;
  return (
    <section className={`space-y-4 rounded-2xl border bg-bg-surface p-5 ${tone.box}`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Will your Shorts grow?</p>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone.pill}`}>{outlook.title}</span>
      </div>
      <p className="text-base leading-relaxed text-zinc-200">{outlook.detail}</p>

      {outlook.id !== 'too_early' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact
            label="Do viewers like them?"
            value={CONTENT[content.state]}
            note={content.medianSwipeAway !== null ? `${pct(content.medianSwipeAway)} swipe away (healthy: 45% or less)` : null}
          />
          <Fact
            label="Is YouTube showing them to more people?"
            value={REACH[reach.state]}
            note={
              recentValue !== null && previousValue !== null
                ? `${num(recentValue)} vs ${num(previousValue)} ${reach.by === 'first_day' ? 'views on upload day' : 'views'} (median)`
                : null
            }
          />
        </div>
      )}

      <div className="rounded-xl border border-bg-border bg-bg-elevated p-3.5">
        <p className="mb-1 text-xs font-semibold text-zinc-400">What to do</p>
        <p className="text-sm leading-relaxed text-zinc-200">{outlook.nextStep}</p>
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        {check
          ? `${check.days} days ago, the same reading said “${SAID[check.said]}”. Since then your Shorts ${
              check.grew ? 'got more views' : 'didn’t get more views'
            }${check.change !== null ? ` (${pct(check.change)} of before)` : ''}: ${check.matched ? 'it was right' : 'it was wrong'}. `
          : 'Not enough Shorts yet to check how this reading did a month ago. '}
        A likelihood for the next few weeks, from your own numbers, not a promise or a YouTube status.
      </p>
    </section>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string | null }) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-base p-3.5">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <p className="text-base font-bold text-white">{value}</p>
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}
