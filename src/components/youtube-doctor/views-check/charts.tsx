/** The two charts in an opened Short: views per day, and viewers still watching. */
import type { ShortTimeline, TestRound } from '@/lib/youtube/views-check/types';
import { clock, pct } from './format';
import { MUTED_BAR, ROUND_COLOR } from './styles';

const CHART_DAYS = 14;

interface DailyChartProps {
  daily: { date: string; views: number }[];
  firstShare: number | null;
  /** Colour for the first two days when there are no rounds. */
  color: string;
  /** Which round each date belongs to; those days get the round's colour. */
  dayRound?: Record<string, TestRound['no']>;
}

function barColor(date: string, index: number, color: string, dayRound?: Record<string, TestRound['no']>): string {
  if (!dayRound) return index < 2 ? color : MUTED_BAR;
  const round = dayRound[date];
  return round ? ROUND_COLOR[round] : MUTED_BAR;
}

function RoundLegend({ rounds }: { rounds: TestRound['no'][] }) {
  return (
    <p className="flex flex-wrap gap-x-3 text-xs text-zinc-400">
      {rounds.map((no) => (
        <span key={no} className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ROUND_COLOR[no] }} aria-hidden="true" />
          Round {no}
        </span>
      ))}
    </p>
  );
}

export function DailyChart({ daily, firstShare, color, dayRound }: DailyChartProps) {
  const days = daily.slice(0, CHART_DAYS);
  const roundsShown = dayRound ? ([1, 2, 3] as const).filter((no) => days.some((d) => dayRound[d.date] === no)) : [];
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-bg-border bg-bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">Views per day since upload</p>
        {roundsShown.length > 0 ? (
          <RoundLegend rounds={roundsShown} />
        ) : (
          firstShare !== null && <p className="text-xs text-zinc-400">{pct(firstShare)} in the first 2 days</p>
        )}
      </div>
      {days.length ? (
        <>
          <div className="flex h-44 items-end gap-1.5 border-b border-zinc-700" role="img" aria-label={days.map((d, i) => `Day ${i + 1}: ${d.views}`).join(', ')}>
            {days.map((d, i) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-zinc-300 tabular-nums">{d.views.toLocaleString('en-US')}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(1.5, (d.views / max) * 80)}%`, background: barColor(d.date, i, color, dayRound) }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {days.map((d, i) => (
              <span key={d.date} className="flex-1 text-center text-[10px] text-zinc-400">
                D{i + 1}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-400">YouTube hasn’t reported daily views for this Short yet.</p>
      )}
    </div>
  );
}

// ─── Retention ────────────────────────────────────────────────────────────────

const W = 460;
const H = 190;
const LEFT = 36;
const PLOT_TOP = 10;
const PLOT_HEIGHT = 150;

/** Scales for the retention chart: 100% = everyone who started; rewatches can go above it. */
function retentionScale(t: ShortTimeline) {
  const curve = t.curve ?? [];
  const top = Math.max(1, Math.ceil(Math.max(0, ...curve.map((p) => p.watching)) * 4) / 4);
  const dur = t.durationSec;
  return {
    curve,
    top,
    dur,
    grid: top > 1 ? [top, 1, 0.5, 0] : [1, 0.5, 0],
    x: (at: number) => LEFT + at * (W - 44),
    y: (w: number) => PLOT_TOP + (1 - Math.max(0, Math.min(top, w)) / top) * PLOT_HEIGHT,
    at: (sec: number) => (dur ? Math.min(1, sec / dur) : 0),
    watchingAt: (a: number) => curve.reduce((best, p) => (Math.abs(p.at - a) < Math.abs(best.at - a) ? p : best), curve[0])?.watching ?? 0,
  };
}

function retentionLabel(t: ShortTimeline, dropAt: number | null): string {
  const half = t.halfGoneAtSec !== null ? `; half the viewers gone by ${clock(t.halfGoneAtSec)}` : '';
  const drop = dropAt !== null ? `; biggest drop at ${clock(dropAt)}` : '';
  return `Retention curve${half}${drop}`;
}

export function RetentionChart({ t }: { t: ShortTimeline }) {
  const s = retentionScale(t);
  const drop = t.biggestDrop && t.biggestDrop.lost >= 0.05 && s.dur ? t.biggestDrop : null;
  const exit = t.exitWindow && t.exitWindow.toSec !== null && s.dur && t.exitWindow.toSec - t.exitWindow.fromSec >= 1 ? { from: t.exitWindow.fromSec, to: t.exitWindow.toSec } : null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-bg-border bg-bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">Viewers still watching</p>
        {s.top > 1 && <p className="text-xs text-emerald-300">Above 100% = rewatches</p>}
        {s.dur ? <p className="text-xs text-zinc-400">0:00 → {clock(s.dur)}</p> : null}
      </div>
      <p className="text-xs text-zinc-400">Share of views still watching, as in YouTube Studio. Above 100% = rewatches.</p>
      {s.curve.length > 1 ? (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={retentionLabel(t, drop?.atSec ?? null)}>
          {s.grid.map((g) => (
            <g key={g}>
              <line x1={LEFT} y1={s.y(g)} x2={W - 8} y2={s.y(g)} className={g === 0 || (g === 1 && s.top > 1) ? 'stroke-zinc-600' : 'stroke-zinc-800'} strokeWidth={1} />
              <text x={30} y={s.y(g) + 4} className="fill-zinc-400" fontSize={11} textAnchor="end">
                {Math.round(g * 100)}%
              </text>
            </g>
          ))}
          {exit && (
            <rect x={s.x(s.at(exit.from))} y={PLOT_TOP} width={Math.max(2, s.x(s.at(exit.to)) - s.x(s.at(exit.from)))} height={PLOT_HEIGHT} className="fill-rose-500/10">
              <title>{`Most viewers leave between ${clock(exit.from)} and ${clock(exit.to)}`}</title>
            </rect>
          )}
          <polyline
            points={s.curve.map((p) => `${s.x(p.at)},${s.y(p.watching)}`).join(' ')}
            fill="none"
            className="stroke-rose-400"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {drop && (
            <g>
              <line x1={s.x(s.at(drop.atSec))} y1={PLOT_TOP} x2={s.x(s.at(drop.atSec))} y2={PLOT_TOP + PLOT_HEIGHT} className="stroke-rose-400" strokeWidth={1} strokeDasharray="3 4" />
              <circle cx={s.x(s.at(drop.atSec))} cy={s.y(s.watchingAt(s.at(drop.atSec)))} r={5} className="fill-rose-400 stroke-bg-surface" strokeWidth={2} />
              <text x={Math.min(s.x(s.at(drop.atSec)) + 8, W - 180)} y={26} className="fill-rose-300" fontSize={12} fontWeight={600}>
                Biggest drop {clock(drop.atSec)} · −{Math.round(drop.lost * 100)}%
              </text>
            </g>
          )}
          {t.halfGoneAtSec !== null && s.dur ? (
            <g>
              <circle cx={s.x(s.at(t.halfGoneAtSec))} cy={s.y(0.5)} r={5} className="fill-white stroke-bg-surface" strokeWidth={2} />
              <text x={Math.min(s.x(s.at(t.halfGoneAtSec)) + 8, W - 130)} y={s.y(0.5) + 18} className="fill-zinc-200" fontSize={12} fontWeight={600}>
                Half gone by {clock(t.halfGoneAtSec)}
              </text>
            </g>
          ) : null}
          <text x={LEFT} y={182} className="fill-zinc-400" fontSize={11}>
            0:00
          </text>
          {s.dur ? (
            <text x={W - 8} y={182} className="fill-zinc-400" fontSize={11} textAnchor="end">
              {clock(s.dur)}
            </text>
          ) : null}
        </svg>
      ) : (
        <p className="text-sm text-zinc-400">YouTube hasn’t reported a retention curve for this Short yet.</p>
      )}
    </div>
  );
}
