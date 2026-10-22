'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAgo, formatCompact, formatDate } from '@/components/youtube-doctor/format';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { Segmented } from '@/components/ui/segmented';
import { TextLink } from '@/components/ui/text-link';
import type { ChannelOverview, OverviewVideo } from './types';

const AXIS_TICK = { fill: '#a1a1aa', fontSize: 12 };
const TOOLTIP_STYLE = { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 14 };
const DAY_MS = 86_400_000;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function displayName(names: Intl.DisplayNames, code: string | null): string | null {
  if (!code) return null;
  try {
    return names.of(code) || code;
  } catch {
    return code;
  }
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {hint && <p className="text-sm text-zinc-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-100">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated border border-bg-border p-3">
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}

function ShareRow({ label, count, max, wide = false }: { label: string; count: number; max: number; wide?: boolean }) {
  return (
    <li className={`grid ${wide ? 'grid-cols-[6rem_1fr_2rem]' : 'grid-cols-[3rem_1fr_2rem]'} items-center gap-2 text-sm`}>
      <span className="text-zinc-300">{label}</span>
      <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
        <div className="h-full rounded-full bg-sky-400/80" style={{ width: `${max ? Math.max(2, (count / max) * 100) : 0}%` }} />
      </div>
      <span className="text-right tabular-nums text-zinc-200">{count}</span>
    </li>
  );
}

function About({ overview }: { overview: ChannelOverview }) {
  const { profile } = overview;
  const [open, setOpen] = useState(false);
  const firstUpload = overview.firstUploadAt
    ? formatDate(overview.firstUploadAt)
    : overview.oldestReadAt
      ? `Before ${formatDate(overview.oldestReadAt)}`
      : null;

  return (
    <Card title="About this channel">
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Fact label="Channel created" value={profile.createdAt ? formatDate(profile.createdAt) : null} />
        <Fact label="First video" value={firstUpload} />
        <Fact label="Handle" value={profile.handle} />
        <Fact label="Country" value={displayName(regionNames, profile.country)} />
        <Fact label="Language" value={displayName(languageNames, profile.language)} />
      </dl>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Total views" value={profile.totalViews === null ? '—' : formatCompact(profile.totalViews)} />
        <Stat label="Subscribers" value={profile.subscribers === null ? 'Hidden' : formatCompact(profile.subscribers)} />
        <Stat label="Public videos" value={profile.videoCount === null ? '—' : formatCompact(profile.videoCount)} />
      </div>
      {(profile.topics.length > 0 || overview.categories.length > 0) && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-300">Niche</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.topics.map((t) => (
              <Badge key={t} tone="info" title="YouTube’s topic for this channel">
                {t}
              </Badge>
            ))}
            {overview.categories.map((c) => (
              <Badge key={c.name} title="Category set on its recent videos">
                {c.name} · {Math.round(c.share * 100)}%
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-300">Channel keywords</p>
          {profile.keywords.length > 0 && <CopyButton text={profile.keywords.join(', ')} label="Copy keywords" />}
        </div>
        {profile.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {profile.keywords.map((k) => (
              <Badge key={k} dot={false}>
                {k}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">This channel hasn’t set any keywords.</p>
        )}
      </div>
      {profile.description && (
        <div className="space-y-1">
          <p className={`text-sm text-zinc-400 whitespace-pre-line ${open ? '' : 'line-clamp-3'}`}>{profile.description}</p>
          <button type="button" onClick={() => setOpen(!open)} className="text-sm text-zinc-300 hover:text-white underline underline-offset-2">
            {open ? 'Show less' : 'Show full description'}
          </button>
        </div>
      )}
    </Card>
  );
}

function UploadsChart({ overview }: { overview: ChannelOverview }) {
  const data = overview.uploadsByMonth;
  if (data.length < 2) return null;
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const hint = overview.firstUploadAt
    ? `Every upload since its first video (${formatCompact(overview.uploadsRead)} in all).`
    : `Its latest ${formatCompact(overview.uploadsRead)} uploads. Older ones were not read.`;

  return (
    <Card title="Uploads per month" hint={hint}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.05)' }} labelFormatter={(m) => monthLabel(String(m))} formatter={(v) => [String(v), 'Uploads']} />
            <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function middle(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Typical (median) views of the videos published each month: one bar per month, plain scale. */
function ViewsByMonth({ videos }: { videos: OverviewVideo[] }) {
  const counts = { video: videos.filter((v) => v.format === 'video').length, short: videos.filter((v) => v.format === 'short').length };
  const [format, setFormat] = useState<'video' | 'short'>(counts.video >= counts.short ? 'video' : 'short');
  const data = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const v of videos) {
      if (v.format !== format) continue;
      const month = v.publishedAt.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), v.views]);
    }
    return Array.from(byMonth, ([month, views]) => ({ month, views: middle(views), videos: views.length })).sort((a, b) => a.month.localeCompare(b.month));
  }, [videos, format]);
  if (counts.video + counts.short < 3) return null;

  return (
    <Card title="How its videos do over time" hint="Typical views of the videos it published each month. The newest months have had less time to collect views.">
      {counts.video > 0 && counts.short > 0 && (
        <Segmented
          label="Video type"
          size="sm"
          value={format}
          onChange={setFormat}
          options={[
            { id: 'video', label: `Videos (${counts.video})` },
            { id: 'short', label: `Shorts (${counts.short})` },
          ]}
        />
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthName} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              labelFormatter={(m) => monthName(String(m))}
              formatter={(v, _name, item) => [`${formatCompact(Number(v))} views (${item.payload.videos} ${item.payload.videos === 1 ? 'video' : 'videos'})`, 'Typical']}
            />
            <Bar dataKey="views" fill="#38bdf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Its habit in the viewer's own time zone, computed in the browser. A habit, not a best time. */
function UploadHabit({ videos }: { videos: OverviewVideo[] }) {
  const { days, hours, zone } = useMemo(() => {
    const days = new Array(7).fill(0);
    const hours = new Array(8).fill(0);
    for (const v of videos) {
      const d = new Date(v.publishedAt);
      days[(d.getDay() + 6) % 7]++;
      hours[Math.floor(d.getHours() / 3)]++;
    }
    return { days, hours, zone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }, [videos]);
  if (videos.length < 5) return null;
  const clock = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h % 24 < 12 ? 'AM' : 'PM'}`;
  const hourLabel = (i: number) => `${clock(i * 3)}–${clock(i * 3 + 3)}`;

  return (
    <Card title="When it usually uploads" hint={`Its last ${videos.length} videos, in your time zone (${zone}). This shows its habit, not the best time to upload.`}>
      <div className="grid gap-6 sm:grid-cols-2">
        <ul className="space-y-2">
          {days.map((count, i) => (
            <ShareRow key={WEEKDAYS[i]} label={WEEKDAYS[i]} count={count} max={Math.max(...days)} />
          ))}
        </ul>
        <ul className="space-y-2">
          {hours.map((count, i) => (
            <ShareRow key={i} label={hourLabel(i)} count={count} max={Math.max(...hours)} wide />
          ))}
        </ul>
      </div>
    </Card>
  );
}

function LengthAndEngagement({ overview }: { overview: ChannelOverview }) {
  const e = overview.engagement;
  return (
    <Card title="Length and engagement" hint={`From its last ${overview.videos.length} videos.`}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Median views" value={e.medianViews === null ? '—' : formatCompact(e.medianViews)} />
        <Stat label="Average views" value={e.averageViews === null ? '—' : formatCompact(e.averageViews)} />
        <Stat label="Views per subscriber" value={e.viewsPerSubscriber === null ? '—' : String(e.viewsPerSubscriber)} />
        <Stat label="Likes per 1,000 views" value={e.likesPer1kViews === null ? '—' : String(e.likesPer1kViews)} />
        <Stat label="Comments per 1,000 views" value={e.commentsPer1kViews === null ? '—' : String(e.commentsPer1kViews)} />
      </div>
      {overview.lengthMix.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="font-normal py-1.5">Length</th>
              <th className="font-normal py-1.5 text-right">Videos</th>
              <th className="font-normal py-1.5 text-right">Median views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-border">
            {overview.lengthMix.map((g) => (
              <tr key={g.label} className="text-zinc-200">
                <td className="py-1.5">{g.label}</td>
                <td className="py-1.5 text-right tabular-nums">{g.count}</td>
                <td className="py-1.5 text-right tabular-nums">{g.medianViews === null ? '—' : formatCompact(g.medianViews)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function TopList({ title, videos, value }: { title: string; videos: OverviewVideo[]; value: (v: OverviewVideo) => string }) {
  if (!videos.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-zinc-300">{title}</p>
      <ul className="space-y-2">
        {videos.map((v) => (
          <li key={v.id} className="flex gap-3">
            {v.thumbnailUrl ? (
              <Image src={v.thumbnailUrl} alt="" width={96} height={54} className="w-24 aspect-video rounded-md object-cover shrink-0" />
            ) : (
              <div className="w-24 aspect-video rounded-md bg-bg-elevated shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-zinc-100 line-clamp-2">{v.title}</p>
              <p className="text-xs text-zinc-400">
                {value(v)} · {formatCompact(v.views)} views · {formatAgo((Date.now() - Date.parse(v.publishedAt)) / DAY_MS)}
              </p>
              <TextLink href={`/discover/video/${v.id}?from=competitors`}>Analyze this video</TextLink>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Public facts about a channel: profile, niche, history, views by date, habits, length, engagement, tags. */
export function ChannelOverviewSections({ overview }: { overview: ChannelOverview }) {
  return (
    <div className="space-y-6">
      <About overview={overview} />
      <UploadsChart overview={overview} />
      <ViewsByMonth videos={overview.videos} />
      <UploadHabit videos={overview.videos} />
      <LengthAndEngagement overview={overview} />
      {(overview.mostLiked.length > 0 || overview.mostCommented.length > 0) && (
        <Card title="What viewers react to most">
          <div className="grid gap-6 md:grid-cols-2">
            <TopList title="Most liked" videos={overview.mostLiked} value={(v) => `${formatCompact(v.likes ?? 0)} likes`} />
            <TopList title="Most commented" videos={overview.mostCommented} value={(v) => `${formatCompact(v.comments ?? 0)} comments`} />
          </div>
        </Card>
      )}
      {overview.topTags.length > 0 && (
        <Card title="Tags it uses most" hint="Tags on two or more of its recent videos, with how many used each.">
          <CopyButton text={overview.topTags.map((t) => t.tag).join(', ')} label="Copy tags" />
          <div className="flex flex-wrap gap-1.5">
            {overview.topTags.map((t) => (
              <Badge key={t.tag} dot={false}>
                {t.tag} · {t.count}
              </Badge>
            ))}
          </div>
        </Card>
      )}
      <p className="text-sm text-zinc-500">
        Viewer ages, countries, traffic sources and view or subscriber history are private to the channel’s owner, so they are not shown here.
      </p>
    </div>
  );
}
