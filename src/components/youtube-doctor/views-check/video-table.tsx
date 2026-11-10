'use client';

/** The list of the channel's videos as a table, worst first; a row opens to its details. */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { levelOf, swipeTier, type Level } from '@/lib/youtube/views-check/levels';
import type { ShortTimeline, VideoFinding } from '@/lib/youtube/views-check/types';
import { ageText, clock, endPct, engagementPct, num, pct } from './format';
import { FindingDetail, GateStripCompact, ShortDetail } from './short-detail';
import { CAUSE, CAUSE_ORDER, LEVEL_STYLE, PROBLEMS } from './styles';
import { ScoreChip } from './test-rounds';

type Filter = 'all' | 'problems';

const PAGE = 8;
const COLUMNS = ['Video', 'Views', 'Reason', 'Swiped', 'Avg watched', 'To the end', 'From feed', 'Engagement', 'Views per day', ''] as const;
const RIGHT_ALIGNED = new Set<string>(['Views', 'Swiped', 'Avg watched', 'To the end', 'From feed', 'Engagement']);
const SPARK_DAYS = 14;

const byWorstFirst = (a: VideoFinding, b: VideoFinding) => CAUSE_ORDER.indexOf(a.cause) - CAUSE_ORDER.indexOf(b.cause);
const matches = (filter: Filter, v: VideoFinding) => filter === 'all' || PROBLEMS.has(v.cause);

export function VideoTable({ videos, timelines, analyzedAt }: { videos: VideoFinding[]; timelines: Map<string, ShortTimeline>; analyzedAt: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const sorted = useMemo(() => [...videos].sort(byWorstFirst), [videos]);
  const shown = sorted.filter((v) => matches(filter, v));
  const problems = videos.filter((v) => PROBLEMS.has(v.cause)).length;

  function selectFilter(next: Filter) {
    setFilter(next);
    setLimit(PAGE);
  }
  function toggleRow(id: string) {
    setOpen((current) => (current === id ? null : id));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-bg-border bg-bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <h3 className="text-lg font-bold text-white">Your Shorts</h3>
        <div className="flex flex-wrap gap-1.5">
          <FilterButton id="all" label="All" count={videos.length} active={filter} onSelect={selectFilter} />
          {problems > 0 && <FilterButton id="problems" label="Problems only" count={problems} active={filter} onSelect={selectFilter} />}
        </div>
        <span className="ml-auto text-xs text-zinc-400">Worst first</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr className="border-t border-bg-border text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {COLUMNS.map((c, i) => (
                <th key={c || i} scope="col" className={`px-3 py-2.5 font-semibold first:pl-5 last:pr-5 ${RIGHT_ALIGNED.has(c) ? 'text-right' : ''}`}>
                  {c || <span className="sr-only">Details</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((v) => (
              <VideoRow key={v.videoId} video={v} timeline={timelines.get(v.videoId) ?? null} analyzedAt={analyzedAt} open={open === v.videoId} onToggle={toggleRow} />
            ))}
          </tbody>
        </table>
      </div>

      {shown.length > limit && (
        <div className="flex justify-end border-t border-bg-border px-5 py-3 text-xs">
          <button type="button" onClick={() => setLimit(limit + PAGE * 3)} className="font-semibold text-emerald-300 hover:text-emerald-200">
            Show {Math.min(shown.length - limit, PAGE * 3)} more
          </button>
        </div>
      )}
    </section>
  );
}

function FilterButton({ id, label, count, active, onSelect }: { id: Filter; label: string; count: number; active: Filter; onSelect: (f: Filter) => void }) {
  const selected = active === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      className={`h-8 rounded-full px-3 text-sm ${selected ? 'bg-white font-semibold text-zinc-950' : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
    >
      {label} {count}
    </button>
  );
}

// ─── A row ────────────────────────────────────────────────────────────────────

interface RowProps {
  video: VideoFinding;
  timeline: ShortTimeline | null;
  analyzedAt: string;
  open: boolean;
  onToggle: (id: string) => void;
}

function rowMeta(video: VideoFinding, timeline: ShortTimeline | null, analyzedAt: string): string {
  const parts = [video.format === 'short' ? 'Short' : 'Video', video.durationSec ? clock(video.durationSec) : null, ageText(video.publishedAt, analyzedAt), timeline?.topic ?? null];
  return parts.filter(Boolean).join(' · ');
}

/** "25s / 40s" with "65%" under it, or just the % when seconds aren't known. */
function avgWatched(video: VideoFinding, t: ShortTimeline | null): { value: string; sub?: string } {
  if (t?.avgViewSec != null && video.durationSec) {
    return { value: `${Math.round(t.avgViewSec)}s / ${Math.round(video.durationSec)}s`, sub: video.avgViewPct !== null ? `${Math.round(video.avgViewPct)}%` : undefined };
  }
  return { value: video.avgViewPct === null ? '—' : `${Math.round(video.avgViewPct)}%` };
}

function VideoRow({ video, timeline: t, analyzedAt, open, onToggle }: RowProps) {
  const cause = CAUSE[video.cause];
  const swipe = t?.estSwipeAway ?? null;
  const watched = avgWatched(video, t);
  const usualSwipe = t?.channelMedianSwipeAway != null && swipe !== null ? `usual ${pct(t.channelMedianSwipeAway)}` : undefined;

  return (
    <>
      <tr className="border-t border-bg-border align-middle">
        <td className="max-w-[280px] py-3 pl-5 pr-3">
          <p className="truncate text-sm font-semibold text-white">{video.title || 'Untitled'}</p>
          <p className="truncate text-xs text-zinc-400">{rowMeta(video, t, analyzedAt)}</p>
          {!t?.rounds && t?.gates && <GateStripCompact gates={t.gates} />}
        </td>
        <td className="px-3 py-3 text-right text-[15px] font-bold tabular-nums text-white">{num(video.lifetimeViews)}</td>
        <td className="w-[220px] px-3 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cause.pill}`}>{cause.label}</span>
            {t?.test && <ScoreChip test={t.test} />}
          </div>
          {video.fix && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-400" title={video.fix}>
              {video.fix}
            </p>
          )}
        </td>
        <NumCell value={pct(swipe)} level={levelOf('swipeAway', swipe)} sub={''} title={swipeTier(swipe) ?? undefined} />
        <NumCell value={''} level={levelOf('avgViewPct', video.avgViewPct)} sub={watched.sub} />
        <NumCell value={endPct(t?.completion?.ofViews)} />
        <NumCell value={pct(t?.shortsFeedShare)} />
        <EngagementCell timeline={t} />
        <td className="w-[96px] px-3 py-3">
          <Sparkline daily={t?.daily ?? []} color={cause.color} />
        </td>
        <td className="py-3 pl-3 pr-5 text-right">
          <button
            type="button"
            onClick={() => onToggle(video.videoId)}
            aria-expanded={open}
            aria-label={`${open ? 'Close' : 'Open'} details for ${video.title}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500"
          >
            {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={COLUMNS.length} className="p-0">
            {t ? <ShortDetail video={video} t={t} /> : <FindingDetail video={video} />}
          </td>
        </tr>
      )}
    </>
  );
}

/** A right-aligned number, bold and coloured when its level is a problem. */
function NumCell({ value, level = null, sub, title }: { value: string; level?: Level | null; sub?: string; title?: string }) {
  const tone = level && level !== 'ok' ? `font-extrabold ${LEVEL_STYLE[level].text}` : 'text-zinc-200';
  return (
    <td className="px-3 py-3 text-right" title={title}>
      <p className={`text-sm tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] tabular-nums text-zinc-500">{sub}</p>}
    </td>
  );
}

/** Engagement % = (likes + comments + shares) ÷ views; the counts are in the tooltip. */
function EngagementCell({ timeline: t }: { timeline: ShortTimeline | null }) {
  const rate = engagementPct(t?.interactions, t?.views ?? 0);
  const i = t?.interactions;
  const counts = i ? `${num(i.likes)} likes · ${num(i.comments)} comments · ${num(i.shares)} shares` : undefined;
  return (
    <td className="px-3 py-3 text-right" title={counts}>
      <p className="text-sm font-semibold tabular-nums text-zinc-100">{rate === null ? '—' : `${rate.toFixed(1)}%`}</p>
    </td>
  );
}

function Sparkline({ daily, color }: { daily: { date: string; views: number }[]; color: string }) {
  const days = daily.slice(0, SPARK_DAYS);
  if (!days.length) return <span className="text-sm text-zinc-600">—</span>;
  const max = Math.max(1, ...days.map((d) => d.views));
  return (
    <div className="flex h-7 items-end gap-0.5" role="img" aria-label={`Views per day for the first ${days.length} days`}>
      {days.map((d) => (
        <div key={d.date} className="flex-1 rounded-t-sm" style={{ background: color, height: `${Math.max(8, (d.views / max) * 100)}%` }} title={`${d.date}: ${num(d.views)} views`} />
      ))}
    </div>
  );
}
