/** YouTube's test: the day-by-day rounds and the test score, for one Short and for the channel. */
import type { ShortTest, ShortTimeline, TestRound, TestRounds, TestSignal, TestSignalId } from '@/lib/youtube/views-check/types';
import { num, SIGNAL_LABEL, signalText } from './format';
import { RESULT, ROUND_STYLE } from './styles';

const SIGNALS: TestSignalId[] = ['stayed', 'watched', 'reacted'];

/** What a round's ✓ or ✗ means, in words. */
function roundNote(r: TestRound, usualFirstDay: number | null): string {
  if (r.state === 'no_data') return 'Not reported yet';
  if (r.no > 1) return r.state === 'pass' ? `More views than day ${r.no - 1}` : `Fewer views than day ${r.no - 1}`;
  if (usualFirstDay === null) return 'First viewers (no usual first day to compare yet)';
  return r.state === 'pass' ? `At or above your usual first day (${num(usualFirstDay)})` : `Under your usual first day (${num(usualFirstDay)})`;
}

/** The date each round covers, for colouring the views-per-day chart. */
export function roundDates(rounds: TestRounds): Record<string, TestRound['no']> {
  const out: Record<string, TestRound['no']> = {};
  for (const r of rounds.rounds) if (r.date) out[r.date] = r.no;
  return out;
}

/** R1 ✓ R2 ✗ R3 ✗ for a table row (round n = day n). */
export function RoundStrip({ rounds }: { rounds: TestRounds }) {
  const notes = rounds.rounds.map((r) => `Day ${r.no}: ${roundNote(r, rounds.usualFirstDay)}`);
  return (
    <span className="flex flex-wrap gap-x-2 text-[11px]" aria-label={notes.join(', ')}>
      {rounds.rounds.map((r, i) => (
        <span key={r.no} className={`${ROUND_STYLE[r.state].text} ${r.state === 'fail' ? 'font-bold' : ''}`} title={notes[i]}>
          R{r.no} {ROUND_STYLE[r.state].mark}
        </span>
      ))}
    </span>
  );
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

function RoundCard({ round, previous, rounds }: { round: TestRound; previous: TestRound | null; rounds: TestRounds }) {
  const style = ROUND_STYLE[round.state];
  const rates = round.rates;
  return (
    <li className={`rounded-lg border p-3 ${style.box}`}>
      <p className={`text-sm font-semibold ${style.text}`}>
        Round {round.no} · {style.mark}
      </p>
      <p className="text-xs text-zinc-400">{roundNote(round, rounds.usualFirstDay)}</p>
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
          {SIGNALS.map((id) => {
            const fell = id === rounds.dropped && round.state === 'fail';
            return (
              <div key={id} className="flex justify-between gap-2">
                <dt className={fell ? 'font-semibold text-rose-300' : 'text-zinc-400'}>{SIGNAL_LABEL[id]}</dt>
                <dd className="tabular-nums text-zinc-100">
                  {signalText(id, rates[id])}
                  <Trend id={id} now={rates[id]} before={previous?.rates?.[id] ?? null} />
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Not reported yet</p>
      )}
    </li>
  );
}

/** Round n = day n: that day's views and what its viewers did. */
export function RoundsBox({ rounds }: { rounds: TestRounds }) {
  const last = rounds.rounds.length;
  return (
    <section className="space-y-3 rounded-xl border border-bg-border bg-bg-surface p-4">
      <p className="text-xs font-semsibold uppercase tracking-wider text-zinc-400">YouTube’s test, round by rounds</p>
      {/* <p className="text-base text-zinc-100">{rounds.message}</p> */}
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rounds.rounds.map((r, i) => (
          <RoundCard key={r.no} round={r} previous={rounds.rounds[i - 1] ?? null} rounds={rounds} />
        ))}
      </ol>
      {rounds.nextDay && (
        <p className="text-sm text-zinc-300">
          Day {last + 1}: <b className="text-white">{num(rounds.nextDay.views)}</b> views
          {rounds.nextDay.change !== null && ` (${Math.round(rounds.nextDay.change * 100)}% of day ${last})`}
        </p>
      )}
      {rounds.fix && <NextShort text={rounds.fix} />}

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
      Test {test.score}
    </span>
  );
}

/** "usual 62%", or the healthy level when the usual is below it. */
function benchmarkText(s: TestSignal): string {
  if (s.usual !== null && s.usual >= s.benchmark) return `usual ${signalText(s.id, s.usual)}`;
  return s.id === 'stayed' ? `healthy ${signalText(s.id, s.benchmark)} or less` : `healthy ${signalText(s.id, s.benchmark)}+`;
}

/** One Short's test score: the plain reason, then its three numbers against the usual Short. */
export function TestBox({ test }: { test: ShortTest }) {
  return (
    <section className={`space-y-3 rounded-xl border p-4 ${RESULT[test.result].box}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-bold tabular-nums text-white">{test.score}</span>
        <span className="text-sm text-zinc-300">test score · 100 = your usual Short</span>
      </div>
      <p className="text-base text-zinc-100">{test.message}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {test.signals.map((s) => (
          <li key={s.id} className={`rounded-lg border bg-bg-surface px-3 py-2 ${s.id === test.weakest ? 'border-rose-700' : 'border-bg-border'}`}>
            <p className="text-xs text-zinc-400">{SIGNAL_LABEL[s.id]}</p>
            <p className="text-[15px] font-bold tabular-nums text-white">{signalText(s.id, s.value)}</p>
            <p className="text-xs text-zinc-400">{benchmarkText(s)}</p>
          </li>
        ))}
      </ul>
      {test.fix && <NextShort text={test.fix} />}
    </section>
  );
}

const SUMMARY_LINES = [
  { key: 1, text: 'got fewer views on day 1 than your usual first day', tone: 'border-rose-700 bg-rose-950/60' },
  { key: 2, text: 'did well on day 1, but got fewer views on day 2', tone: 'border-amber-700 bg-amber-950/60' },
  { key: 3, text: 'grew on day 2, but got fewer views on day 3', tone: 'border-amber-700 bg-amber-950/60' },
  { key: 'all', text: 'grew every day for 3 days', tone: 'border-emerald-800 bg-emerald-950/40' },
] as const;

/** How many Shorts first failed on day 1, 2 or 3, and how many grew every day. */
function RoundsSummary({ shorts }: { shorts: ShortTimeline[] }) {
  const judged = shorts.map((t) => t.rounds).filter((r): r is TestRounds => Boolean(r && (r.failedAt || r.passedAll)));
  if (!judged.length) return null;
  const countOf = (key: (typeof SUMMARY_LINES)[number]['key']) => judged.filter((r) => (key === 'all' ? r.passedAll : r.failedAt === key)).length;
  const lines = SUMMARY_LINES.map((l) => ({ ...l, n: countOf(l.key) })).filter((l) => l.n > 0);
  return (
    <ul className="space-y-2">
      {lines.map((l) => (
        <li key={l.key} className={`flex items-baseline gap-3 rounded-xl border px-4 py-2.5 ${l.tone}`}>
          <span className="text-xl font-bold tabular-nums text-white">{l.n}</span>
          <span className="text-base text-zinc-100">
            {l.n === 1 ? 'Short' : 'Shorts'} {l.text}.
          </span>
        </li>
      ))}
      <li className="text-xs text-zinc-500">Open a Short below to see each day and which number fell.</li>
    </ul>
  );
}

/** How the test works, how the channel's Shorts did in it, and how well the score fits its views. */
export function TestCard({ shorts, agreement }: { shorts: ShortTimeline[]; agreement: { agreed: number; pairs: number } | null }) {
  const tests = shorts.map((t) => t.test).filter((t): t is ShortTest => Boolean(t));
  if (!tests.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">YouTube’s test</p>
      <RoundsSummary shorts={shorts} />
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
