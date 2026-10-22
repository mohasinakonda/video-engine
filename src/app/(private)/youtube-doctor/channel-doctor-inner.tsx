'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, RefreshCw, Stethoscope } from 'lucide-react';
import { IntroCard } from '@/components/youtube-doctor/intro-card';
import { ChannelCard } from '@/components/youtube-doctor/channel-card';
import { DisconnectDialog } from '@/components/youtube-doctor/disconnect-dialog';
import { OAuthResultBanner } from '@/components/youtube-doctor/oauth-result-banner';
import type { ConnectionState, DoctorConfig } from '@/components/youtube-doctor/types';
import { AnalysisPanel } from '@/components/youtube-doctor/analysis-panel';
import { ReportView } from '@/components/youtube-doctor/report-view';
import { useDiagnosis } from '@/components/youtube-doctor/use-diagnosis';
import { useAuth } from '@/contexts/auth-context';
import { clearAllReports } from '@/lib/channel-doctor-storage';
import type { RangeKey } from '@/lib/youtube/types';

type LoadState = 'loading' | 'ready' | 'error';

export default function ChannelDoctorInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [outcome, setOutcome] = useState<string | null>(searchParams.get('yt'));

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [state, setState] = useState<ConnectionState>({ connected: false });
  const [config, setConfig] = useState<DoctorConfig | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [range, setRange] = useState<RangeKey>('28d');

  const { user } = useAuth();
  const channelId = state.connected && state.connection.status === 'active' ? state.connection.channelId : null;
  const diagnosis = useDiagnosis(user?.id ?? null, channelId, range);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [connRes, configRes] = await Promise.all([fetch('/api/youtube/connection'), fetch('/api/youtube/config')]);
      if (!connRes.ok || !configRes.ok) throw new Error('load failed');
      setState(await connRes.json());
      setConfig(await configRes.json());
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Drop ?yt= from the address bar once read, so a refresh doesn't show the banner again.
  useEffect(() => {
    if (searchParams.get('yt')) router.replace(pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const disconnect = async () => {
    const res = await fetch('/api/youtube/connection', { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not disconnect.');
    clearAllReports();
    return { revokedAtGoogle: Boolean(data.revokedAtGoogle) };
  };

  const closeDisconnect = () => {
    setShowDisconnect(false);
    load();
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <Stethoscope size={22} className="text-emerald-400" />
              Channel Doctor
            </h1>
            <p className="page-subtitle text-base">Find out what holds your channel back, and what to fix first.</p>
          </div>
        </header>

        <OAuthResultBanner outcome={outcome} onDismiss={() => setOutcome(null)} />

        {loadState === 'loading' && (
          <div className="card flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-zinc-400" />
          </div>
        )}

        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle size={22} className="text-rose-400" />
            <p className="text-sm text-zinc-300">Could not load Channel Doctor. Check your connection and try again.</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm">
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {loadState === 'ready' && config && !config.enabled && (
          <div className="card text-sm text-zinc-300">Channel Doctor is temporarily unavailable. Please check back later.</div>
        )}

        {loadState === 'ready' && config?.enabled && !state.connected && <IntroCard canConnect />}

        {loadState === 'ready' && config?.enabled && state.connected && (
          <ChannelCard
            connection={state.connection}
            stats={state.stats}
            onDisconnect={() => setShowDisconnect(true)}
          >
            {config.hasAccess || config.freeDiagnosesLeft > 0 ? (
              <AnalysisPanel
                range={range}
                onRangeChange={setRange}
                cost={config.hasAccess ? config.diagnosisCost : 0}
                running={diagnosis.running}
                stages={diagnosis.stages}
                error={diagnosis.error}
                hasReport={Boolean(diagnosis.saved)}
                onRun={async () => {
                  await diagnosis.run();
                  // A free diagnosis was just used: refresh what's left, quietly.
                  if (!config.hasAccess) {
                    const res = await fetch('/api/youtube/config').catch(() => null);
                    if (res?.ok) setConfig(await res.json());
                  }
                }}
              />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-bg-border">
                <p className="flex-1 text-sm text-zinc-400">
                  {config.tier === 'TRIAL' && config.freeDiagnosesLeft === 0 && diagnosis.saved ? 'That was your free diagnosis. ' : ''}
                  Channel analysis is available on the {config.allowedPlans.map(planLabel).join(', ')} plan
                  {config.allowedPlans.length > 1 ? 's' : ''}.
                </p>
                <Link href="/plan" className="btn-primary btn-sm">
                  Upgrade plan
                </Link>
              </div>
            )}
          </ChannelCard>
        )}

        {loadState === 'ready' && config?.enabled && state.connected && diagnosis.saved && !diagnosis.running && (
          <ReportView
            result={diagnosis.saved.result}
            analyzedAt={diagnosis.saved.analyzedAt}
            onSelectVideo={(videoId) => router.push(`/youtube-doctor/video/${videoId}?range=${range}`)}
          />
        )}

        {showDisconnect && state.connected && (
          <DisconnectDialog
            channelTitle={state.connection.title}
            onClose={closeDisconnect}
            onConfirm={disconnect}
          />
        )}
      </div>
    </div>
  );
}

function planLabel(tier: string) {
  return tier === 'STUDIO' ? 'Studio' : tier.charAt(0) + tier.slice(1).toLowerCase();
}
