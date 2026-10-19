'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Compass, Lightbulb, Loader2, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { CompetitorsPanel } from '@/components/discover/competitors-panel';
import type { DiscoverConfig } from '@/components/discover/types';
import type { ConnectionState } from '@/components/youtube-doctor/types';
import { useAuth } from '@/contexts/auth-context';

type Tab = 'next' | 'market' | 'competitors';

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: 'next', label: 'Next videos', icon: Lightbulb },
  { id: 'market', label: 'Market', icon: TrendingUp },
  { id: 'competitors', label: 'Competitors', icon: Users },
];

export default function DiscoverInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [config, setConfig] = useState<DiscoverConfig | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeCompetitors, setActiveCompetitors] = useState<number | null>(null);
  const requested = searchParams.get('tab') as Tab | null;
  const tab: Tab = requested && TABS.some((t) => t.id === requested) ? requested : 'competitors';

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [cfg, conn] = await Promise.all([fetch('/api/youtube/discover/config'), fetch('/api/youtube/connection')]);
      if (!cfg.ok || !conn.ok) throw new Error();
      setConfig(await cfg.json());
      setConnection(await conn.json());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setTab = (id: Tab) => router.replace(`${pathname}?tab=${id}`, { scroll: false });
  const channelId = connection?.connected && connection.connection.status === 'active' ? connection.connection.channelId : null;

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <Compass size={22} className="text-emerald-400" />
              Discover
            </h1>
            <p className="page-subtitle text-base">Find what to make next, from what works on your channel and in your market.</p>
          </div>
        </header>

        {loadError ? (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle size={22} className="text-rose-400" />
            <p className="text-base text-zinc-300">Could not load Discover. Check your connection and try again.</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm">
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : !config || !connection ? (
          <div className="card flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-zinc-400" />
          </div>
        ) : !config.hasAccess ? (
          <div className="card space-y-3">
            {config.enabled ? (
              <>
                <p className="text-base text-zinc-200">
                  Discover is available on the {config.allowedPlans.map(planLabel).join(', ')} plan{config.allowedPlans.length > 1 ? 's' : ''}.
                </p>
                <Link href="/plan" className="btn-primary btn-sm w-fit">
                  Upgrade plan
                </Link>
              </>
            ) : (
              <p className="text-base text-zinc-300">Discover is coming soon.</p>
            )}
          </div>
        ) : !channelId || !user ? (
          <div className="card space-y-3">
            <p className="text-base text-zinc-200">
              {connection.connected ? 'Reconnect your YouTube channel first.' : 'Connect your YouTube channel first.'} Discover compares your channel with
              others, so it needs to read your videos.
            </p>
            <Link href="/youtube-doctor" className="btn-primary btn-sm w-fit">
              Go to Channel Doctor
            </Link>
          </div>
        ) : (
          <>
            {config.adminPreview && (
              <p className="text-sm text-amber-200 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                Admin preview: Discover is switched off for users. Turn it on in Admin → Channel Doctor.
              </p>
            )}

            <nav className="flex gap-1 p-1 rounded-xl bg-bg-elevated border border-bg-border w-fit max-w-full overflow-x-auto" aria-label="Discover sections">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={`px-4 py-2 rounded-lg text-base font-semibold inline-flex items-center gap-2 whitespace-nowrap ${
                    tab === id ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'competitors' && (
              <CompetitorsPanel userId={user.id} channelId={channelId} config={config} onCountChange={setActiveCompetitors} />
            )}
            {tab !== 'competitors' && <ResearchComingNext activeCompetitors={activeCompetitors} onAdd={() => setTab('competitors')} />}
          </>
        )}
      </div>
    </div>
  );
}

/** Market research arrives in the next milestone; say so plainly instead of showing anything fake. */
function ResearchComingNext({ activeCompetitors, onAdd }: { activeCompetitors: number | null; onAdd: () => void }) {
  const needMore = activeCompetitors !== null && activeCompetitors < 2;
  return (
    <section className="card space-y-3">
      <h2 className="text-xl font-bold text-white">What should you make next?</h2>
      <p className="text-base text-zinc-300">
        Market research compares your channel with your competitors to find topics that are working for them and missing on your channel.
      </p>
      {needMore ? (
        <>
          <p className="text-base text-zinc-300">First, add at least 2 competitors.</p>
          <button type="button" onClick={onAdd} className="btn-primary btn-sm w-fit">
            Add competitors
          </button>
        </>
      ) : (
        <p className="text-sm text-zinc-400">Research is being built and will appear here soon.</p>
      )}
    </section>
  );
}

function planLabel(tier: string) {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}
