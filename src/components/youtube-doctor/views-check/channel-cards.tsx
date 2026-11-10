/** Channel-wide cards: the channel's stage, where its Shorts lose viewers, and its topics. */
import type { ReactNode } from 'react';
import type { ChannelStage, StageWindow, TopicSummary, ViewsCheckReport } from '@/lib/youtube/views-check/types';
import { num, pct, plural } from './format';
import { STAGE_STYLE, STOP_LINE } from './styles';

function CardTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{children}</p>;
}

// ─── Channel stage ────────────────────────────────────────────────────────────

function stageFacts(stage: ChannelStage): string[] {
  const facts: string[] = [];
  if (stage.subscribers !== null) facts.push(plural(stage.subscribers, 'subscriber'));
  if (stage.channelAgeDays !== null) facts.push(`channel ${plural(stage.channelAgeDays, 'day')} old`);
  if (stage.shortsCompared > 0) facts.push(`${stage.shortsCompared} Shorts compared`);
  return facts;
}

/** Newest Shorts vs the ones before: is the floor rising? A reading of the channel's numbers, not a YouTube status. */
export function StageCard({ stage }: { stage: ChannelStage }) {
  const facts = stageFacts(stage);
  return (
    <section className="space-y-4 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <CardTitle>Channel stage</CardTitle>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STAGE_STYLE[stage.id]}`}>{stage.title}</span>
        {facts.length > 0 && <span className="text-xs text-zinc-400">{facts.join(' · ')}</span>}
      </div>
      {/* <p className="text-base leading-relaxed text-zinc-200">{stage.detail}</p> */}
      {stage.recent && stage.previous && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StageWindowBox label={`Your newest ${stage.recent.count} Shorts`} w={stage.recent} />
          <StageWindowBox label={`The ${stage.previous.count} before them`} w={stage.previous} muted />
        </div>
      )}

    </section>
  );
}

function StageWindowBox({ label, w, muted = false }: { label: string; w: StageWindow; muted?: boolean }) {
  const items = [
    { k: 'Lowest', v: num(w.floorViews) },
    { k: 'Median', v: num(w.medianViews) },
    { k: 'Highest', v: num(w.maxViews) },
  ];
  if (w.feedShare !== null) items.push({ k: 'From feed', v: pct(w.feedShare) });
  return (
    <div className={`rounded-xl border border-bg-border p-3.5 ${muted ? 'bg-bg-base' : 'bg-bg-elevated'}`}>
      <p className="mb-2 text-xs font-semibold text-zinc-400">{label}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.k}>
            <dt className="text-[11px] text-zinc-500">{i.k}</dt>
            <dd className="text-base font-bold tabular-nums text-white">{i.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Where the Shorts lose viewers ────────────────────────────────────────────

const STOP_ORDER = ['shown', 'stopped', 'stayed', 'reacted', 'none'] as const;

/** The channel's Shorts in plain sentences: how many lost viewers where, and what to do. */
export function StopPointsCard({ stops }: { stops: ViewsCheckReport['stopPoints'] }) {
  const lines = STOP_ORDER.map((id) => ({ id, count: stops.find((s) => s.gate === id)?.count ?? 0 })).filter((l) => l.count > 0);
  const total = lines.reduce((sum, l) => sum + l.count, 0);
  if (total === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <CardTitle>What happened to your Shorts</CardTitle>
      <p className="text-base text-zinc-200">
        We could judge <b className="text-white">{total}</b> of your Shorts. Here is where each one lost its viewers:
      </p>
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border px-4 py-3 ${STOP_LINE[l.id].tone}`}>
            <span className="text-2xl font-bold tabular-nums text-white">{l.count}</span>
            <span className="min-w-0 flex-1 text-base text-zinc-100">
              {l.count === 1 ? 'Short' : 'Shorts'}: {STOP_LINE[l.id].what}.
              <span className="block text-sm text-zinc-300">{STOP_LINE[l.id].todo}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">Open a Short in the list below to see its four steps: shown, stopped scrolling, stayed, reacted.</p>
    </section>
  );
}

// ─── Topics ───────────────────────────────────────────────────────────────────

/** The channel's Shorts by topic (grouped by AI from titles), most views first. */
export function TopicsCard({ topics }: { topics: TopicSummary[] }) {
  const top = topics.find((t) => t.medianViews !== null);
  return (
    <section className="space-y-3 rounded-2xl border border-bg-border bg-bg-surface p-5">
      <CardTitle>Your topics</CardTitle>
      {topics.length === 1 ? <OneTopic topic={topics[0]} /> : <TopicTable topics={topics} top={top} />}
      <p className="text-xs text-zinc-500">Topics are grouped by AI from your titles. “Views per Short” is the typical (middle) value, counting Shorts at least 2 days old.</p>
    </section>
  );
}

function OneTopic({ topic }: { topic: TopicSummary }) {
  return (
    <p className="text-base text-zinc-200">
      All your Shorts are on one topic: <b className="text-white">“{topic.name}”</b>. That helps YouTube know who to show them to.
      {topic.best && ` Your best one is “${topic.best.title}” (${num(topic.best.views)} views).`}
    </p>
  );
}

function topTopicText(top: TopicSummary, mostlySingles: boolean): string {
  const from = top.shorts === 1 ? ' (from 1 Short)' : ` (${top.shorts} Shorts)`;
  const note = mostlySingles
    ? ' Most topics have only one Short so far, so this is an early read: try another Short on your best topic to see if it holds.'
    : ' If you change topic, YouTube likely tests the new Short on new viewers first, so views can drop.';
  return ` gets the most views: about ${num(top.medianViews)} per Short${from}.${note}`;
}

function TopicTable({ topics, top }: { topics: TopicSummary[]; top: TopicSummary | undefined }) {
  const mostlySingles = topics.filter((t) => t.shorts === 1).length > topics.length / 2;
  return (
    <>
      {top && (
        <p className="text-base text-zinc-200">
          <b className="text-white">“{top.name}”</b>
          {topTopicText(top, mostlySingles)}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Topic</th>
              <th className="py-2 pr-3 text-right font-semibold">Shorts</th>
              <th className="py-2 pr-3 text-right font-semibold">Views per Short</th>
              <th className="py-2 pr-3 text-right font-semibold">Swiped away</th>
              <th className="py-2 font-semibold">Best Short</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.name} className="border-t border-bg-border">
                <td className={`py-2 pr-3 font-semibold ${t === top ? 'text-emerald-300' : 'text-white'}`}>{t.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-200">{t.shorts}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-200">{num(t.medianViews)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-200">{pct(t.medianSwipeAway)}</td>
                <td className="max-w-[260px] truncate py-2 text-zinc-400" title={t.best?.title}>
                  {t.best?.title ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
