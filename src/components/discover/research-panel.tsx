'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { reportKey } from '@/lib/channel-doctor-storage';
import { ProgressSteps, type ProgressStep } from '@/components/youtube-doctor/progress-steps';
import { useAnalysisStream } from '@/components/youtube-doctor/use-diagnosis';
import { StreamError } from './stream-error';
import { CompareTable } from './compare-table';
import { OutlierList } from './outlier-list';
import { PatternTables } from './pattern-tables';
import { TopicList } from './topic-list';
import type { DiscoverConfig, OutputLanguage, ResearchResult, ResearchStage, ResearchWindow } from './types';

const STEPS: ProgressStep<ResearchStage>[] = [
  { stage: 'connect', label: 'Connecting to YouTube' },
  { stage: 'your_channel', label: 'Reading your channel' },
  { stage: 'competitors', label: (n) => (n ? `Researching ${n} competitor${n === 1 ? '' : 's'}` : 'Researching your competitors') },
  { stage: 'videos', label: (n) => (n ? `Collecting up to ${n} recent videos` : 'Collecting recent videos') },
  { stage: 'outliers', label: 'Comparing each video with its channel’s usual' },
  { stage: 'topics', label: (n) => (n ? `Grouping ${n} videos into topics` : 'Grouping videos into topics') },
  { stage: 'formats', label: 'Spotting formats and title styles' },
  { stage: 'opportunities', label: 'Finding gaps and scoring opportunities' },
  { stage: 'angles', label: 'Writing original video ideas' },
];

export function useResearch(userId: string, channelId: string, period: ResearchWindow, language: OutputLanguage) {
  return useAnalysisStream<ResearchResult, ResearchStage>('/api/youtube/discover/research', reportKey(userId, channelId, `research-${period}`), {
    window: period,
    language,
  });
}

const LANGUAGES: { id: OutputLanguage; label: string }[] = [
  { id: 'auto', label: 'Same as my videos' },
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা' },
];

/** Market tab: one choice (period), one button, real progress, then what's working in the market. */
export function ResearchPanel({
  config,
  research,
  period,
  onPeriodChange,
  activeCompetitors,
  onAddCompetitors,
  onSeeOpportunities,
  language,
  onLanguageChange,
}: {
  language: OutputLanguage;
  onLanguageChange: (l: OutputLanguage) => void;
  config: DiscoverConfig;
  research: ReturnType<typeof useResearch>;
  period: ResearchWindow;
  onPeriodChange: (w: ResearchWindow) => void;
  activeCompetitors: number | null;
  onAddCompetitors: () => void;
  onSeeOpportunities: () => void;
}) {
  const result = research.saved?.result;
  const tooFew = activeCompetitors !== null && activeCompetitors < 2;

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        {research.running ? (
          <>
            <p className="text-lg font-semibold text-white">Researching your market…</p>
            <ProgressSteps reached={research.stages} steps={STEPS} counts={research.counts} />
            <p className="text-sm text-zinc-400">Usually about a minute. Please keep this tab open.</p>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-white">What’s working in your market?</h2>
              <p className="text-base text-zinc-400 mt-1">We read your competitors’ recent videos and find the ones that did far better than that channel usually does.</p>
            </div>
            {tooFew ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="flex-1 text-base text-zinc-300">Add at least 2 competitors first.</p>
                <button type="button" onClick={onAddCompetitors} className="btn-primary">
                  Add competitors
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400">Look at videos from the last</p>
                  <div className="inline-flex gap-1 p-1 rounded-xl bg-bg-elevated border border-bg-border" role="radiogroup" aria-label="Period">
                    {(['30d', '90d'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={period === key}
                        onClick={() => onPeriodChange(key)}
                        className={`px-4 py-2 rounded-lg text-base font-semibold ${period === key ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
                      >
                        {key === '30d' ? '30 days' : '90 days'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="space-y-2 block">
                  <span className="block text-sm text-zinc-400">Write ideas in</span>
                  <select value={language} onChange={(e) => onLanguageChange(e.target.value as OutputLanguage)} className="input text-base py-2 w-auto">
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sm:ml-auto flex flex-col items-start sm:items-end gap-1.5">
                  <button type="button" onClick={research.run} className="btn-primary px-6 py-3 text-base font-semibold">
                    {result ? <RefreshCw size={18} /> : <Sparkles size={18} />}
                    {result ? 'Research again' : 'Run research'}
                  </button>
                  <p className="text-sm text-zinc-400">Uses {config.costs.research} credits</p>
                </div>
              </div>
            )}
          </>
        )}

        {research.error && !research.running && <StreamError error={research.error} />}
      </section>

      {result && !research.running && (result.opportunities?.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={onSeeOpportunities}
          className="w-full text-left p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]"
        >
          <p className="text-lg font-bold text-white">
            {result.opportunities.length} next-video idea{result.opportunities.length === 1 ? '' : 's'} found →
          </p>
          <p className="text-base text-zinc-300">Ranked with the evidence behind each one.</p>
        </button>
      )}

      {result && !research.running && <ResearchResults result={result} analyzedAt={research.saved!.analyzedAt} />}
    </div>
  );
}

const STALE_MS = 24 * 60 * 60 * 1000;

function ResearchResults({ result, analyzedAt }: { result: ResearchResult; analyzedAt: string }) {
  const unavailable = result.statuses.filter((s) => s.status === 'unavailable');
  const stale = Date.now() - Date.parse(analyzedAt) > STALE_MS;
  return (
    <div className="space-y-8">
      {stale && (
        <p className="text-sm text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          These results are from {new Date(analyzedAt).toLocaleDateString([], { dateStyle: 'medium' })}. Views change daily: research again for current numbers.
        </p>
      )}
      <p className="text-sm text-zinc-400">
        {result.competitors.length} competitors · {result.videosAnalyzed} videos read · last {result.window === '30d' ? '30' : '90'} days · checked at{' '}
        {new Date(analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>

      <TopicList topics={result.topics ?? []} />

      <OutlierList outliers={result.outliers} period={result.window} topics={result.topics ?? []} />

      {result.patterns && <PatternTables patterns={result.patterns} />}

      <CompareTable you={result.you} competitors={result.competitors} period={result.window} />

      {(unavailable.length > 0 || result.limitations.length > 0) && (
        <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-2">
          <h3 className="text-base font-semibold text-white">Good to know</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            {unavailable.map((s) => (
              <li key={s.channelId}>
                {s.title || 'A saved channel'} was left out: {s.reason}
              </li>
            ))}
            {result.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
