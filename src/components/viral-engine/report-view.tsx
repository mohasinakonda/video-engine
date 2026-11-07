'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Film, Lightbulb, Play, RefreshCw } from 'lucide-react';
import { RULES } from '@/lib/viral-engine/rules-config';
import { formatRange, formatTime } from '@/lib/viral-engine/signals';
import { SHORT_FORMATS, type Level, type ShortFormat, type TimelineIssue, type ViralResult } from '@/lib/viral-engine/types';
import { EVIDENCE_LABEL, LEVEL_STYLE } from './levels';
import { Timeline } from './timeline';
import type { LocalMedia } from './use-viral-engine';

interface Props {
  result: ViralResult;
  media: LocalMedia | null;
  restoring: number | null;
  onRestore: (file: File) => void;
  onFormat: (format: ShortFormat) => void;
  onNew: () => void;
}

export function ViralReportView({ result, media, restoring, onRestore, onFormat, onNew }: Props) {
  const { report, wording, input } = result;
  const [selectedId, setSelectedId] = useState<string | null>(report.biggestFixId ?? report.issues[0]?.id ?? null);
  const [time, setTime] = useState(0);
  const [showUI, setShowUI] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);

  // A format change re-runs the rules and renumbers the findings.
  useEffect(() => {
    setSelectedId(report.biggestFixId ?? report.issues[0]?.id ?? null);
  }, [report]);

  const issues = useMemo(() => report.issues.filter((i) => !dismissed.has(i.id)), [report.issues, dismissed]);
  const selected = issues.find((i) => i.id === selectedId) ?? null;
  const biggest = issues.find((i) => i.id === report.biggestFixId);
  const now = issues
    .filter((i) => !i.wholeVideo && time >= i.startSec && time < i.endSec)
    .sort((a, b) => ({ bad: 0, warn: 1, good: 2 })[a.level] - ({ bad: 0, warn: 1, good: 2 })[b.level])[0];

  const seek = (t: number) => {
    stopAt.current = null;
    setTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };
  const select = (issue: TimelineIssue) => {
    setSelectedId(issue.id);
    if (!issue.wholeVideo) seek(issue.startSec);
  };
  const playPart = (issue: TimelineIssue) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = issue.startSec;
    stopAt.current = issue.endSec;
    v.play().catch(() => undefined);
  };

  const channel = input.channel;
  const channelLabel = !channel
    ? 'Not compared with a channel'
    : channel.retention
      ? channel.usual
        ? `Retention + your usual Short (${channel.baselineCount})`
        : 'Retention included'
      : `Compared with ${channel.profile?.channelTitle ?? 'your channel'}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Viral Engine report</p>
          <h2 className="text-xl font-bold text-white break-all">{channel?.title || input.metadata.title || result.file.name}</h2>
          <p className="text-sm text-zinc-400">
            {formatTime(report.durationSec)} · {channelLabel} · Analyzed {new Date(result.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="viral-format" className="label">
              Type of Short {report.formatSource === 'vision' ? '(detected)' : report.formatSource === 'user' ? '(set by you)' : ''}
            </label>
            <select id="viral-format" className="input" value={report.format} onChange={(e) => onFormat(e.target.value as ShortFormat)}>
              {SHORT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={onNew} className="btn-secondary">
            <RefreshCw size={16} />
            Check another Short
          </button>
        </div>
      </section>

      {/* Summary */}
      <section className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          <CountTile level="bad" count={report.counts.bad} label="to fix" />
          <CountTile level="warn" count={report.counts.warn} label="to check" />
          <CountTile level="good" count={report.counts.good} label="working" />
        </div>
        <div className="card min-w-0 flex-[999_1_360px] space-y-1 !py-3">
          <p className="text-base font-semibold text-white">{wording.headline}</p>
          <p className="text-sm text-zinc-300">{wording.summary}</p>
          {biggest && biggest.level !== 'good' && (
            <button type="button" onClick={() => select(biggest)} className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
              Show the biggest fix ({whenLabel(biggest, report.durationSec).toLowerCase()})
            </button>
          )}
        </div>
      </section>

      {/* Player + detail */}
      <section className="flex flex-wrap items-start gap-5">
        <div className="w-[252px] flex-none space-y-2">
          <div className="relative aspect-[9/16] w-[252px] overflow-hidden rounded-2xl border border-bg-border bg-black">
            {media ? (
              <video
                ref={videoRef}
                src={media.videoUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setTime(t);
                  if (stopAt.current !== null && t >= stopAt.current) {
                    e.currentTarget.pause();
                    stopAt.current = null;
                  }
                }}
              />
            ) : (
              <RestorePrompt fileName={result.file.name} restoring={restoring} onRestore={onRestore} />
            )}
            {media && showUI && (
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute bottom-24 right-2 flex flex-col items-center gap-3.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="h-7 w-7 rounded-full border-2 border-dashed border-white/70" />
                  ))}
                </div>
                <div className="absolute bottom-10 left-0 right-12 h-20 border-t-2 border-dashed border-white/70 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.1)_0_6px,transparent_6px_12px)] p-2 text-[11px] text-white/85">
                  Shorts UI covers this area
                </div>
              </div>
            )}
            {media && now && (
              <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-center gap-1.5 rounded-lg border bg-black/80 px-2 py-1.5 text-xs text-white" style={{ borderColor: LEVEL_STYLE[now.level].dot }}>
                <span className="h-2 w-2 flex-none rounded-sm" style={{ background: LEVEL_STYLE[now.level].dot }} />
                <span className="truncate">
                  {LEVEL_STYLE[now.level].label} · {now.title}
                </span>
              </div>
            )}
          </div>
          {media && (
            <button type="button" onClick={() => setShowUI((v) => !v)} className="btn-secondary btn-sm w-full">
              {showUI ? 'Hide Shorts UI' : 'Show Shorts UI'}
            </button>
          )}
        </div>

        <div className="card min-w-0 flex-[999_1_360px] space-y-4">
          {selected ? (
            <IssueDetail issue={selected} durationSec={report.durationSec} canPlay={Boolean(media) && !selected.wholeVideo} onPlay={() => playPart(selected)} onDismiss={() => setDismissed((s) => new Set(s).add(selected.id))} />
          ) : (
            <p className="text-sm text-zinc-300">No findings for this Short.</p>
          )}
        </div>
      </section>

      <Timeline report={{ ...report, issues }} input={input} thumbs={media?.thumbs ?? null} time={time} selectedId={selectedId} onSeek={seek} onSelect={select} />

      {/* Findings list */}
      <section className="card !p-0 overflow-hidden">
        <h2 className="border-b border-bg-border px-4 py-3 text-base font-semibold text-white">All findings, in order</h2>
        <ul>
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => select(issue)}
                className={`flex w-full flex-wrap items-start gap-3 border-b border-bg-border px-4 py-3 text-left hover:bg-bg-elevated ${selectedId === issue.id ? 'bg-bg-elevated' : ''}`}
              >
                <span className="w-1 self-stretch rounded" style={LEVEL_STYLE[issue.level].block} />
                <span className="w-28 flex-none pt-0.5 font-mono text-sm text-zinc-400">{whenLabel(issue, report.durationSec)}</span>
                <span className={`w-20 flex-none pt-0.5 text-xs font-semibold ${LEVEL_STYLE[issue.level].text}`}>{LEVEL_STYLE[issue.level].label}</span>
                <span className="min-w-0 flex-[999_1_280px] space-y-0.5">
                  <span className="block font-semibold text-white">{issue.title}</span>
                  <span className="block text-sm text-zinc-400">{issue.saw}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {dismissed.size > 0 && (
          <button type="button" onClick={() => setDismissed(new Set())} className="px-4 py-3 text-sm text-zinc-400 hover:text-white">
            Show {dismissed.size} finding{dismissed.size > 1 ? 's' : ''} you marked as intentional
          </button>
        )}
      </section>

      {channel?.profile && <ChannelCard profile={channel.profile} durationSec={report.durationSec} />}

      {/* Title, hashtags, suggestions */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="text-base font-semibold text-white">Title &amp; hashtags</h2>
          <p className="text-sm text-zinc-400">In the Shorts feed people rarely read the title; the first seconds matter far more. The title still helps YouTube understand the topic, and helps search.</p>
          {report.metadataChecks.length === 0 ? (
            <p className="text-sm text-zinc-300">Add a title when you run the check to get title and hashtag tips.</p>
          ) : (
            <ul className="space-y-2">
              {report.metadataChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm text-zinc-200">
                  <LevelIcon level={c.level} />
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Lightbulb size={18} className="text-amber-300" />
            AI suggestions
          </h2>
          {wording.hooks.length + wording.titles.length + wording.hashtags.length === 0 ? (
            <p className="text-sm text-zinc-400">No suggestions this time.</p>
          ) : (
            <>
              <Suggestions label="Opening lines" items={wording.hooks} />
              <Suggestions label="Titles" items={wording.titles} />
              {wording.hashtags.length > 0 && <p className="text-sm text-zinc-200">{wording.hashtags.join(' ')}</p>}
            </>
          )}
          <p className="text-xs text-zinc-500">Written by AI from your transcript. Use them as ideas, not facts.</p>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-semibold text-white">What this report can’t see</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
          {report.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ChannelCard({ profile, durationSec }: { profile: NonNullable<NonNullable<ViralResult['input']['channel']>['profile']>; durationSec: number }) {
  const fit = profile.fit;
  const gap = fit ? fit.typical - fit.score : null;
  const verdict =
    gap === null
      ? null
      : gap >= RULES.farOffTopicMargin
        ? { level: 'bad' as const, text: 'Far from your channel’s usual topics' }
        : gap >= RULES.offTopicMargin
          ? { level: 'warn' as const, text: 'Different from your channel’s usual topics' }
          : gap <= RULES.onTopicMargin
            ? { level: 'good' as const, text: 'Fits your channel’s topics' }
            : { level: 'warn' as const, text: 'Somewhat close to your channel’s topics' };
  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold text-white">Compared with {profile.channelTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Recent uploads compared" value={`${profile.videoCount} (${profile.shortsCount} Shorts)`} />
        <Stat label="Median views of your recent Shorts" value={profile.medianShortViews !== null ? Math.round(profile.medianShortViews).toLocaleString('en-US') : '—'} />
        <Stat
          label="Length: this Short vs your better Shorts"
          value={profile.topShortDurationSec ? `${Math.round(durationSec)}s vs ${Math.round(profile.topShortDurationSec)}s` : `${Math.round(durationSec)}s`}
        />
      </div>
      {fit ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-300">
            This Short is about <span className="font-semibold text-white">“{fit.topic}”</span>.
          </p>
          {verdict && (
            <p className={`flex items-center gap-2 text-sm font-semibold ${LEVEL_STYLE[verdict.level].text}`}>
              <LevelIcon level={verdict.level} />
              {verdict.text}
            </p>
          )}
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Closest videos on your channel</p>
          <ul className="space-y-1.5">
            {fit.closest.map((c) => (
              <li key={c.title} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="min-w-0 flex-[999_1_240px] text-zinc-200">{c.title}</span>
                <span className="text-zinc-400">{c.views !== null ? `${c.views.toLocaleString('en-US')} views` : ''}</span>
                <span className="font-mono text-xs text-zinc-500">{Math.round(c.similarity * 100)}% alike</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Topic match is an AI estimate from titles and the transcript. Your own videos are usually {Math.round(fit.typical * 100)}% alike to each other; this Short is {Math.round(fit.score * 100)}% alike to its closest ones.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">We couldn’t compare this Short’s topic with your channel this time (see the limits below).</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function IssueDetail({
  issue,
  durationSec,
  canPlay,
  onPlay,
  onDismiss,
}: {
  issue: TimelineIssue;
  durationSec: number;
  canPlay: boolean;
  onPlay: () => void;
  onDismiss: () => void;
}) {
  const style = LEVEL_STYLE[issue.level];
  const sources = Array.from(new Map(issue.evidence.map((e) => [e.source, e])).values());
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
          <LevelIcon level={issue.level} />
          {style.label}
        </span>
        <span className="font-mono text-sm text-zinc-400">{whenLabel(issue, durationSec)}</span>
      </div>
      <h3 className="text-xl font-bold text-white">{issue.title}</h3>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">What we saw</p>
        <p className="text-sm text-zinc-200">{issue.saw}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{issue.level === 'good' ? 'Why it works' : 'What to do'}</p>
        <p className="text-sm text-zinc-200">{issue.fix}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Based on</p>
        <div className="flex flex-wrap gap-1.5">
          {sources.map((e) => (
            <span key={e.source} className="inline-flex items-center gap-1.5 rounded-md border border-bg-border px-2 py-1 text-xs text-zinc-200">
              {EVIDENCE_LABEL[e.source]}
              <span className={e.measured ? 'text-emerald-300' : 'text-amber-300'}>{e.measured ? 'measured' : 'estimated'}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {canPlay && (
          <button type="button" onClick={onPlay} className="btn-primary">
            <Play size={16} />
            Play this part
          </button>
        )}
        {issue.level !== 'good' && (
          <button type="button" onClick={onDismiss} className="btn-secondary">
            It’s intentional
          </button>
        )}
      </div>
    </>
  );
}

function RestorePrompt({ fileName, restoring, onRestore }: { fileName: string; restoring: number | null; onRestore: (file: File) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <Film size={22} className="text-zinc-400" />
      {restoring !== null ? (
        <p className="text-sm text-zinc-300">Loading frames… {Math.round(restoring * 100)}%</p>
      ) : (
        <>
          <p className="text-sm text-zinc-300">Select the same file again to see the video. It stays on your computer and costs nothing.</p>
          <label className="btn-secondary btn-sm cursor-pointer">
            Select {fileName.length > 24 ? `${fileName.slice(0, 22)}…` : fileName}
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onRestore(e.target.files[0])} />
          </label>
        </>
      )}
    </div>
  );
}

/** "Whole video", "Most of the video (0:00–0:51)" or the range. */
function whenLabel(issue: TimelineIssue, durationSec: number): string {
  if (!issue.wholeVideo) return formatRange(issue.startSec, issue.endSec);
  return issue.startSec <= 0.5 && issue.endSec >= durationSec - 0.5 ? 'Whole video' : `Most of the video (${formatRange(issue.startSec, issue.endSec)})`;
}

function CountTile({ level, count, label }: { level: Level; count: number; label: string }) {
  return (
    <div className="flex min-w-[120px] items-center gap-3 rounded-xl border border-bg-border bg-bg-surface px-4 py-3">
      <span className="h-3 w-3 rounded-sm" style={LEVEL_STYLE[level].block} />
      <div>
        <div className="text-2xl font-bold leading-none text-white">{count}</div>
        <div className="text-xs text-zinc-400">{label}</div>
      </div>
    </div>
  );
}

function LevelIcon({ level }: { level: Level }) {
  if (level === 'bad') return <AlertTriangle size={14} className="mt-0.5 flex-none text-rose-300" aria-hidden="true" />;
  if (level === 'warn') return <CircleAlert size={14} className="mt-0.5 flex-none text-amber-300" aria-hidden="true" />;
  return <CheckCircle2 size={14} className="mt-0.5 flex-none text-emerald-300" aria-hidden="true" />;
}

function Suggestions({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
