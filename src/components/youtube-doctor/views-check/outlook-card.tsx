/**
 * Will the channel's Shorts grow: the verdict up top, the two readings behind it as pictures
 * (a swipe-away meter and before/now bars), the 2×2 of possible outcomes with "you are here",
 * the next step, and how the same reading did a month ago.
 */
import { ArrowRight, CircleDashed, Hourglass, TrendingDown, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import type { GrowthOutlook, GrowthOutlookId } from '@/lib/youtube/views-check/types';
import { num, pct } from './format';

type Tone = { text: string; soft: string; border: string; fill: string; Icon: LucideIcon };
const TONE: Record<GrowthOutlookId, Tone> = {
  growing: { text: 'text-emerald-300', soft: 'bg-emerald-500/10', border: 'border-emerald-500/40', fill: 'bg-emerald-400', Icon: TrendingUp },
  held_back: { text: 'text-sky-300', soft: 'bg-sky-500/10', border: 'border-sky-500/40', fill: 'bg-sky-400', Icon: Hourglass },
  will_stall: { text: 'text-amber-300', soft: 'bg-amber-500/10', border: 'border-amber-500/40', fill: 'bg-amber-400', Icon: Zap },
  not_growing: { text: 'text-rose-300', soft: 'bg-rose-500/10', border: 'border-rose-500/40', fill: 'bg-rose-400', Icon: TrendingDown },
  too_early: { text: 'text-zinc-300', soft: 'bg-zinc-500/10', border: 'border-bg-border', fill: 'bg-zinc-400', Icon: CircleDashed },
};

const SAID: Record<GrowthOutlookId, string> = {
  growing: 'likely to grow',
  held_back: 'ready to grow, reach not moving',
  will_stall: 'growing for now',
  not_growing: 'unlikely to grow',
  too_early: 'too early',
};

/** Short names for the 2×2. */
const CELL: Record<Exclude<GrowthOutlookId, 'too_early'>, string> = {
  growing: 'Will grow',
  held_back: 'Ready, waiting for reach',
  will_stall: 'Grows, then stalls',
  not_growing: 'Won’t grow',
};

const HEALTHY_SWIPE = 0.45;

export function OutlookCard({ outlook }: { outlook: GrowthOutlook }) {
  const tone = TONE[outlook.id];
  const { reach, content, check } = outlook;
  const recentValue = reach.recent ? (reach.by === 'first_day' ? reach.recent.medianFirstDay : reach.recent.medianViews) : null;
  const previousValue = reach.previous ? (reach.by === 'first_day' ? reach.previous.medianFirstDay : reach.previous.medianViews) : null;

  return (
    <section className={`overflow-hidden rounded-2xl border bg-bg-surface ${tone.border}`}>
      {/* The verdict */}
      <div className={`flex items-center gap-4 px-5 py-4 sm:px-6 ${tone.soft}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-surface ${tone.text}`}>
          <tone.Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Will your Shorts grow?</p>
          <h2 className={`text-xl font-bold leading-tight sm:text-2xl ${tone.text}`}>{outlook.title}</h2>
        </div>
      </div>

      {outlook.id === 'too_early' ? (
        <p className="px-5 py-5 text-sm text-zinc-300 sm:px-6">{outlook.detail}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-3">
          <SwipeMeter swipe={content.medianSwipeAway} good={content.state === 'good'} shorts={content.shorts} />
          <ReachBars
            state={reach.state}
            recent={recentValue}
            previous={previousValue}
            change={reach.change}
            recentCount={reach.recent?.count ?? null}
            previousCount={reach.previous?.count ?? null}
            firstDay={reach.by === 'first_day'}
          />
          <Matrix id={outlook.id} tone={tone} />
        </div>
      )}

      {/* The next step */}
      <div className="mx-5 mb-5 flex gap-3 rounded-xl border border-bg-border bg-bg-elevated p-4 sm:mx-6">
        <ArrowRight size={18} className={`mt-0.5 shrink-0 ${tone.text}`} aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Next step</p>
          <p className="text-sm leading-relaxed text-zinc-100">{outlook.nextStep}</p>
        </div>
      </div>


    </section>
  );
}

function Panel({ label, value, valueClass, children }: { label: string; value: string; valueClass: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-bg-border bg-bg-base p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-300">{label}</p>
        <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
      </div>
      {children}
    </div>
  );
}

/** Swipe-away on a 0–100% track, with the healthy line marked. */
function SwipeMeter({ swipe, good, shorts }: { swipe: number | null; good: boolean; shorts: number }) {
  if (swipe === null) {
    return (
      <Panel label="Viewers" value="Not enough views" valueClass="text-zinc-400">
        <p className="text-xs text-zinc-400">Shorts need more views before their swipe-away counts.</p>
      </Panel>
    );
  }
  const at = Math.min(100, Math.max(0, swipe * 100));
  return (
    <Panel label="Viewers" value={good ? 'Most stay' : 'Most swipe away'} valueClass={good ? 'text-emerald-300' : 'text-rose-300'}>
      <p className="text-3xl font-extrabold tabular-nums text-white">
        {pct(swipe)} <span className="text-sm font-medium text-zinc-400">swipe away in 2s</span>
      </p>
      <div className="relative pt-1">
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full rounded-full ${good ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.max(2, at)}%` }} />
        </div>
        <div className="absolute top-0 h-[18px] w-0.5 bg-zinc-200" style={{ left: `${HEALTHY_SWIPE * 100}%` }} aria-hidden="true" />
        <div className="relative mt-1.5 h-4 text-[11px] text-zinc-500">
          <span className="absolute left-0">0%</span>
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-zinc-300" style={{ left: `${HEALTHY_SWIPE * 100}%` }}>
            good: under {pct(HEALTHY_SWIPE)}
          </span>
          <span className="absolute right-0">100%</span>
        </div>
      </div>
      <p className="text-xs text-zinc-500">A typical Short of your newest {shorts}</p>
    </Panel>
  );
}

/** Before vs now, as two bars on the same scale. */
function ReachBars(props: {
  state: GrowthOutlook['reach']['state'];
  recent: number | null;
  previous: number | null;
  change: number | null;
  recentCount: number | null;
  previousCount: number | null;
  firstDay: boolean;
}) {
  const label = props.state === 'rising' ? 'Rising' : props.state === 'falling' ? 'Falling' : props.state === 'flat' ? 'About the same' : 'Not enough Shorts';
  const color = props.state === 'rising' ? 'text-emerald-300' : props.state === 'falling' ? 'text-rose-300' : 'text-zinc-300';
  if (props.recent === null || props.previous === null) {
    return (
      <Panel label="Views" value={label} valueClass={color}>
        <p className="text-xs text-zinc-400">Not enough Shorts yet to compare the newest with the ones before.</p>
      </Panel>
    );
  }
  const max = Math.max(props.recent, props.previous, 1);
  const diff = props.change !== null ? Math.round((props.change - 1) * 100) : null;
  const rows = [
    { name: `Before (${props.previousCount ?? '–'})`, value: props.previous, bar: 'bg-zinc-500' },
    {
      name: `Newest (${props.recentCount ?? '–'})`,
      value: props.recent,
      bar: props.state === 'falling' ? 'bg-rose-400' : props.state === 'rising' ? 'bg-emerald-400' : 'bg-zinc-300',
    },
  ];
  return (
    <Panel label="Views" value={label} valueClass={color}>
      <p className={`text-3xl font-extrabold tabular-nums ${diff === null ? 'text-white' : color}`}>
        {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}%`} <span className="text-sm font-medium text-zinc-400">views</span>
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-zinc-400">{r.name}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </div>
            <span className="font-semibold tabular-nums text-zinc-200">{num(r.value)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Views of a typical Short {props.firstDay ? 'on its first day' : 'so far'}</p>
    </Panel>
  );
}

/** The four possible outcomes: viewers (stay / swipe) × reach (rising / not), with "you are here". */
function Matrix({ id, tone }: { id: GrowthOutlookId; tone: Tone }) {
  const cells: { id: Exclude<GrowthOutlookId, 'too_early'>; row: string; col: string }[] = [
    { id: 'growing', row: 'stay', col: 'rising' },
    { id: 'held_back', row: 'stay', col: 'not' },
    { id: 'will_stall', row: 'swipe', col: 'rising' },
    { id: 'not_growing', row: 'swipe', col: 'not' },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-bg-border bg-bg-base p-4">
      <p className="text-sm font-semibold text-zinc-300">Where you are</p>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-[11px]">
        <span />
        <span className="text-center text-zinc-500">Views rising</span>
        <span className="text-center text-zinc-500">Not rising</span>
        {(['stay', 'swipe'] as const).map((row) => (
          <Row key={row} label={row === 'stay' ? 'Viewers stay' : 'Viewers swipe'}>
            {cells
              .filter((c) => c.row === row)
              .map((c) => {
                const here = c.id === id;
                return (
                  <div
                    key={c.id}
                    className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center text-xs leading-tight ${here ? `${tone.border} ${tone.soft} font-bold ${tone.text}` : 'border-bg-border text-zinc-500'
                      }`}
                    aria-current={here ? 'true' : undefined}
                  >
                    {CELL[c.id]}
                    {here && <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">You are here</span>}
                  </div>
                );
              })}
          </Row>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center pr-1 text-zinc-500">{label}</span>
      {children}
    </>
  );
}
