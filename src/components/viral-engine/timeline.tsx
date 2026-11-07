'use client';

import { useMemo } from 'react';
import { RULES } from '@/lib/viral-engine/rules-config';
import { findRuns, formatTime, sampleAt } from '@/lib/viral-engine/signals';
import type { EngineInput, TimelineIssue, ViralReport } from '@/lib/viral-engine/types';
import type { Thumb } from '@/lib/viral-engine/extract';
import { LEVEL_STYLE } from './levels';

interface Props {
  report: ViralReport;
  input: EngineInput;
  thumbs: Thumb[] | null;
  time: number;
  selectedId: string | null;
  onSeek: (t: number) => void;
  onSelect: (issue: TimelineIssue) => void;
}

const pct = (t: number, dur: number) => `${Math.max(0, Math.min(100, (t / dur) * 100))}%`;

/** Frames, health, retention, speech, sound and cuts on one time axis. Every block is a real button. */
export function Timeline({ report, input, thumbs, time, selectedId, onSeek, onSelect }: Props) {
  const dur = report.durationSec;
  const { signals, channel } = input;

  const sound = useMemo(
    () => findRuns(dur, signals.loudnessStep, (t) => (sampleAt(signals.loudness, signals.loudnessStep, t) ?? -90) > RULES.silenceDb, 0.2),
    [dur, signals]
  );

  // One lane per level, so overlapping findings never hide each other.
  const lanes = (['bad', 'warn', 'good'] as const).map((level) => ({ level, issues: report.issues.filter((i) => !i.wholeVideo && i.level === level) }));

  const tickStep = dur > 120 ? 30 : dur > 60 ? 10 : 5;
  const ticks = Array.from({ length: Math.floor(dur / tickStep) + 1 }, (_, i) => i * tickStep);

  const retention = channel?.retention ?? null;
  // "Your usual Short" only means something next to this Short's own curve.
  const usual = retention ? (channel?.usual ?? null) : null;
  const top = Math.max(100, ...(retention ?? []).map((p) => p.pct), ...(usual ?? []).map((p) => p.pct));
  const line = (points: { sec: number; pct: number }[]) => points.map((p) => `${(p.sec / dur) * 1000},${100 - (p.pct / top) * 100}`).join(' ');

  const rows: { label: string; height: string }[] = [
    ...(thumbs ? [{ label: 'Frames', height: 'h-11' }] : []),
    { label: 'Health', height: 'h-[52px]' },
    ...(retention || usual ? [{ label: 'Retention', height: 'h-20' }] : []),
    { label: 'Speech', height: 'h-6' },
    { label: 'Sound', height: 'h-6' },
    { label: 'Cuts', height: 'h-6' },
  ];

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Timeline</h2>
        <Legend hasRetention={Boolean(retention)} hasUsual={Boolean(usual)} />
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[76px_minmax(0,1fr)] gap-x-3">
          <div className="flex flex-col text-xs text-zinc-400">
            {rows.map((r) => (
              <div key={r.label} className={`${r.height} flex items-center`}>
                {r.label}
              </div>
            ))}
            <div className="h-5" />
          </div>

          <div className="relative flex flex-col">
            {thumbs && (
              <div className="flex h-11 items-center gap-px">
                {thumbs.map((th, i) => (
                  <button
                    key={th.t}
                    type="button"
                    onClick={() => onSeek(th.t)}
                    aria-label={`Go to ${formatTime(th.t)}`}
                    className="h-9 min-w-0 flex-1 overflow-hidden rounded-sm bg-bg-elevated hover:brightness-125"
                    style={{ backgroundImage: `url(${th.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    data-index={i}
                  />
                ))}
              </div>
            )}

            <div className="flex h-[52px] flex-col justify-center gap-1">
              {lanes.map((lane) => (
                <div key={lane.level} className="relative h-3.5 rounded-sm bg-bg-elevated">
                  {lane.issues.map((issue) => (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => onSelect(issue)}
                      aria-label={`${LEVEL_STYLE[issue.level].label}, ${formatTime(issue.startSec)}: ${issue.title}`}
                      className="absolute inset-y-0 rounded-sm hover:brightness-110"
                      style={{
                        ...LEVEL_STYLE[issue.level].block,
                        left: pct(issue.startSec, dur),
                        width: `max(6px, ${pct(issue.endSec - issue.startSec, dur)})`,
                        outline: selectedId === issue.id ? '2px solid white' : 'none',
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {(retention || usual) && (
              <div className="relative h-20">
                <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-x-0 top-1 h-[72px] w-full overflow-visible" role="img" aria-label="Audience retention by second">
                  {retention && <polygon points={`${line(retention)} ${(retention[retention.length - 1].sec / dur) * 1000},100 0,100`} fill="rgba(52,211,153,0.12)" />}
                  {usual && <polyline points={line(usual.filter((p) => p.sec <= dur))} fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
                  {retention && <polyline points={line(retention)} fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                </svg>
                <span className="absolute right-1 top-0 text-[10px] text-zinc-400">{Math.round(top)}%</span>
              </div>
            )}

            <div className="relative h-6">
              {signals.speech.map((r) => (
                <div key={r.start} className="absolute top-2 h-2 rounded-full bg-sky-400" style={{ left: pct(r.start, dur), width: pct(r.end - r.start, dur) }} title={r.text} />
              ))}
            </div>

            <div className="relative h-6">
              <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-zinc-700" />
              {sound.map((r) => (
                <div key={r.start} className="absolute top-2 h-2 rounded-full bg-violet-400" style={{ left: pct(r.start, dur), width: pct(r.end - r.start, dur) }} />
              ))}
            </div>

            <div className="relative h-6">
              {signals.cuts.map((c) => (
                <div key={c} className="absolute top-1.5 h-3.5 w-0.5 rounded bg-zinc-400" style={{ left: pct(c, dur) }} />
              ))}
            </div>

            <div className="relative h-5 font-mono text-[11px] text-zinc-400">
              {ticks.map((t) => (
                <span key={t} className="absolute top-0.5" style={{ left: pct(t, dur), transform: t === 0 ? 'none' : 'translateX(-50%)' }}>
                  {formatTime(t)}
                </span>
              ))}
            </div>

            <div className="pointer-events-none absolute bottom-5 top-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" style={{ left: pct(time, dur) }} />
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        Health shows problems (top), things to check (middle) and what works (bottom). Findings that cover the whole video, or most of it, are in the list below. Click a frame or a block to jump there.
      </p>
    </section>
  );
}

function Legend({ hasRetention, hasUsual }: { hasRetention: boolean; hasUsual: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
      {(['bad', 'warn', 'good'] as const).map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm" style={LEVEL_STYLE[l].block} />
          {LEVEL_STYLE[l].label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-3.5 rounded-full bg-sky-400" />
        Talking
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-3.5 rounded-full bg-violet-400" />
        Sound
      </span>
      {hasRetention && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 bg-emerald-400" />
          Your viewers
        </span>
      )}
      {hasUsual && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-3.5 border-t-2 border-dashed border-zinc-500" />
          Your usual Short
        </span>
      )}
    </div>
  );
}
