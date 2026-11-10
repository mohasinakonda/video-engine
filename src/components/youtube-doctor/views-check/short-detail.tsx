/** What opens under a row: a Short's rounds, test, steps, numbers and charts, or a finding in words. */
import { Check } from 'lucide-react';
import { levelOf } from '@/lib/youtube/views-check/levels';
import type { Gate, ShortTimeline, VideoFinding } from '@/lib/youtube/views-check/types';
import { DailyChart, RetentionChart } from './charts';
import { clock, endPct, num, pct } from './format';
import { CAUSE, GATE_LABEL, STATE_BOX, STATE_MARK, STATE_TONE } from './styles';
import { LevelTile, type TileData } from './summary';
import { RoundsBox, roundDates, TestBox } from './test-rounds';

// ─── Steps: shown → stopped scrolling → stayed → reacted ──────────────────────

const GATE_SHORT: Record<Gate['id'], string> = { shown: 'Shown', stopped: 'Scroll', stayed: 'Stayed', reacted: 'React' };

/** Compact steps for a table row; the first ✗ is where the Short stopped. */
export function GateStripCompact({ gates }: { gates: Gate[] }) {
  const stopAt = gates.find((g) => g.state === 'fail')?.id;
  return (
    <span className="flex flex-wrap gap-x-2 text-[11px]" aria-label={gates.map((g) => `${GATE_LABEL[g.id]}: ${g.state}`).join(', ')}>
      {gates.map((g) => (
        <span key={g.id} className={`${STATE_TONE[g.state]} ${g.id === stopAt ? 'font-bold' : ''}`} title={`${GATE_LABEL[g.id]}: ${g.note}`}>
          {GATE_SHORT[g.id]} {STATE_MARK[g.state]}
        </span>
      ))}
    </span>
  );
}

function GateStrip({ gates }: { gates: Gate[] }) {
  const stopAt = gates.find((g) => g.state === 'fail')?.id;
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Where this Short stopped">
      {gates.map((g, i) => (
        <li key={g.id} className={`rounded-xl border p-3 ${STATE_BOX[g.state]}`}>
          <p className={`text-xs font-semibold ${STATE_TONE[g.state]}`}>
            {i + 1}. {GATE_LABEL[g.id]} {STATE_MARK[g.state]}
            {g.id === stopAt && <span className="ml-1 rounded bg-rose-800 px-1.5 py-0.5 text-[10px] text-rose-50">stopped here</span>}
          </p>
          <p className="mt-1 text-sm text-zinc-200">{g.note}</p>
        </li>
      ))}
    </ol>
  );
}

// ─── Words and fix ────────────────────────────────────────────────────────────

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

/** A video without a Short timeline: the finding in words and its fix. */
export function FindingDetail({ video }: { video: VideoFinding }) {
  return (
    <div className="space-y-3 border-t border-bg-border bg-bg-base px-5 py-4">
      <Words video={video} />
      <Fix text={video.fix} />
    </div>
  );
}

// ─── A Short opened ───────────────────────────────────────────────────────────

function swipeHint(t: ShortTimeline): string {
  const parts: string[] = [];
  if (t.estSwipeAway !== null) parts.push(`≈${pct(1 - t.estSwipeAway)} stayed to watch`);
  if (t.channelMedianSwipeAway !== null) parts.push(`your median Short: ${pct(t.channelMedianSwipeAway)}`);
  return parts.join(' · ') || 'Studio shows the exact number';
}

function watchedTile(t: ShortTimeline): Pick<TileData, 'value' | 'hint'> {
  if (t.avgViewSec !== null && t.durationSec) {
    return { value: `${Math.round(t.avgViewSec)}s`, hint: `of ${Math.round(t.durationSec)}s${t.avgViewPct ? ` (${Math.round(t.avgViewPct)}%)` : ''}` };
  }
  return { value: t.avgViewPct !== null ? `${Math.round(t.avgViewPct)}%` : '—', hint: 'of the Short' };
}

function leaveHint(t: ShortTimeline): string {
  const w = t.exitWindow;
  if (w && w.toSec !== null && w.toSec - w.fromSec >= 1) return `Most leave ${clock(w.fromSec)}–${clock(w.toSec)}`;
  if (t.biggestDrop && t.biggestDrop.lost >= 0.05) return `Biggest drop at ${clock(t.biggestDrop.atSec)}`;
  return 'From the retention curve';
}

function detailTiles(t: ShortTimeline): TileData[] {
  return [
    { label: 'Swiped away (estimate)', value: pct(t.estSwipeAway), level: levelOf('swipeAway', t.estSwipeAway), hint: swipeHint(t) },
    { label: 'Watched on average', level: levelOf('avgViewPct', t.avgViewPct || null), ...watchedTile(t) },
    { label: 'Watched to the end', value: endPct(t.completion?.ofViews), level: null, hint: t.completion ? 'of views, as in YouTube Studio' : 'No retention curve yet' },
    { label: 'Half the viewers gone by', value: t.halfGoneAtSec === null ? '—' : clock(t.halfGoneAtSec), level: null, hint: leaveHint(t) },
    {
      label: 'Retention vs similar Shorts',
      value: t.relativeRetention === null ? '—' : t.relativeRetention.toFixed(2),
      level: levelOf('relativeRetention', t.relativeRetention),
      hint: '0.5 is typical',
    },
  ];
}



export function ShortDetail({ video, t }: { video: VideoFinding; t: ShortTimeline }) {
  return (
    <div className="space-y-4 border-t border-bg-border bg-bg-base px-5 py-5">
      {t.rounds && <RoundsBox rounds={t.rounds} />}
      {t.test && <TestBox test={t.test} />}
      {t.gates && <GateStrip gates={t.gates} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {detailTiles(t).map((tile) => (
          <LevelTile key={tile.label} {...tile} big={false} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyChart daily={t.daily} firstShare={t.firstDaysShare} color={CAUSE[video.cause].color} dayRound={t.rounds ? roundDates(t.rounds) : undefined} />
        <RetentionChart t={t} />
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
