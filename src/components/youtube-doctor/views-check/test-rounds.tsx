/** Each round's numbers (round n = day n) and the Trust Score, for one Short and for the channel. */
import type { ShortTest, ShortTimeline, TestRound, TestRounds, TestSignalId } from '@/lib/youtube/views-check/types';
import { VIEWS_RULES } from '@/lib/youtube/views-check/rules-config';
import { num, SIGNAL_LABEL, signalText } from './format';
import { RESULT } from './styles';

const SIGNALS: TestSignalId[] = ['stayed', 'watched', 'reacted'];
/** Below this many views a day's rates are noise (1 view = 100% or 0%). */
const MIN_VIEWS = VIEWS_RULES.rounds.minViews;

/** The date each round covers, for colouring the views-per-day chart. */
export function roundDates(rounds: TestRounds): Record<string, TestRound['no']> {
  const out: Record<string, TestRound['no']> = {};
  for (const r of rounds.rounds) if (r.date) out[r.date] = r.no;
  return out;
}

/**
 * ▲ / ▼ for the number as shown, against the day before, when the change is real (5%+). Green when
 * it got better: for swiped away (shown as 1 − stayed) lower is better.
 */
function Trend({ id, now, before }: { id: TestSignalId; now: number | null; before: number | null }) {
  if (now === null || before === null || before === 0) return null;
  const [shown, shownBefore] = id === 'stayed' ? [1 - now, 1 - before] : [now, before];
  if (shownBefore === 0 || Math.abs(shown / shownBefore - 1) < 0.05) return <span className="ml-1 text-xs text-zinc-500">=</span>;
  const tone = now > before ? 'text-emerald-300' : 'text-rose-300';
  return <span className={`ml-1 text-xs ${tone}`}>{shown > shownBefore ? '▲' : '▼'}</span>;
}

function RoundCard({ round, previous }: { round: TestRound; previous: TestRound | null }) {
  const rates = round.rates;
  return (
    <li className="rounded-lg border border-bg-border bg-bg-elevated p-3">
      <p className="text-sm font-semibold text-white">Round {round.no}</p>
      <p className="text-xs text-zinc-400">
        Day {round.no}
        {round.date ? ` · ${round.date}` : ''}
      </p>
      {rates ? (
        <dl className="mt-2 space-y-0.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-400">Views</dt>
            <dd className="font-semibold tabular-nums text-white">
              {num(rates.views)}
              {round.change !== null && (
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  ({Math.round(round.change * 100)}% of day {round.no - 1})
                </span>
              )}
            </dd>
          </div>
          {rates.views < MIN_VIEWS ? (
            <p className="pt-1 text-xs text-zinc-500">Too few views to read the rest</p>
          ) : (
            SIGNALS.map((id) => (
              <div key={id} className="flex justify-between gap-2">
                <dt className="text-zinc-400">{SIGNAL_LABEL[id]}</dt>
                <dd className="tabular-nums text-zinc-100">
                  {signalText(id, rates[id])}
                  <Trend id={id} now={rates[id]} before={previous?.rates && previous.rates.views >= MIN_VIEWS ? previous.rates[id] : null} />
                </dd>
              </div>
            ))
          )}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Not reported yet</p>
      )}
    </li>
  );
}

/** Round n = day n: that day's views and what its viewers did, with no pass or fail. */
export function RoundsBox({ rounds }: { rounds: TestRounds }) {
  return (
    <section className="space-y-3 rounded-xl border border-bg-border bg-bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">YouTube’s test, round by round</p>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rounds.rounds.map((r, i) => (
          <RoundCard key={r.no} round={r} previous={rounds.rounds[i - 1] ?? null} />
        ))}
      </ol>
    </section>
  );
}

function NextShort({ text }: { text: string }) {
  return (
    <p className="text-sm text-zinc-200">
      <b className="text-white">Next Short:</b> {text}
    </p>
  );
}

export function ScoreChip({ test }: { test: ShortTest }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${RESULT[test.result].chip}`} title={test.message}>
      Trust Score {test.score}
    </span>
  );
}

const SCORE_EXPLAINED = 'How viewers reacted to this Short next to your usual one. Fewer swipes, longer watching and more likes, comments and shares raise it.';

/** One Short's Trust Score (your usual Short = 100), the reason in one line, and what to do next time. */
export function TestBox({ test }: { test: ShortTest }) {
  return (
    <section className="space-y-2 rounded-xl border border-bg-border bg-bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-zinc-300">Trust Score</span>
        <span className="text-2xl font-bold tabular-nums text-white">{test.score}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RESULT[test.result].chip}`}>{RESULT[test.result].label}</span>

      </div>
      <p className="text-xs text-zinc-400">{SCORE_EXPLAINED}</p>
      <p className="text-base text-zinc-100">{test.message}</p>
      {test.fix && <NextShort text={test.fix} />}
    </section>
  );
}

/** The channel's Shorts by Trust Score: how many are above, near or below the usual Short. */
export function TestCard({ shorts, agreement }: { shorts: ShortTimeline[]; agreement: { agreed: number; pairs: number } | null }) {
  const tests = shorts.map((t) => t.test).filter((t): t is ShortTest => Boolean(t));
  if (!tests.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Trust Score</p>
      <p className="text-sm text-zinc-400">{SCORE_EXPLAINED}</p>
      <div className="flex flex-wrap gap-2 text-sm">
        {(['passed', 'close', 'failed'] as const).map((r) => (
          <span key={r} className={`rounded-full px-3 py-1 font-semibold ${RESULT[r].chip}`}>
            {tests.filter((t) => t.result === r).length} {RESULT[r].label.toLowerCase()}
          </span>
        ))}
      </div>
    </section>
  );
}

function agreementText({ agreed, pairs }: { agreed: number; pairs: number }): string {
  return `On your channel it ranked Shorts the same way as their views in ${agreed} of ${pairs} comparisons (${Math.round((agreed / pairs) * 100)}%).`;
}
