'use client';

/**
 * Next video ideas: from the views check to a batch of new Shorts for Google Flow, each a
 * storyboard of simple shots with its reference images, sound plan and packaging. The latest batch
 * stays in this browser (localStorage) so the creator can come back to it; a new batch replaces it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronDown, ClipboardCopy, Clapperboard, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { clearNextShorts, loadNextShorts, nextShortsKey, reportKey, saveNextShorts } from '@/lib/channel-doctor-storage';
import { audioPlanText, flowBatch, imagesPrompt, postProduction, setupSteps, shotsPrompt } from '@/lib/youtube/next-shorts/flow-text';
import { FLOW_MODES, MODELS, type FlowMode } from '@/lib/youtube/next-shorts/models';
import { DEFAULT_PACE, PACE_IDS, PACES, SPEEDS, type Pace } from '@/lib/youtube/next-shorts/pacing';
import type { PackagingRequest, ShortPackaging } from '@/lib/youtube/next-shorts/packaging';
import { BATCH_SIZES, type NextShort, type NextShortsPack, type NextShortsRequest, type RewriteRequest } from '@/lib/youtube/next-shorts/types';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import { useCreateConfig } from '@/components/create/use-create-config';
import { useAnalysisStream } from '../use-diagnosis';

type Stage = 'connect' | 'ideas' | 'scripts' | 'done';
const MODE_HINT: Record<FlowMode, string> = {
  omni: 'clips of 3–15s · fewest trims · 11s+ needs a Google AI plan',
  veo_lite: '4, 6 or 8s clips · start and end frames',
};

const STAGES: { id: Stage; label: string }[] = [
  { id: 'ideas', label: 'Reading what works on your channel' },
  { id: 'scripts', label: 'Planning each Short, shot by shot' },
];

/** The slice of the views check the writer needs (the browser holds the report, never our servers). */
function requestFrom(result: ViewsCheckResult, count: number, mode: FlowMode, pace: Pace, notes: string): NextShortsRequest {
  return {
    count: count as NextShortsRequest['count'],
    mode,
    pace,
    channelTitle: result.channel.title.slice(0, 120),
    notes: notes.trim() || undefined,
    shorts: result.report.shorts.slice(0, 50).map((s) => ({
      videoId: s.videoId,
      title: s.title,
      views: s.views,
      durationSec: s.durationSec,
      estSwipeAway: s.estSwipeAway,
      avgViewPct: s.avgViewPct,
      biggestDrop: s.biggestDrop,
      exitWindow: s.exitWindow,
      topic: s.topic ?? null,
    })),
  };
}

/**
 * @param result the views check in this tab, or null (then the saved ideas still show, but new
 *   ones need a views check first).
 */
export function NextShorts({ result, userId, channelId }: { result: ViewsCheckResult | null; userId: string; channelId: string }) {
  const [count, setCount] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<FlowMode>('omni');
  const [pace, setPace] = useState<Pace>(DEFAULT_PACE);
  const { config } = useCreateConfig();
  const storeKey = nextShortsKey(userId, channelId);
  const [pack, setPack] = useState<NextShortsPack | null>(null);

  useEffect(() => {
    const saved = loadNextShorts<NextShortsPack>(storeKey);
    // Batches made before the shot-based storyboard (versions 1–2) are not shown.
    setPack(saved?.version === 3 ? saved : null);
  }, [storeKey]);

  const keep = useCallback(
    (next: NextShortsPack) => {
      setPack(next);
      saveNextShorts(storeKey, next);
    },
    [storeKey],
  );

  const usable = result && result.channel.id === channelId ? result : null;
  const stream = useAnalysisStream<NextShortsPack, Stage>(
    '/api/youtube/next-shorts',
    usable ? reportKey(userId, channelId, 'next-shorts') : null,
    usable ? requestFrom(usable, count, mode, pace, notes) : {},
  );

  // A newer batch replaces the saved one (but not one the creator just cleared).
  const cleared = useRef<string | null>(null);
  useEffect(() => {
    const made = stream.saved?.result;
    if (made?.version === 3 && (!pack || made.generatedAt > pack.generatedAt) && (!cleared.current || made.generatedAt > cleared.current)) keep(made);
  }, [stream.saved, pack, keep]);

  const clear = useCallback(() => {
    if (!pack || !window.confirm('Delete these ideas? You can make new ones any time.')) return;
    cleared.current = pack.generatedAt;
    clearNextShorts(storeKey, reportKey(userId, channelId, 'next-shorts'));
    setPack(null);
  }, [pack, storeKey, userId, channelId]);

  const onRewritten = useCallback(
    (next: NextShort) => {
      if (!pack) return;
      keep({ ...pack, shorts: pack.shorts.map((s) => (s.id === next.id ? next : s)) });
    },
    [pack, keep],
  );

  const onPackaged = useCallback(
    (shortId: string, packaging: ShortPackaging, at: string) => {
      if (!pack) return;
      keep({ ...pack, shorts: pack.shorts.map((s) => (s.id === shortId ? { ...s, packagingOptions: packaging, packagingAt: at } : s)) });
    },
    [pack, keep],
  );

  const enough = (usable?.report.shorts.length ?? 0) >= 3;
  const cost = config ? config.costs.script * count : null;

  return (
    <div className="space-y-5">
      <section className="space-y-5 rounded-2xl border border-violet-500/30 bg-bg-surface p-6">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
            <Clapperboard size={14} aria-hidden="true" /> Next video ideas
          </p>
          <h1 className="text-2xl font-bold text-white">Make Shorts from what already works on your channel</h1>
          <p className="text-sm text-zinc-400">
            We read which of your Shorts stop the swipe and where viewers leave, then plan new ones as a storyboard of simple shots for Google Flow: the reference images that keep
            them consistent, one prompt per shot, the sound and the packaging. Every Short is 15–30 seconds.
          </p>
        </div>

        {config && !config.hasAccess ? (
          <p className="text-sm text-zinc-400">Next video ideas is part of the Creator and Studio plans.</p>
        ) : !usable ? (
          <p className="text-sm text-zinc-400">
            To make new ideas, run the views check first in{' '}
            <Link href="/youtube-doctor?tab=views" className="underline hover:text-white">
              Performance
            </Link>
            . {pack ? 'Your last ideas are below.' : ''}
          </p>
        ) : !enough ? (
          <p className="text-sm text-zinc-400">You need at least 3 Shorts in the views check. Post a few more, then check again.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-300">How many Shorts?</span>
              {BATCH_SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${count === n ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-bg-border text-zinc-400 hover:text-zinc-200'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-300">Flow model</span>
              {FLOW_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  title={MODE_HINT[m]}
                  className={`rounded-lg border px-3 py-1.5 text-left text-sm ${mode === m ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-bg-border text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold">{MODELS[m].label}</span>
                  <span className="block text-[11px] opacity-80">{MODE_HINT[m]}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-300">Pace</span>
              {PACE_IDS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPace(p)}
                  aria-pressed={pace === p}
                  className={`rounded-lg border px-3 py-1.5 text-left text-sm ${pace === p ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-bg-border text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="font-semibold">{PACES[p].label}</span>
                  <span className="block text-[11px] opacity-80">{PACES[p].hint}</span>
                </button>
              ))}
            </div>
            <input
              className="input w-full"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: anything to include (a product, a series, a style)"
              aria-label="Anything to include"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={stream.run} disabled={stream.running}>
                {stream.running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                {pack ? `Make ${count} new ideas` : `Make my next ${count} Shorts`}
              </button>
              {cost !== null && <span className="text-xs text-zinc-500">{cost} credits</span>}
              {pack && !stream.running && <span className="text-xs text-zinc-500">New ideas replace the ones below.</span>}
            </div>
            {stream.running && (
              <ul className="space-y-1 text-sm">
                {STAGES.map((s) => (
                  <li key={s.id} className={stream.stages.includes(s.id) ? 'text-zinc-200' : 'text-zinc-600'}>
                    {stream.stages.includes(s.id) ? '• ' : '○ '}
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
            {stream.error && (
              <p className="text-sm text-rose-300">
                {stream.error.message}
                {stream.error.refunded ? ' Your credits were returned.' : ''}
              </p>
            )}
          </div>
        )}
      </section>

      {pack && (
        <Pack
          pack={pack}
          onClear={clear}
          onPackaged={onPackaged}
          onRewritten={onRewritten}
          rewriteKey={(id) => reportKey(userId, channelId, `next-shorts-rewrite:${pack.generatedAt}:${id}`)}
          rewriteCost={config?.costs.script ?? null}
          packagingKey={(short) => reportKey(userId, channelId, `next-shorts-packaging:${pack.generatedAt}:${short.id}:${short.rewrittenAt ?? ''}`)}
          packagingCost={config?.costs.packaging ?? null}
        />
      )}
    </div>
  );
}

interface PackProps {
  pack: NextShortsPack;
  onClear: () => void;
  onRewritten: (short: NextShort) => void;
  rewriteKey: (shortId: string) => string;
  rewriteCost: number | null;
  onPackaged: (shortId: string, packaging: ShortPackaging, at: string) => void;
  /** Per Short and per version, so a rewritten Short starts without the old packaging. */
  packagingKey: (short: NextShort) => string;
  packagingCost: number | null;
}

function Pack({ pack, onClear, ...rest }: PackProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-bg-border bg-bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          Made {new Date(pack.generatedAt).toLocaleString()} · {pack.shorts.length} Shorts · {MODELS[pack.mode].label} · {PACES[pack.pace ?? DEFAULT_PACE].label} pace
        </p>
        <button type="button" className="btn-ghost btn-sm" onClick={onClear}>
          <Trash2 size={14} aria-hidden="true" /> Clear ideas
        </button>
      </div>
      {pack.insights.lines.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">What your numbers say</h2>
          <ul className="space-y-1">
            {pack.insights.lines.map((l) => (
              <li key={l} className="text-sm text-zinc-300">
                • {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-bg-border bg-bg-base p-4">
        <h3 className="text-sm font-semibold text-white">Step 1: set up Flow ({MODELS[pack.mode].label})</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
          {setupSteps(pack.mode).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-base p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Step 2: paste into Agent Instructions</h3>
            <p className="text-xs text-zinc-500">Set once per project. The Agent keeps these rules for every Short.</p>
          </div>
          <Copy text={pack.flowInstruction} label="Copy rules" />
        </div>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-surface p-3 text-xs leading-relaxed text-zinc-400">{pack.flowInstruction}</pre>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Step 3: send the Shorts to the Agent</h3>
          <p className="text-xs text-zinc-500">One at a time, or all at once. The Agent generates right away; redo any shot that comes out wrong.</p>
        </div>
        <Copy text={flowBatch(pack.shorts, pack.mode)} label={`Copy all ${pack.shorts.length} Shorts`} />
      </div>
      <div className="space-y-3">
        {pack.shorts.map((s, i) => (
          <ShortCard key={s.id} short={s} index={i} pack={pack} onClear={onClear} {...rest} />
        ))}
      </div>
    </section>
  );
}

function ShortCard({ short, index, pack, onPackaged, packagingKey, packagingCost, onRewritten, rewriteKey, rewriteCost }: { short: NextShort; index: number } & PackProps) {
  const [open, setOpen] = useState(index === 0);
  const mode = pack.mode;
  const sb = short.storyboard;
  const blocking = short.issues.filter((i) => i.level === 'block');
  return (
    <div className="rounded-xl border border-bg-border bg-bg-base">
      <button type="button" className="flex w-full items-start justify-between gap-3 p-4 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">
            Short {index + 1} · {short.seconds}s · {sb.shots.length} shots · {short.voiceWords} spoken words · prompt readiness <Readiness value={short.readiness} />
          </p>
          <p className="font-semibold text-white">{sb.packaging.title}</p>
          <p className="text-sm text-zinc-400">{short.why}</p>
        </div>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-5 border-t border-bg-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {short.basedOnTitle ? <p className="text-xs text-zinc-500">Builds on: “{short.basedOnTitle}”</p> : <span />}
            <RewriteShort short={short} pack={pack} storeKey={rewriteKey(short.id)} cost={rewriteCost} onDone={onRewritten} />
          </div>
          {blocking.length > 0 && <IssueBox title="Fix before you generate:" items={blocking.map((i) => (i.shot ? `Shot ${i.shot}: ${i.message}` : i.message))} tone="rose" />}

          <p className="text-sm font-semibold text-zinc-200">Storyboard</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 pr-2 font-medium">Shot</th>
                  <th className="py-1 pr-2 font-medium">Time</th>
                  <th className="py-1 pr-2 font-medium">What changes</th>
                  <th className="py-1 pr-2 font-medium">Camera</th>
                  <th className="py-1 pr-2 font-medium">Speed</th>
                  <th className="py-1 pr-2 font-medium">Images</th>
                  <th className="py-1 pr-2 font-medium">Hard to make</th>
                  <th className="py-1 font-medium">Ready</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {sb.shots.map((shot, i) => {
                  const r = short.shots[i];
                  return (
                    <tr key={i} className="border-t border-bg-border align-top">
                      <td className="py-2 pr-2 font-semibold text-white">
                        {i + 1}. {shot.title}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        0:{String(r.startsAt).padStart(2, '0')} · {shot.seconds}s
                      </td>
                      <td className="py-2 pr-2">{shot.action}</td>
                      <td className="py-2 pr-2">{shot.camera.movement === 'none' ? 'static' : shot.camera.movement.replace('_', ' ')}</td>
                      <td className="py-2 pr-2">{SPEEDS[shot.speed ?? 'real_time'].label}</td>
                      <td className="py-2 pr-2">{[shot.startFrame && `start ${shot.startFrame}`, ...shot.references.map((x) => x.asset)].filter(Boolean).join(', ') || '—'}</td>
                      <td className="py-2 pr-2" title={r.complexityReasons.join('; ')}>
                        {r.complexity}
                      </td>
                      <td className="py-2" title={r.readinessReasons.join('\n')}>
                        <Readiness value={r.readiness} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sb.assets.length > 0 && (
            <PromptBlock
              title="Step A: reference images"
              hint="Paste once. The main image comes first; the others are edits of it, so it stays the same object."
              text={imagesPrompt(sb)}
            />
          )}
          <PromptBlock title="Step B: the shots" hint="Paste once, after the images. Each shot is its own video; join them in this order." text={shotsPrompt(sb, mode)} />

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-200">Sound (add in editing)</p>
              <Copy text={audioPlanText(sb)} label="Copy" />
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-bg-surface p-3 text-xs leading-relaxed text-zinc-300">{audioPlanText(sb)}</pre>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-200">Editing</p>
            <ul className="mt-1 space-y-1 text-xs text-zinc-400">
              {postProduction(sb, mode, pack.pace ?? DEFAULT_PACE).map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
          </div>

          <PackagingSection
            short={short}
            channelTitle={pack.channelTitle}
            audience={pack.style.audience}
            storeKey={packagingKey(short)}
            cost={packagingCost}
            onDone={(p, at) => onPackaged(short.id, p, at)}
          />

          {short.fixes.length > 0 && <IssueBox title="Fixed for you:" items={short.fixes} tone="zinc" />}
          {short.issues.some((i) => i.level === 'warn') && (
            <IssueBox title="Worth a look:" items={short.issues.filter((i) => i.level === 'warn').map((i) => (i.shot ? `Shot ${i.shot}: ${i.message}` : i.message))} tone="amber" />
          )}
        </div>
      )}
    </div>
  );
}

function rewriteRequest(short: NextShort, pack: NextShortsPack, feedback: string): RewriteRequest {
  return {
    channelTitle: pack.channelTitle,
    mode: pack.mode,
    pace: pack.pace ?? DEFAULT_PACE,
    style: pack.style,
    facts: pack.insights.lines.slice(0, 12),
    dropWall: pack.insights.dropWall?.atSec ?? null,
    short: {
      id: short.id,
      name: short.name,
      basedOn: short.basedOn,
      basedOnTitle: short.basedOnTitle,
      why: short.why,
      previousShots: short.storyboard.shots.slice(0, 12).map((x) => `${x.title}: ${x.action}`.slice(0, 300)),
    },
    feedback: feedback.trim() || undefined,
  };
}

/** Don't like a Short? A new storyboard for the same idea, with the creator's note. It replaces this one. */
function RewriteShort(props: { short: NextShort; pack: NextShortsPack; storeKey: string; cost: number | null; onDone: (s: NextShort) => void }) {
  const { short, onDone } = props;
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const stream = useAnalysisStream<NextShort, 'connect' | 'scripts' | 'done'>('/api/youtube/next-shorts/rewrite', props.storeKey, rewriteRequest(short, props.pack, feedback));
  const applied = useRef(short.rewrittenAt ?? null);
  useEffect(() => {
    const saved = stream.saved;
    if (saved && saved.analyzedAt !== applied.current && (!short.rewrittenAt || saved.analyzedAt > short.rewrittenAt)) {
      applied.current = saved.analyzedAt;
      setOpen(false);
      setFeedback('');
      onDone({ ...saved.result, rewrittenAt: saved.analyzedAt });
    }
  }, [stream.saved, short.rewrittenAt, onDone]);

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <RefreshCw size={14} aria-hidden="true" /> Rewrite this Short
      </button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-lg border border-bg-border p-3 sm:w-96">
      <label className="block text-xs text-zinc-400" htmlFor={`rewrite-${short.id}`}>
        What should change? (optional)
      </label>
      <textarea
        id={`rewrite-${short.id}`}
        className="input min-h-[64px] w-full text-sm"
        value={feedback}
        maxLength={500}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="For example: a stronger first shot, no hands, show the product more"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={stream.run} disabled={stream.running}>
          {stream.running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          Rewrite
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={stream.running}>
          Cancel
        </button>
        {props.cost !== null && <span className="text-xs text-zinc-500">{props.cost} credits · replaces this Short and its packaging</span>}
      </div>
      {stream.error && (
        <p className="text-xs text-rose-300">
          {stream.error.message}
          {stream.error.refunded ? ' Your credits were returned.' : ''}
        </p>
      )}
    </div>
  );
}

function packagingRequest(short: NextShort, channelTitle: string, audience: string): PackagingRequest {
  const sb = short.storyboard;
  return {
    channelTitle,
    audience,
    short: {
      name: short.name,
      why: short.why,
      promise: sb.brief.promise,
      hook: sb.brief.hook,
      ending: sb.brief.ending,
      shots: sb.shots.map((x) => ({ title: x.title, action: x.action })),
    },
  };
}

/** Title options, description, hashtags, cover and pinned comment for one Short. A new run replaces the last. */
function PackagingSection(props: {
  short: NextShort;
  channelTitle: string;
  audience: string;
  storeKey: string;
  cost: number | null;
  onDone: (p: ShortPackaging, at: string) => void;
}) {
  const { short, onDone } = props;
  const stream = useAnalysisStream<ShortPackaging, 'connect' | 'packaging' | 'done'>(
    '/api/youtube/next-shorts/packaging',
    props.storeKey,
    packagingRequest(short, props.channelTitle, props.audience),
  );
  const applied = useRef(short.packagingAt ?? null);
  useEffect(() => {
    const saved = stream.saved;
    if (saved && saved.analyzedAt !== applied.current && (!short.packagingAt || saved.analyzedAt > short.packagingAt)) {
      applied.current = saved.analyzedAt;
      onDone(saved.result, saved.analyzedAt);
    }
  }, [stream.saved, short.packagingAt, onDone]);

  const p = short.packagingOptions;
  const basic = short.storyboard.packaging;
  const description = p
    ? `${p.description}${p.hashtags.length ? ` ${p.hashtags.join(' ')}` : ''}`
    : `${basic.description}${basic.hashtags.length ? ` ${basic.hashtags.join(' ')}` : ''}`;
  return (
    <div className="space-y-3 rounded-lg border border-bg-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">Packaging</p>
          <p className="text-xs text-zinc-500">
            {p ? 'Title options, description, cover and pinned comment.' : 'A first title is below. Write the full packaging for options to choose from.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {props.cost !== null && <span className="text-xs text-zinc-500">{props.cost} credits</span>}
          <button type="button" className="btn-secondary btn-sm" onClick={stream.run} disabled={stream.running}>
            {stream.running ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
            {p ? 'Write new packaging' : 'Write packaging'}
          </button>
        </div>
      </div>
      {stream.error && (
        <p className="text-xs text-rose-300">
          {stream.error.message}
          {stream.error.refunded ? ' Your credits were returned.' : ''}
        </p>
      )}
      <div className="space-y-1">
        <p className="text-xs text-zinc-500">{p ? 'Titles: pick one' : 'Title'}</p>
        {(p ? p.titles : [{ title: basic.title, angle: '' }]).map((t) => (
          <div key={t.title} className="flex items-center justify-between gap-2 rounded-lg bg-bg-surface px-3 py-2">
            <p className="text-sm text-white">
              {t.title}
              {t.angle && <span className="ml-2 text-xs text-zinc-500">{t.angle}</span>}
            </p>
            <Copy text={t.title} label="Copy" />
          </div>
        ))}
      </div>
      <Row label="Description" text={description} />
      <Row label="Cover" text={p ? `Frame from shot ${p.coverShot}${p.coverText ? `, with “${p.coverText}”` : ''}` : `Frame from shot ${basic.coverShot}`} copy={false} />
      {p && <Row label="Pinned comment" text={p.pinnedComment} />}
    </div>
  );
}

function Row({ label, text, copy = true }: { label: string; text: string; copy?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm text-zinc-300">
        <span className="mr-2 text-xs text-zinc-500">{label}</span>
        {text}
      </p>
      {copy && <Copy text={text} label="Copy" />}
    </div>
  );
}

function PromptBlock({ title, hint, text }: { title: string; hint: string; text: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">{title}</p>
          <p className="text-xs text-zinc-500">{hint}</p>
        </div>
        <Copy text={text} label="Copy" />
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-surface p-3 text-xs leading-relaxed text-zinc-300">{text}</pre>
    </div>
  );
}

function Readiness({ value }: { value: number }) {
  const tone = value >= 80 ? 'text-emerald-300' : value >= 60 ? 'text-amber-300' : 'text-rose-300';
  return <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>;
}

function IssueBox({ title, items, tone }: { title: string; items: string[]; tone: 'rose' | 'amber' | 'zinc' }) {
  const box = {
    rose: 'border-rose-700/50 bg-rose-950/30 text-rose-200',
    amber: 'border-amber-700/50 bg-amber-950/30 text-amber-200',
    zinc: 'border-bg-border bg-bg-surface text-zinc-400',
  }[tone];
  return (
    <div className={`flex gap-2 rounded-lg border p-3 text-xs ${box}`}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Copy({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="btn-secondary btn-sm shrink-0" onClick={copy}>
      {copied ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** On the Performance tab: a way back to the saved ideas without running the check again. Hidden when there are none. */
export function SavedIdeasLink({ userId, channelId }: { userId: string; channelId: string }) {
  const [saved, setSaved] = useState<NextShortsPack | null>(null);
  useEffect(() => {
    const pack = loadNextShorts<NextShortsPack>(nextShortsKey(userId, channelId));
    setSaved(pack?.version === 3 ? pack : null);
  }, [userId, channelId]);
  if (!saved) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-bg-surface px-5 py-3">
      <p className="flex items-center gap-2 text-sm text-zinc-300">
        <Clapperboard size={16} className="text-violet-300" aria-hidden="true" />
        Your next video ideas: {saved.shorts.length} Shorts, made {new Date(saved.generatedAt).toLocaleDateString()}
      </p>
      <Link href="/youtube-doctor/next-shorts" className="btn-secondary btn-sm">
        Open ideas
      </Link>
    </div>
  );
}
