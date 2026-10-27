'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Gauge, Loader2 } from 'lucide-react';

interface UnitsDay {
  day: string;
  features: Record<string, number>;
  searches: Record<string, number>;
  total: number;
  searchCalls: number;
}

interface Usage {
  days: UnitsDay[];
  dailyQuotaUnits: number;
  searchCallsPerDay: number;
  resetsAt: string;
}

/** Readable names for the metered features (others show their raw label). */
const FEATURE_NAMES: Record<string, string> = {
  'youtube/diagnosis': 'Channel Doctor · diagnosis',
  'youtube/video-analysis': 'Channel Doctor · video analysis',
  'audit/video': 'Analyze a link · video',
  'audit/channel': 'Analyze a link · channel',
  'audit/compare': 'Analyze a link · compare',
  'create/brief': 'Create · brief',
  'create/packaging': 'Create · packaging',
  'create/topic-search': 'Create · topic search',
  'launch-kit/search': 'Launch Kit · competitor search',
  'launch-kit/generate': 'Launch Kit · generate',
  'discover/discovery': 'Discover · find competitors',
  'discover/research': 'Discover · market research',
  'discover/competitors': 'Discover · competitor list',
  'discover/follow': 'Discover · add competitor',
  'discover/channel-search': 'Discover · search a topic',
  'discover/suggest': 'Discover · suggest phrases',
  other: 'Other (connect, analysis pages…)',
};
const featureName = (f: string) => FEATURE_NAMES[f] ?? f;
const WARN_AT = 0.8;
const fmt = (n: number) => n.toLocaleString();

/** A headline number with its meter: today's use against a daily limit. */
function DailyMeter({ used, limit, unit, label }: { used: number; limit: number; unit: string; label: string }) {
  const share = limit > 0 ? used / limit : 0;
  const warn = share >= WARN_AT;
  return (
    <div className="space-y-2">
      <p className="text-3xl font-bold text-white tabular-nums">
        {fmt(used)} <span className="text-base font-medium text-zinc-400">of {fmt(limit)} {unit} today</span>
      </p>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={label}>
        <div className={`h-full rounded-full ${warn ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
      <p className="text-xs text-zinc-400">{Math.round(share * 100)}% used</p>
      {warn && (
        <p className="text-sm text-amber-200 inline-flex items-center gap-1.5">
          <AlertTriangle size={14} />
          Over {Math.round(WARN_AT * 100)}% of today’s limit. New calls may start failing before the reset.
        </p>
      )}
    </div>
  );
}

/**
 * What the app's Google project spent today and over the last 7 days, by feature: the shared daily
 * units, and search calls, which have their own daily limit. Counts only calls billed to the project
 * (see quota-meter.ts).
 */
export function YouTubeUsageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/youtube-usage')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load usage.');
        setUsage(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-rose-400 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">{error}</p>;
  if (!usage) {
    return (
      <section className="card flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-zinc-400" />
      </section>
    );
  }

  const today = usage.days[0];
  const features = Object.entries(today.features).sort((a, b) => b[1] - a[1]);
  const searchesToday = Object.entries(today.searches).filter(([f]) => !(f in today.features));
  const top = features[0]?.[1] ?? 0;
  const allFeatures = Array.from(new Set(usage.days.flatMap((d) => Object.keys(d.features)))).sort(
    (a, b) => usage.days.reduce((s, d) => s + (d.features[b] ?? 0), 0) - usage.days.reduce((s, d) => s + (d.features[a] ?? 0), 0)
  );

  return (
    <section className="card space-y-5">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-zinc-400" />
        <h2 className="text-sm font-bold text-white">YouTube API usage</h2>
        <span className="text-xs text-zinc-500">
          resets {new Date(usage.resetsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {/* Today against each limit: headline numbers, not charts. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <DailyMeter used={today.total} limit={usage.dailyQuotaUnits} unit="units" label="YouTube units used today" />
        <DailyMeter used={today.searchCalls} limit={usage.searchCallsPerDay} unit="search calls" label="YouTube search calls used today" />
      </div>

      {/* Today by feature: one series, so one colour and the value as text. */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Today by feature</h3>
        {features.length === 0 && searchesToday.length === 0 ? (
          <p className="text-sm text-zinc-500">No YouTube calls yet today.</p>
        ) : (
          <ul className="space-y-1.5">
            {features.map(([feature, units]) => (
              <li key={feature} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3" title={`${featureName(feature)}: ${fmt(units)} units`}>
                <span className="text-sm text-zinc-300 truncate">{featureName(feature)}</span>
                <span className="h-2.5 rounded-r bg-zinc-800/60">
                  <span className="block h-full rounded-r bg-sky-500" style={{ width: `${Math.max(2, (units / top) * 100)}%` }} />
                </span>
                <span className="text-sm text-zinc-200 tabular-nums text-right">
                  {fmt(units)}
                  {today.searches[feature] ? <span className="text-zinc-400"> · {today.searches[feature]} search</span> : null}
                </span>
              </li>
            ))}
            {searchesToday.map(([feature, n]) => (
              <li key={feature} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3">
                <span className="text-sm text-zinc-300 truncate">{featureName(feature)}</span>
                <span />
                <span className="text-sm text-zinc-400 tabular-nums text-right">{n} search</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Last 7 days, as a table (also the accessible view of the numbers above). */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Last 7 days</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 pr-3 font-medium">Feature</th>
                {usage.days.map((d) => (
                  <th key={d.day} className="py-1 px-2 font-medium text-right whitespace-nowrap">
                    {new Date(`${d.day}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map((f) => (
                <tr key={f} className="border-t border-bg-border">
                  <td className="py-1 pr-3 text-zinc-300 whitespace-nowrap">{featureName(f)}</td>
                  {usage.days.map((d) => (
                    <td key={d.day} className="py-1 px-2 text-right tabular-nums text-zinc-300">
                      {d.features[f] ? fmt(d.features[f]) : '–'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-bg-border font-semibold">
                <td className="py-1 pr-3 text-white">Total units</td>
                {usage.days.map((d) => (
                  <td key={d.day} className="py-1 px-2 text-right tabular-nums text-white">
                    {fmt(d.total)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-bg-border">
                <td className="py-1 pr-3 text-zinc-300">Search calls</td>
                {usage.days.map((d) => (
                  <td key={d.day} className="py-1 px-2 text-right tabular-nums text-zinc-300">
                    {d.searchCalls || '–'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Counted from {new Date('2026-10-27').toLocaleDateString([], { month: 'short', day: 'numeric' })}: only calls billed to the app’s Google project.
          Since June 2026 a search uses 1 of the separate daily search calls (100 by default), not units; every other call is 1 unit.
          Users’ own API keys and the Analytics API aren’t counted.
        </p>
      </div>
    </section>
  );
}
