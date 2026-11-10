/** The top of the report: the main reason as a number, and the channel's key numbers. */
import { LEVEL_LABEL, levelOf, type Level } from '@/lib/youtube/views-check/levels';
import type { ViewsCheckReport, ViewsCause } from '@/lib/youtube/views-check/types';
import { median, num, pct } from './format';
import { CAUSE, CAUSE_ORDER, LEVEL_STYLE } from './styles';

export interface TileData {
  label: string;
  value: string;
  level: Level | null;
  status?: string;
  hint: string;
}

export function LevelTile({ label, value, level, status, hint, big = true }: TileData & { big?: boolean }) {
  const s = level ? LEVEL_STYLE[level] : null;
  return (
    <div className={`flex flex-col gap-1.5 rounded-2xl border p-4 ${s ? s.box : 'border-bg-border bg-bg-surface'}`}>
      <p className={`min-h-[32px] text-xs leading-snug ${s ? s.label : 'text-zinc-400'}`}>{label}</p>
      <p className={`${big ? 'text-3xl' : 'text-2xl'} font-extrabold leading-none text-white tabular-nums`}>{value}</p>
      {s && level && (
        <span className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-bold ${s.pill}`}>
          <s.Icon size={12} aria-hidden="true" />
          {status ?? LEVEL_LABEL[level]}
        </span>
      )}
      <p className={`text-[11px] ${s ? s.hint : 'text-zinc-400'}`}>{hint}</p>
    </div>
  );
}

function causeCounts(report: ViewsCheckReport) {
  return CAUSE_ORDER.map((cause) => ({ cause, n: report.videos.filter((v) => v.cause === cause).length })).filter((c) => c.n > 0);
}

export function VerdictNumbers({ report }: { report: ViewsCheckReport }) {
  const total = report.videos.length;
  const counts = causeCounts(report);
  const main = report.verdict.cause in CAUSE ? (report.verdict.cause as ViewsCause) : null;
  const mainCount = main ? (counts.find((c) => c.cause === main)?.n ?? 0) : 0;

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-bg-border bg-bg-surface p-6 md:flex-row md:gap-8">
      <div className="flex shrink-0 flex-col gap-1.5 md:w-64">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{main === 'ok' ? 'Result' : 'Main reason'}</p>
        {main && mainCount > 0 ? (
          <>
            <p className="text-5xl font-extrabold leading-none text-white tabular-nums">
              {mainCount}
              <span className="text-2xl font-semibold text-zinc-400"> of {total}</span>
            </p>
            <p className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CAUSE[main].color }} aria-hidden="true" />
              {main === 'ok' ? 'videos have no problem' : `videos: ${CAUSE[main].label.toLowerCase()}`}
            </p>
          </>
        ) : (
          <p className="text-lg font-semibold text-white">{report.verdict.headline}</p>
        )}
      </div>
      {total > 0 && (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3.5">
          <p className="text-sm font-semibold text-zinc-300">Why each video got the views it did</p>
          <div className="flex h-[18px] gap-0.5" role="img" aria-label={counts.map((c) => `${c.n} ${CAUSE[c.cause].label}`).join(', ')}>
            {counts.map((c) => (
              <div key={c.cause} className="rounded" style={{ flex: `${c.n} 1 0`, background: CAUSE[c.cause].color }} />
            ))}
          </div>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            {counts.map((c) => (
              <li key={c.cause} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CAUSE[c.cause].color }} aria-hidden="true" />
                <span className="min-w-[18px] font-bold text-white tabular-nums">{c.n}</span>
                {CAUSE[c.cause].label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function keyTiles(report: ViewsCheckReport): TileData[] {
  const shorts = report.shorts;
  const swipe = shorts.find((s) => s.channelMedianSwipeAway !== null)?.channelMedianSwipeAway ?? median(shorts.map((s) => s.estSwipeAway));
  const first = median(shorts.map((s) => s.firstDaysShare));
  const feed = median(shorts.map((s) => s.shortsFeedShare));
  const viewed = median(report.videos.filter((v) => v.format === 'short').map((v) => v.avgViewPct));
  const { avgShortViews, avgLongViews } = report.summary;

  const tiles: TileData[] = [];
  if (swipe !== null) tiles.push({ label: 'Swiped away (est.), median Short', value: pct(swipe), level: levelOf('swipeAway', swipe), hint: 'Under 50% is good' });
  if (first !== null) {
    const level = levelOf('firstDaysShare', first);
    tiles.push({ label: 'Views in the first 2 days', value: pct(first), level, status: level === 'ok' ? 'Keeps going' : 'Stops fast', hint: 'Median of your checked Shorts' });
  }
  if (feed !== null) tiles.push({ label: 'Views from the Shorts feed', value: pct(feed), level: levelOf('shortsFeedShare', feed), hint: 'Healthy Shorts: most views' });
  if (viewed !== null) tiles.push({ label: 'Average viewed, Shorts', value: `${Math.round(viewed)}%`, level: levelOf('avgViewPct', viewed), hint: '50%+ holds viewers' });
  if (avgShortViews !== null) tiles.push({ label: 'Average views per Short', value: num(avgShortViews), level: null, hint: 'Recent Shorts' });
  else if (avgLongViews !== null) tiles.push({ label: 'Average views per video', value: num(avgLongViews), level: null, hint: 'Recent videos' });
  return tiles;
}

export function KeyTiles({ report }: { report: ViewsCheckReport }) {
  const tiles = keyTiles(report);
  if (!tiles.length) return null;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => (
        <LevelTile key={t.label} {...t} />
      ))}
    </section>
  );
}
