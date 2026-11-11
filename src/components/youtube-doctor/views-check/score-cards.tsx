'use client';

/**
 * The three scores side by side: Channel health (are the Shorts good?), Distribution (is YouTube
 * showing them?) and Account health (is anything wrong with the channel?). Each: a ring, the main
 * problem in one line, and the details behind a toggle.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, X } from 'lucide-react';
import type { AccountHealth, DistributionScore, HealthBandId, ShortsHealth } from '@/lib/youtube/views-check/types';

const BAND: Record<HealthBandId, { label: string; ring: string; pill: string; Icon: typeof AlertCircle }> = {
  excellent: {
    label: 'Great',
    ring: '#34d399',
    pill: 'bg-emerald-500/15 text-emerald-200',
    Icon: CheckCircle2,
  },
  healthy: {
    label: 'Good',
    ring: '#34d399',
    pill: 'bg-emerald-500/15 text-emerald-200',
    Icon: CheckCircle2,
  },
  average: {
    label: 'Okay',
    ring: '#fbbf24',
    pill: 'bg-amber-500/15 text-amber-200',
    Icon: AlertCircle,
  },
  weak: {
    label: 'Needs work',
    ring: '#fb923c',
    pill: 'bg-orange-500/15 text-orange-200',
    Icon: AlertCircle,
  },
  critical: {
    label: 'Fix now',
    ring: '#fb7185',
    pill: 'bg-rose-500/15 text-rose-200',
    Icon: AlertCircle,
  },
};
const BANDS_NOTE = '85+ Great · 70–84 Good · 55–69 Okay · 40–54 Needs work · 0–39 Fix now.';

const barColor = (score: number) => (score >= 70 ? 'bg-emerald-400' : score >= 55 ? 'bg-amber-400' : score >= 40 ? 'bg-orange-400' : 'bg-rose-400');
const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?]$/.test(s) ? '' : '.'}`;

function Ring({ title, score, band }: { title: string; score: number | null; band: HealthBandId | null }) {
  const size = 148;
  const stroke = 13;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const label = score === null || !band ? `No ${title} score yet: not enough data` : `${title} ${score} out of 100, ${BAND[band].label}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-zinc-800" strokeWidth={stroke} strokeDasharray={score === null ? '6 8' : undefined} />
        {score !== null && band && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BAND[band].ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * Math.max(score, 1)) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold leading-none tabular-nums text-white">{score ?? '—'}</span>
        <span className="mt-1 text-xs text-zinc-400">{score === null ? 'no score yet' : 'out of 100'}</span>
      </div>
    </div>
  );
}

function BandPill({ band }: { band: HealthBandId | null }) {
  const b = band ? BAND[band] : null;
  return b ? (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${b.pill}`}>
      <b.Icon size={14} aria-hidden="true" />
      {b.label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-sm font-semibold text-zinc-200">
      <CircleDashed size={14} aria-hidden="true" />
      Not enough data
    </span>
  );
}

function ScoreCard(props: {
  title: string;
  question: string;
  score: number | null;
  band: HealthBandId | null;
  basedOn: string;
  headline: string;
  detail: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-bg-border bg-bg-surface p-5 text-center sm:p-6">
      <Ring title={props.title} score={props.score} band={props.band} />
      <h2 className="text-lg font-bold text-white">{props.title}</h2>
      <BandPill band={props.band} />
      <p className="line-clamp-2 min-h-[2.75rem] text-sm leading-snug text-zinc-300" title={props.headline}>
        {props.headline}
      </p>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm mt-auto" aria-haspopup="dialog">
        Details
      </button>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={() => setOpen(false)}>
          <div className="modal-panel relative max-h-[85vh] max-w-lg space-y-5 overflow-y-auto p-6 text-left" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 text-zinc-400 hover:text-white">
              <X size={18} />
            </button>
            <div className="flex items-center gap-4 pr-6">
              <div className="text-4xl font-extrabold tabular-nums text-white">{props.score ?? '—'}</div>
              <div className="space-y-1">
                <h3 id={titleId} className="text-lg font-bold text-white">
                  {props.title}
                </h3>
                <p className="text-sm text-zinc-400">{props.question}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <BandPill band={props.band} />
              <p className="pt-1 text-base font-semibold text-white">{props.headline}</p>
              {props.detail && <p className="text-sm text-zinc-300">{props.detail}</p>}
              <p className="text-xs text-zinc-500">{props.basedOn}</p>
            </div>
            {props.score !== null && <div className="space-y-4 border-t border-bg-border pt-4">{props.children}</div>}
          </div>
        </div>
      )}
    </section>
  );
}

function Bar({ name, note, score, detail }: { name: string; note: string; score: number | null; detail: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-white">
          {name} <span className="font-normal text-zinc-400">· {note}</span>
        </span>
        <span className={`text-sm tabular-nums ${score === null ? 'font-medium text-zinc-400' : 'font-bold text-white'}`}>{score ?? 'Not scored'}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        {score !== null && <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${Math.max(2, score)}%` }} />}
      </div>
      <p className="text-xs text-zinc-400">{detail}</p>
    </div>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="text-xs text-zinc-500">{children}</p>;

function ChannelHealthCard({ health }: { health: ShortsHealth }) {
  const trend = health.trend;
  return (
    <ScoreCard
      title="Video quality"
      question="Do viewers stay and watch?"
      score={health.score}
      band={health.band}
      basedOn={`From your last ${health.shorts} Short${health.shorts === 1 ? '' : 's'}${health.score !== null && health.provisional ? ' · early read: more Shorts make it surer' : ''}`}
      headline={health.headline}
      detail={health.detail}
    >
      <Bar name="Your Shorts" note="70%" score={health.p} detail="A typical Short of yours, against a good level for each part below." />
      <Bar
        name="Trend"
        note="30%"
        score={health.t}
        detail={
          trend
            ? `Your last ${trend.recentCount} Shorts score ${Math.round(trend.recent)} on the Trust Score, vs ${Math.round(trend.previous)} for the ${trend.previousCount} before.`
            : 'Not enough Shorts yet to compare your newest with the ones before, so this part is left out.'
        }
      />
      <p className="pt-1 text-sm font-semibold text-white">What makes up “Your Shorts”</p>
      {health.parts.map((part) => (
        <Bar key={part.id} name={part.name} note={`${Math.round(part.weight * 100)}%`} score={part.score} detail={sentence(part.text)} />
      ))}
      <Note>Score = 70% your Shorts + 30% trend. Each part scores 70 at a good level and 100 well above it; parts YouTube didn’t share are left out. {BANDS_NOTE}</Note>
    </ScoreCard>
  );
}

function DistributionCard({ distribution }: { distribution: DistributionScore }) {
  return (
    <ScoreCard
      title="YouTube reach"
      question="Is YouTube showing your Shorts? (shadowban check)"
      score={distribution.score}
      band={distribution.band}
      basedOn={`From your last ${distribution.shorts} Short${distribution.shorts === 1 ? '' : 's'}${distribution.score !== null && distribution.provisional ? ' · early read: more Shorts make it surer' : ''}`}
      headline={distribution.headline}
      detail={distribution.detail}
    >
      {distribution.parts.map((part) => (
        <Bar key={part.id} name={part.name} note={`${Math.round(part.weight * 100)}%`} score={part.score} detail={sentence(part.text)} />
      ))}
      <Note>Each part scores 70 at a good level and 100 well above it; parts without data are left out. Blocked Shorts count under Channel safety, not here. {BANDS_NOTE}</Note>
    </ScoreCard>
  );
}

const SEVERITY_DOT: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-rose-400',
  medium: 'bg-amber-400',
  low: 'bg-zinc-400',
};

function AccountHealthCard({ account }: { account: AccountHealth }) {
  return (
    <ScoreCard
      title="Channel safety"
      question="Any strike, block or restriction?"
      score={account.score}
      band={account.band}
      basedOn={`We checked ${account.checked} video${account.checked === 1 ? '' : 's'} and your channel settings`}
      headline={account.headline}
      detail={account.detail}
    >
      {account.issues.length ? (
        <ul className="space-y-4">
          {account.issues.map((issue) => (
            <li key={issue.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[issue.severity]}`} aria-hidden="true" />
                  {issue.title}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-rose-200">−{issue.points}</span>
              </div>
              <p className="text-xs text-zinc-300">{issue.detail}</p>
              {issue.videos.length > 0 && (
                <p className="text-xs text-zinc-400">
                  {issue.videos
                    .slice(0, 3)
                    .map((v) => `“${v.title}”`)
                    .join(', ')}
                  {issue.videos.length > 3 ? ` and ${issue.videos.length - 3} more` : ''}
                </p>
              )}
              <p className="text-xs text-emerald-200/90">Fix: {issue.fix}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-300">No blocks, rejections, restrictions or spam-like patterns found.</p>
      )}

    </ScoreCard>
  );
}

export function ScoreCards({ health, distribution, account }: { health: ShortsHealth; distribution: DistributionScore; account: AccountHealth }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ChannelHealthCard health={health} />
      <DistributionCard distribution={distribution} />
      <AccountHealthCard account={account} />
    </div>
  );
}
