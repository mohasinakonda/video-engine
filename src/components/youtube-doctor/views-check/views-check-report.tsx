'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import type { ShortTimeline, VideoFinding, ViewsCause } from '@/lib/youtube/views-check/types';
import { LEVEL_LABEL, levelOf, type Level } from '@/lib/youtube/views-check/levels';

/** Kept in step with VIEWS_CHECK_VERSION in run.ts (not imported: run.ts is server code). */
const REPORT_VERSION = 3;

const CAUSE: Record<ViewsCause, { label: string; color: string; pill: string }> = {
  blocked: { label: 'Blocked or not public', color: '#f43f5e', pill: 'bg-rose-950 text-rose-200' },
  not_shown: { label: 'Not shown to anyone', color: '#fb7185', pill: 'bg-rose-950 text-rose-200' },
  not_in_feed: { label: 'Not in the Shorts feed', color: '#a78bfa', pill: 'bg-violet-950 text-violet-200' },
  not_clicked: { label: 'Seen, not clicked', color: '#38bdf8', pill: 'bg-sky-950 text-sky-200' },
  left_early: { label: 'Viewers leave early', color: '#fb923c', pill: 'bg-orange-950 text-orange-200' },
  quick_stop: { label: 'Stopped after first burst', color: '#fbbf24', pill: 'bg-amber-950 text-amber-200' },
  unknown: { label: 'Not enough data yet', color: '#52525b', pill: 'bg-zinc-800 text-zinc-300' },
  too_new: { label: 'Too new to judge', color: '#71717a', pill: 'bg-zinc-800 text-zinc-300' },
  ok: { label: 'No problem found', color: '#34d399', pill: 'bg-emerald-950 text-emerald-200' },
};
const CAUSE_ORDER: ViewsCause[] = ['blocked', 'not_shown', 'not_in_feed', 'not_clicked', 'left_early', 'quick_stop', 'unknown', 'too_new', 'ok'];
const PROBLEMS = new Set<ViewsCause>(['blocked', 'not_shown', 'not_in_feed', 'not_clicked', 'left_early', 'quick_stop']);

// Palette classes only: the app's light theme remaps each shade (950 → pale tint, 200 → dark ink),
// so the same classes read well in both themes. Fixed hex colours would not swap.
const LEVEL_STYLE: Record<Level, { box: string; label: string; hint: string; pill: string; text: string; Icon: typeof AlertCircle }> = {
  critical: { box: 'bg-rose-950/70 border-rose-700', label: 'text-rose-200', hint: 'text-rose-300', pill: 'bg-rose-800 text-rose-50', text: 'text-rose-400', Icon: AlertTriangle },
  error: { box: 'bg-orange-950/70 border-orange-700', label: 'text-orange-200', hint: 'text-orange-300', pill: 'bg-orange-800 text-orange-50', text: 'text-orange-400', Icon: AlertCircle },
  warning: { box: 'bg-amber-950/70 border-amber-700', label: 'text-amber-200', hint: 'text-amber-300', pill: 'bg-amber-800 text-amber-50', text: 'text-amber-400', Icon: AlertCircle },
  ok: { box: 'bg-emerald-950/70 border-emerald-700', label: 'text-emerald-200', hint: 'text-emerald-300', pill: 'bg-emerald-800 text-emerald-50', text: 'text-zinc-200', Icon: CheckCircle2 },
};

const DAY = 86_400_000;
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const num = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('en-US'));

function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

type Filter = 'all' | 'short' | 'video' | 'problems';

export function ViewsCheckReport({ result, analyzedAt }: { result: ViewsCheckResult; analyzedAt: string }) {
  const [found, setFound] = useState<Set<string>>(new Set());
  if (result.version !== REPORT_VERSION) {
    return <div className="card text-base text-zinc-300">This report was made by an older version of the views check. Click “Check again” for the new report.</div>;
  }
  const { report, wording } = result;
  const timelines = new Map(report.shorts.map((s) => [s.videoId, s]));

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-400">
        Last {result.period.days} days · {report.verdict.basedOn} videos judged · {new Date(analyzedAt).toLocaleString()}
      </p>

      <VerdictNumbers result={result} />
      <KeyTiles result={result} />

      <details className="rounded-2xl border border-bg-border bg-bg-surface px-5 py-3.5">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-300">Explain this in words</summary>
        <div className="mt-3 space-y-2">
          <p className="text-base font-semibold text-white">{wording.headline}</p>
          <p className="text-base leading-relaxed text-zinc-300">{wording.explanation}</p>
          {wording.source === 'rules' && <p className="text-xs text-zinc-500">Written from the rules directly (the AI summary wasn’t available).</p>}
        </div>
      </details>

      {(wording.plan[0] || report.verdict.firstStep) && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-800 bg-emerald-950/70 px-5 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-800 font-extrabold text-emerald-50">1</span>
          <p className="min-w-0 flex-1 text-base text-emerald-100">
            <b className="text-white">Do this first:</b> {wording.plan[0] ?? report.verdict.firstStep}
          </p>
          {wording.plan.length > 1 && (
            <a href="#views-plan" className="whitespace-nowrap text-sm font-semibold text-emerald-300 hover:text-emerald-200">
              Full plan ({wording.plan.length}) →
            </a>
          )}
        </section>
      )}

      {found.size > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-base text-amber-100">You found a problem in Studio. Fix that first: it outranks everything else in this report.</p>
        </div>
      )}

      <VideoTable videos={report.videos} timelines={timelines} analyzedAt={analyzedAt} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Signals signals={report.signals} />
        <StudioChecks checks={report.studioChecks} found={found} setFound={setFound} />
      </div>

      {wording.plan.length > 0 && (
        <section id="views-plan" className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
          <h3 className="text-lg font-bold text-white">Your plan</h3>
          <ol className="space-y-2.5">
            {wording.plan.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-base text-zinc-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-white">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.limitations.length > 0 && (
        <details className="rounded-xl border border-bg-border bg-bg-surface px-5 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-400">What this check can’t see</summary>
          <ul className="mt-2 space-y-1">
            {report.limitations.map((l) => (
              <li key={l} className="text-sm text-zinc-400">
                {l}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── Top: the main reason as a number ─────────────────────────────────────────

function VerdictNumbers({ result }: { result: ViewsCheckResult }) {
  const { report } = result;
  const total = report.videos.length;
  const counts = CAUSE_ORDER.map((cause) => ({ cause, n: report.videos.filter((v) => v.cause === cause).length })).filter((c) => c.n > 0);
  const vc = report.verdict.cause;
  const main = vc in CAUSE ? (vc as ViewsCause) : null;
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

// ─── Key numbers ──────────────────────────────────────────────────────────────

interface TileData {
  label: string;
  value: string;
  level: Level | null;
  status?: string;
  hint: string;
}

function KeyTiles({ result }: { result: ViewsCheckResult }) {
  const { report } = result;
  const shorts = report.shorts;
  const swipe = shorts.find((s) => s.channelMedianSwipeAway !== null)?.channelMedianSwipeAway ?? median(shorts.map((s) => s.estSwipeAway));
  const first = median(shorts.map((s) => s.firstDaysShare));
  const feed = median(shorts.map((s) => s.shortsFeedShare));
  const viewed = median(report.videos.filter((v) => v.format === 'short').map((v) => v.avgViewPct));
  const avgShort = report.summary.avgShortViews;
  const avgLong = report.summary.avgLongViews;

  const tiles: TileData[] = [];
  if (swipe !== null) tiles.push({ label: 'Swiped away (est.), median Short', value: pct(swipe), level: levelOf('swipeAway', swipe), hint: 'Under 50% is good' });
  if (first !== null) {
    const level = levelOf('firstDaysShare', first);
    tiles.push({ label: 'Views in the first 2 days', value: pct(first), level, status: level === 'ok' ? 'Keeps going' : 'Stops fast', hint: 'Median of your checked Shorts' });
  }
  if (feed !== null) tiles.push({ label: 'Views from the Shorts feed', value: pct(feed), level: levelOf('shortsFeedShare', feed), hint: 'Healthy Shorts: most views' });
  if (viewed !== null) tiles.push({ label: 'Average viewed, Shorts', value: `${Math.round(viewed)}%`, level: levelOf('avgViewPct', viewed), hint: '50%+ holds viewers' });
  if (avgShort !== null) tiles.push({ label: 'Average views per Short', value: num(avgShort), level: null, hint: 'Recent Shorts' });
  else if (avgLong !== null) tiles.push({ label: 'Average views per video', value: num(avgLong), level: null, hint: 'Recent videos' });
  if (!tiles.length) return null;

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => (
        <LevelTile key={t.label} {...t} />
      ))}
    </section>
  );
}

function LevelTile({ label, value, level, status, hint, big = true }: TileData & { big?: boolean }) {
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

// ─── Videos table ─────────────────────────────────────────────────────────────

const COLS = 'md:grid-cols-[minmax(0,1fr)_72px_184px_76px_68px_84px_112px_44px]';
const PAGE = 8;

function VideoTable({ videos, timelines, analyzedAt }: { videos: VideoFinding[]; timelines: Map<string, ShortTimeline>; analyzedAt: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const sorted = useMemo(() => [...videos].sort((a, b) => CAUSE_ORDER.indexOf(a.cause) - CAUSE_ORDER.indexOf(b.cause)), [videos]);
  const shown = sorted.filter((v) => (filter === 'all' ? true : filter === 'problems' ? PROBLEMS.has(v.cause) : v.format === filter));
  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: videos.length },
    { id: 'short', label: 'Shorts', n: videos.filter((v) => v.format === 'short').length },
    { id: 'video', label: 'Videos', n: videos.filter((v) => v.format === 'video').length },
    { id: 'problems', label: 'Problems only', n: videos.filter((v) => PROBLEMS.has(v.cause)).length },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-bg-border bg-bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <h3 className="text-lg font-bold text-white">Your videos</h3>
        <div className="flex flex-wrap gap-1.5">
          {filters
            .filter((f) => f.id === 'all' || f.n > 0)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setLimit(PAGE);
                }}
                aria-pressed={filter === f.id}
                className={`h-8 rounded-full px-3 text-sm ${filter === f.id ? 'bg-white font-semibold text-zinc-950' : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
              >
                {f.label} {f.n}
              </button>
            ))}
        </div>
        <span className="ml-auto text-xs text-zinc-400">Worst first</span>
      </div>

      <div className={`hidden gap-3 border-t border-bg-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 md:grid ${COLS}`}>
        <span>Video</span>
        <span className="text-right">Views</span>
        <span>Reason</span>
        <span className="text-right">Swiped*</span>
        <span className="text-right">Viewed</span>
        <span className="text-right">First 2 days</span>
        <span>Views per day</span>
        <span />
      </div>

      <ul>
        {shown.slice(0, limit).map((v) => (
          <VideoRow
            key={v.videoId}
            video={v}
            timeline={timelines.get(v.videoId) ?? null}
            analyzedAt={analyzedAt}
            open={open === v.videoId}
            onToggle={() => setOpen(open === v.videoId ? null : v.videoId)}
          />
        ))}
      </ul>

      <div className="flex flex-wrap justify-between gap-2 border-t border-bg-border px-5 py-3 text-xs text-zinc-400">
        <span>* Swiped away is an estimate: 1 − engaged views ÷ views. Studio’s “Viewed vs swiped away” is exact.</span>
        {shown.length > limit && (
          <button type="button" onClick={() => setLimit(limit + PAGE * 3)} className="font-semibold text-emerald-300 hover:text-emerald-200">
            Show {Math.min(shown.length - limit, PAGE * 3)} more
          </button>
        )}
      </div>
    </section>
  );
}

function Cell({ value, level, label }: { value: string; level: Level | null; label: string }) {
  const bad = level !== null && level !== 'ok';
  return (
    <span className="flex items-baseline justify-between gap-2 md:block md:text-right">
      <span className="text-xs text-zinc-500 md:hidden">{label}</span>
      <span className={`text-sm tabular-nums ${bad && level ? `font-extrabold ${LEVEL_STYLE[level].text}` : 'text-zinc-200'}`}>{value}</span>
    </span>
  );
}

function VideoRow({
  video,
  timeline,
  analyzedAt,
  open,
  onToggle,
}: {
  video: VideoFinding;
  timeline: ShortTimeline | null;
  analyzedAt: string;
  open: boolean;
  onToggle: () => void;
}) {
  const ageDays = Math.max(0, Math.floor((Date.parse(analyzedAt) - Date.parse(video.publishedAt)) / DAY));
  const meta = [video.format === 'short' ? 'Short' : 'Video', video.durationSec ? clock(video.durationSec) : null, ageDays === 0 ? 'today' : `${ageDays} day${ageDays === 1 ? '' : 's'} ago`]
    .filter(Boolean)
    .join(' · ');
  const cause = CAUSE[video.cause];
  const swipe = timeline?.estSwipeAway ?? null;
  const first = timeline?.firstDaysShare ?? null;

  return (
    <li className="border-t border-bg-border">
      <div className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 px-5 py-3 ${COLS}`}>
        <div className="col-span-2 flex min-w-0 flex-col gap-0.5 md:col-span-1">
          <span className="truncate text-sm font-semibold text-white">{video.title || 'Untitled'}</span>
          <span className="text-xs text-zinc-400">{meta}</span>
        </div>
        <span className="flex items-baseline justify-between gap-2 md:block md:text-right">
          <span className="text-xs text-zinc-500 md:hidden">Views</span>
          <span className="text-[15px] font-bold text-white tabular-nums">{num(video.lifetimeViews)}</span>
        </span>
        <span className={`justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cause.pill}`}>{cause.label}</span>
        <Cell label="Swiped*" value={pct(swipe)} level={levelOf('swipeAway', swipe)} />
        <Cell label="Viewed" value={video.avgViewPct === null ? '—' : `${Math.round(video.avgViewPct)}%`} level={levelOf('avgViewPct', video.avgViewPct)} />
        <Cell label="First 2 days" value={pct(first)} level={levelOf('firstDaysShare', first)} />
        <Sparkline daily={timeline?.daily ?? []} color={cause.color} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? `Close details for ${video.title}` : `Open details for ${video.title}`}
          className="flex h-11 w-11 items-center justify-center justify-self-end rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500"
        >
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </div>
      {open && (timeline ? <ShortDetail video={video} t={timeline} /> : <FindingDetail video={video} />)}
    </li>
  );
}

function Sparkline({ daily, color }: { daily: { date: string; views: number }[]; color: string }) {
  const days = daily.slice(0, 14);
  if (!days.length) return <span className="hidden text-sm text-zinc-600 md:block">—</span>;
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div className="hidden h-7 items-end gap-0.5 md:flex" role="img" aria-label={`Views per day for the first ${days.length} days`}>
      {days.map((d) => (
        <div key={d.date} className="flex-1 rounded-t-sm" style={{ background: color, height: `${Math.max(8, (d.views / max) * 100)}%` }} title={`${d.date}: ${d.views.toLocaleString('en-US')} views`} />
      ))}
    </div>
  );
}

// ─── A row opened ─────────────────────────────────────────────────────────────

function Words({ video }: { video: VideoFinding }) {
  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-zinc-300">{video.reason}</p>
      {video.evidence.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {video.evidence.map((e) => (
            <span key={e} className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-xs text-zinc-300">
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Fix({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/70 px-4 py-3">
      <Check size={18} className="shrink-0 text-emerald-300" aria-hidden="true" />
      <p className="text-sm text-emerald-100">
        <b className="text-white">Fix:</b> {text}
      </p>
    </div>
  );
}

function FindingDetail({ video }: { video: VideoFinding }) {
  return (
    <div className="space-y-3 border-t border-bg-border bg-bg-base px-5 py-4">
      <Words video={video} />
      <Fix text={video.fix} />
    </div>
  );
}

function ShortDetail({ video, t }: { video: VideoFinding; t: ShortTimeline }) {
  const watched =
    t.avgViewSec !== null && t.durationSec
      ? { value: `${Math.round(t.avgViewSec)}s`, hint: `of ${Math.round(t.durationSec)}s${t.avgViewPct ? ` (${Math.round(t.avgViewPct)}%)` : ''}` }
      : { value: t.avgViewPct !== null ? `${Math.round(t.avgViewPct)}%` : '—', hint: 'of the Short' };
  const drop = t.biggestDrop && t.biggestDrop.lost >= 0.05 ? t.biggestDrop : null;
  const big: TileData[] = [
    {
      label: 'Swiped away (estimate)',
      value: pct(t.estSwipeAway),
      level: levelOf('swipeAway', t.estSwipeAway),
      hint: t.channelMedianSwipeAway !== null ? `Your median Short: ${pct(t.channelMedianSwipeAway)}` : 'Studio shows the exact number',
    },
    { label: 'Watched on average', value: watched.value, level: levelOf('avgViewPct', t.avgViewPct || null), hint: watched.hint },
    { label: 'Half the viewers gone by', value: t.halfGoneAtSec === null ? '—' : clock(t.halfGoneAtSec), level: null, hint: drop ? `Biggest drop at ${clock(drop.atSec)}` : 'From the retention curve' },
    { label: 'Retention vs similar Shorts', value: t.relativeRetention === null ? '—' : t.relativeRetention.toFixed(2), level: levelOf('relativeRetention', t.relativeRetention), hint: '0.5 is typical' },
  ];
  const small = [
    { label: 'Day 1 / day 2', value: t.day1Views === null ? '—' : `${num(t.day1Views)} / ${num(t.day2Views ?? 0)}` },
    { label: 'From Shorts feed', value: pct(t.shortsFeedShare) },
    { label: 'Likes per 100 views', value: t.likeRate === null ? '—' : (t.likeRate * 100).toFixed(1) },
    { label: 'Days reported', value: String(video.reportedDays) },
  ];

  return (
    <div className="space-y-4 border-t border-bg-border bg-bg-base px-5 py-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {big.map((b) => (
          <LevelTile key={b.label} {...b} big={false} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyChart daily={t.daily} firstShare={t.firstDaysShare} color={CAUSE[video.cause].color} />
        <RetentionChart t={t} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {small.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-2 rounded-xl border border-bg-border bg-bg-surface px-3 py-2.5">
            <span className="text-xs text-zinc-400">{s.label}</span>
            <span className="text-[15px] font-bold text-white tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
      <Fix text={video.fix} />
      <details className="rounded-xl border border-bg-border px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-300">Why, in words</summary>
        <div className="mt-3">
          <Words video={video} />
        </div>
      </details>
    </div>
  );
}

function DailyChart({ daily, firstShare, color }: { daily: { date: string; views: number }[]; firstShare: number | null; color: string }) {
  const days = daily.slice(0, 14);
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-bg-border bg-bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">Views per day since upload</p>
        {firstShare !== null && <p className="text-xs text-zinc-400">{pct(firstShare)} in the first 2 days</p>}
      </div>
      {days.length ? (
        <>
          <div className="flex h-44 items-end gap-1.5 border-b border-zinc-700" role="img" aria-label={days.map((d, i) => `Day ${i + 1}: ${d.views}`).join(', ')}>
            {days.map((d, i) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-zinc-300 tabular-nums">{d.views.toLocaleString('en-US')}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(1.5, (d.views / max) * 80)}%`, background: i < 2 ? color : '#52525b' }} />
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

function RetentionChart({ t }: { t: ShortTimeline }) {
  const W = 460;
  const H = 190;
  const x = (at: number) => 36 + at * (W - 44);
  const y = (w: number) => 10 + (1 - Math.max(0, Math.min(1, w))) * 150;
  const curve = t.curve ?? [];
  const dur = t.durationSec;
  const drop = t.biggestDrop && t.biggestDrop.lost >= 0.05 && dur ? t.biggestDrop : null;
  const at = (sec: number) => (dur ? Math.min(1, sec / dur) : 0);
  const watchingAt = (a: number) => curve.reduce((best, p) => (Math.abs(p.at - a) < Math.abs(best.at - a) ? p : best), curve[0])?.watching ?? 0;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-bg-border bg-bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">Viewers still watching</p>
        {dur ? <p className="text-xs text-zinc-400">0:00 → {clock(dur)}</p> : null}
      </div>
      {curve.length > 1 ? (
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Retention curve${t.halfGoneAtSec !== null ? `; half the viewers gone by ${clock(t.halfGoneAtSec)}` : ''}${drop ? `; biggest drop at ${clock(drop.atSec)}` : ''}`}
        >
          {[1, 0.5, 0].map((g) => (
            <g key={g}>
              <line x1={36} y1={y(g)} x2={W - 8} y2={y(g)} className={g === 0 ? 'stroke-zinc-700' : 'stroke-zinc-800'} strokeWidth={1} />
              <text x={30} y={y(g) + 4} className="fill-zinc-400" fontSize={11} textAnchor="end">
                {Math.round(g * 100)}%
              </text>
            </g>
          ))}
          <polyline points={curve.map((p) => `${x(p.at)},${y(p.watching)}`).join(' ')} fill="none" className="stroke-rose-400" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {drop && (
            <g>
              <line x1={x(at(drop.atSec))} y1={10} x2={x(at(drop.atSec))} y2={160} className="stroke-rose-400" strokeWidth={1} strokeDasharray="3 4" />
              <circle cx={x(at(drop.atSec))} cy={y(watchingAt(at(drop.atSec)))} r={5} className="fill-rose-400 stroke-bg-surface" strokeWidth={2} />
              <text x={Math.min(x(at(drop.atSec)) + 8, W - 180)} y={26} className="fill-rose-300" fontSize={12} fontWeight={600}>
                Biggest drop {clock(drop.atSec)} · −{Math.round(drop.lost * 100)}%
              </text>
            </g>
          )}
          {t.halfGoneAtSec !== null && dur ? (
            <g>
              <circle cx={x(at(t.halfGoneAtSec))} cy={y(0.5)} r={5} className="fill-white stroke-bg-surface" strokeWidth={2} />
              <text x={Math.min(x(at(t.halfGoneAtSec)) + 8, W - 130)} y={y(0.5) + 18} className="fill-zinc-200" fontSize={12} fontWeight={600}>
                Half gone by {clock(t.halfGoneAtSec)}
              </text>
            </g>
          ) : null}
          <text x={36} y={182} className="fill-zinc-400" fontSize={11}>
            0:00
          </text>
          {dur ? (
            <text x={W - 8} y={182} className="fill-zinc-400" fontSize={11} textAnchor="end">
              {clock(dur)}
            </text>
          ) : null}
        </svg>
      ) : (
        <p className="text-sm text-zinc-400">YouTube hasn’t reported a retention curve for this Short yet.</p>
      )}
    </div>
  );
}

// ─── Patterns and Studio ──────────────────────────────────────────────────────

const SEVERITY: Record<'high' | 'medium' | 'low', { label: string; pill: string }> = {
  high: { label: 'High', pill: 'bg-rose-950 text-rose-200' },
  medium: { label: 'Medium', pill: 'bg-amber-950 text-amber-200' },
  low: { label: 'Low', pill: 'bg-zinc-800 text-zinc-300' },
};

function Signals({ signals }: { signals: ViewsCheckResult['report']['signals'] }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <h3 className="text-lg font-bold text-white">
        Channel patterns <span className="font-medium text-zinc-400">· {signals.length}</span>
      </h3>
      {signals.length === 0 ? (
        <p className="text-sm text-zinc-400">No channel-wide problems found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {signals.map((s) => (
            <li key={s.id}>
              <details className="rounded-xl border border-bg-border bg-bg-base px-3 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className={`w-[68px] shrink-0 rounded-full py-0.5 text-center text-xs font-semibold ${SEVERITY[s.severity].pill}`}>{SEVERITY[s.severity].label}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-white">{s.title}</span>
                  <ChevronDown size={16} className="shrink-0 text-zinc-500" aria-hidden="true" />
                </summary>
                <div className="mt-2 space-y-1 sm:pl-[80px]">
                  <p className="text-sm text-zinc-300">{s.detail}</p>
                  <p className="text-sm text-emerald-300">{s.fix}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StudioChecks({
  checks,
  found,
  setFound,
}: {
  checks: ViewsCheckResult['report']['studioChecks'];
  found: Set<string>;
  setFound: (update: (prev: Set<string>) => Set<string>) => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-white">Check in YouTube Studio</h3>
        <span className="text-sm text-zinc-400">
          {found.size} of {checks.length} with a problem
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {checks.map((c) => {
          const checked = found.has(c.id);
          return (
            <li key={c.id}>
              <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] accent-amber-500"
                  checked={checked}
                  onChange={() =>
                    setFound((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                />
                <span className="font-medium">{c.title}</span>
              </label>
              <details className="ml-7">
                <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">Where to look</summary>
                <p className="mt-1 text-xs text-zinc-300">{c.where}</p>
                <p className="text-xs text-zinc-400">{c.why}</p>
              </details>
              {checked && <p className="ml-7 mt-1 text-sm text-amber-200">{c.ifFound}</p>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-400">YouTube’s API doesn’t share these. Tick one if you find a problem there.</p>
    </section>
  );
}
