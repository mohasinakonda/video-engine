import { FORMAT_LABELS, type TopicSummary } from './types';

/** Topics several channels cover, with the counts behind them and your own coverage. */
export function TopicList({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null;
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Topics in your market</h3>
        <p className="text-sm text-zinc-400 mt-0.5">
          Videos grouped by what they’re about, across your channel and your competitors. Topic names are written by AI from the titles; all counts are ours.
        </p>
      </div>
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {topics.map((t) => (
          <li key={t.id} className="p-4 rounded-xl border border-bg-border bg-bg-surface space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold text-white leading-snug">{t.label}</p>
              {t.outlierCount > 0 && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 text-xs font-medium">
                  {t.outlierCount} standout{t.outlierCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-300">
              {t.competitorChannelCount} competitor{t.competitorChannelCount === 1 ? '' : 's'} · {t.competitorVideoCount} of their videos
              {t.competitorRecent30 > 0 && ` · ${t.competitorRecent30} in the last 30 days`}
            </p>
            <p className={`text-sm font-medium ${t.yourVideoCount === 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {t.yourVideoCount === 0 ? 'You: no videos on this yet' : `You: ${t.yourVideoCount} video${t.yourVideoCount === 1 ? '' : 's'}`}
            </p>
            {t.audienceProblem && <p className="text-sm text-zinc-300">Viewer need: {t.audienceProblem}</p>}
            {t.topFormats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {t.topFormats.map((f) => (
                  <span key={f.format} className="px-2 py-0.5 rounded-md bg-bg-elevated border border-bg-border text-xs text-zinc-300">
                    {FORMAT_LABELS[f.format]} · {f.count}
                  </span>
                ))}
              </div>
            )}
            <ul className="text-sm text-zinc-500 space-y-0.5">
              {t.exampleTitles.slice(0, 2).map((title) => (
                <li key={title} className="truncate">“{title}”</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
