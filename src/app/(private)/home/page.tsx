'use client';

/**
 * Home: where a creator lands after signing in. What changed on the channel (from the views check
 * kept in this tab), the four main jobs, the next Shorts already made, and the last things opened.
 * Everything comes from what the browser already keeps: no analysis is stored on our servers.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, AudioLines, Lightbulb, TrendingDown, Users, Youtube } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { loadNextShorts, loadReport, nextShortsKey, reportKey } from '@/lib/channel-doctor-storage';
import type { ConnectionState } from '@/components/youtube-doctor/types';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import type { NextShortsPack } from '@/lib/youtube/next-shorts/types';
import { Skeleton, SkeletonBox } from '@/components/ui/skeleton';

/** Kept in step with VIEWS_CHECK_VERSION in run.ts (not imported: run.ts is server code). */
const REPORT_VERSION = 20;

interface Flags {
  viewsCheck: boolean;
  viewsCost: number | null;
  discover: boolean;
  discoveryCost: number | null;
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [flags, setFlags] = useState<Flags | null>(null);
  const [check, setCheck] = useState<{ analyzedAt: string; result: ViewsCheckResult } | null>(null);
  const [pack, setPack] = useState<NextShortsPack | null>(null);
  const [discoveredAt, setDiscoveredAt] = useState<string | null>(null);

  useEffect(() => {
    json<ConnectionState>('/api/youtube/connection').then((c) => setConnection(c ?? { connected: false }));
    Promise.all([
      json<{ enabled?: boolean; viewsCheckEnabled?: boolean; viewsCheckCost?: number }>('/api/youtube/config'),
      json<{ enabled?: boolean; costs?: { discovery?: number } }>('/api/youtube/discover/config'),
    ]).then(([doctor, discover]) =>
      setFlags({
        viewsCheck: Boolean(doctor?.enabled && doctor?.viewsCheckEnabled),
        viewsCost: doctor?.viewsCheckCost ?? null,
        discover: Boolean(discover?.enabled) || isAdmin,
        discoveryCost: discover?.costs?.discovery ?? null,
      }),
    );
  }, [isAdmin]);

  const channelId = connection?.connected ? connection.connection.channelId : null;
  useEffect(() => {
    if (!user || !channelId) return;
    const saved = loadReport<ViewsCheckResult>(reportKey(user.id, channelId, 'views-check'));
    setCheck(saved?.result?.version === REPORT_VERSION ? saved : null);
    const ideas = loadNextShorts<NextShortsPack>(nextShortsKey(user.id, channelId));
    setPack(ideas?.version === 3 ? ideas : null);
    setDiscoveredAt(loadReport(reportKey(user.id, channelId, 'discovery'))?.analyzedAt ?? null);
  }, [user, channelId]);

  const recent = useMemo(() => {
    const items: { title: string; href: string; at: string; dot: string }[] = [];
    if (check) items.push({ title: 'Views check', href: '/youtube-doctor?tab=views', at: check.analyzedAt, dot: 'bg-amber-400' });
    if (pack) items.push({ title: `Next Shorts: ${pack.shorts.length} ideas`, href: '/youtube-doctor/next-shorts', at: pack.generatedAt, dot: 'bg-emerald-400' });
    if (discoveredAt) items.push({ title: 'Competitors', href: '/discover', at: discoveredAt, dot: 'bg-zinc-400' });
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [check, pack, discoveredAt]);

  const loading = !connection || !flags || !user;

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Home</h1>
          {connection?.connected && (
            <Link
              href="/youtube-doctor"
              className="inline-flex items-center gap-2 rounded-full border border-bg-border bg-bg-surface py-1.5 pl-1.5 pr-3 text-sm font-semibold text-white hover:bg-bg-hover"
            >
              {connection.connection.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={connection.connection.thumbnail} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Youtube size={16} aria-hidden="true" />
              )}
              {connection.connection.title ?? 'Your channel'}
            </Link>
          )}
        </header>

        {loading ? (
          <HomeSkeleton />
        ) : (
          <>
            <ChannelStatus connected={Boolean(channelId)} check={check?.result ?? null} viewsCheck={flags.viewsCheck} />

            <nav aria-label="Quick actions" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile
                href={flags.viewsCheck ? '/youtube-doctor?tab=views' : '/youtube-doctor'}
                icon={TrendingDown}
                title="Check views"
                note={flags.viewsCost ? `${flags.viewsCost} credits` : null}
              />
              {(flags.viewsCheck || isAdmin) && <Tile href="/youtube-doctor/next-shorts" icon={Lightbulb} title="Next Shorts" note={pack ? `${pack.shorts.length} ready` : null} />}
              <Tile href="/voice-studio" icon={AudioLines} title="Voiceover" note={null} />
              {flags.discover && <Tile href="/discover" icon={Users} title="Competitors" note={flags.discoveryCost ? `${flags.discoveryCost} credits` : null} />}
            </nav>

            {(pack || recent.length > 0) && (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-5">
                {pack && (
                  <section aria-labelledby="ideas-h" className="card p-4 lg:col-span-3">
                    <div className="flex items-center justify-between pb-2">
                      <h2 id="ideas-h" className="text-sm font-bold text-white">
                        Next Shorts
                      </h2>
                      <Link href="/youtube-doctor/next-shorts" className="text-xs font-medium text-zinc-400 hover:text-white">
                        See all
                      </Link>
                    </div>
                    <ol>
                      {pack.shorts.slice(0, 3).map((s) => (
                        <li key={s.id} className="flex items-center gap-3 border-t border-bg-border py-2.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{s.packagingOptions?.titles?.[0]?.title ?? s.name}</span>
                          <span className="shrink-0 rounded-md bg-bg-elevated px-1.5 py-0.5 text-xs font-semibold text-zinc-400">{s.seconds}s</span>
                          <Link href="/youtube-doctor/next-shorts" className="btn-secondary btn-sm shrink-0">
                            Make
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                {recent.length > 0 && (
                  <section aria-labelledby="recent-h" className={`card p-4 ${pack ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
                    <h2 id="recent-h" className="pb-2 text-sm font-bold text-white">
                      Recent
                    </h2>
                    <ul>
                      {recent.map((r) => (
                        <li key={r.title} className="border-t border-bg-border">
                          <Link href={r.href} className="flex items-center gap-2.5 py-2.5 text-sm text-zinc-200 hover:text-white">
                            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
                            <span className="min-w-0 flex-1 truncate">{r.title}</span>
                            <span className="shrink-0 text-xs text-zinc-500">{ago(r.at)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The one line on top: connect, run a check, or what the last check found. */
function ChannelStatus({ connected, check, viewsCheck }: { connected: boolean; check: ViewsCheckResult | null; viewsCheck: boolean }) {
  if (!connected) {
    return (
      <StatusRow icon={<Youtube size={18} aria-hidden="true" />} title="Connect your channel to start">
        <Link href="/youtube-doctor" className="btn-primary">
          Connect YouTube
        </Link>
      </StatusRow>
    );
  }
  if (!check) {
    return (
      <StatusRow icon={<TrendingDown size={18} aria-hidden="true" />} title="See why your views stop" note="Run a check: it reads your latest videos.">
        <Link href={viewsCheck ? '/youtube-doctor?tab=views' : '/youtube-doctor'} className="btn-primary">
          Check views
        </Link>
      </StatusRow>
    );
  }
  return (
    <section aria-label="Channel status" className="flex flex-wrap items-center gap-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
        <TrendingDown size={18} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
        <strong className="text-[15px] text-white">{check.wording.headline}</strong>
        <span className="line-clamp-1 text-sm text-amber-300">{check.report.verdict.firstStep}</span>
      </span>
      <Link href="/youtube-doctor?tab=views" className="text-sm font-semibold text-white hover:underline">
        Details
      </Link>
      <Link href="/youtube-doctor/next-shorts" className="btn-primary">
        Fix in next Shorts
      </Link>
    </section>
  );
}

function StatusRow({ icon, title, note, children }: { icon: ReactNode; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-label="Get started" className="card flex flex-wrap items-center gap-3.5 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-white">{icon}</span>
      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <strong className="text-[15px] text-white">{title}</strong>
        {note && <span className="text-sm text-zinc-400">{note}</span>}
      </span>
      {children}
    </section>
  );
}

function Tile({ href, icon: Icon, title, note }: { href: string; icon: typeof TrendingDown; title: string; note: string | null }) {
  return (
    <Link href={href} className="card card-interactive group flex items-center gap-3 p-3.5 hover:shadow-md">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-white">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-sm text-white underline-offset-4 group-hover:underline">{title}</strong>
        {note && <span className="text-xs font-semibold text-emerald-400">{note}</span>}
      </span>
      <ArrowUpRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
      />
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <SkeletonBox label="Loading your home…" className="space-y-5">
      <Skeleton height={68} borderRadius="0.75rem" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={70} borderRadius="0.75rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Skeleton height={180} borderRadius="0.75rem" containerClassName="lg:col-span-3" />
        <Skeleton height={180} borderRadius="0.75rem" containerClassName="lg:col-span-2" />
      </div>
    </SkeletonBox>
  );
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}
