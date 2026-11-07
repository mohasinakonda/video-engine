'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { PickerPanel } from '@/components/viral-engine/picker-panel';
import { ViralReportView } from '@/components/viral-engine/report-view';
import { useViralEngine } from '@/components/viral-engine/use-viral-engine';
import type { ConnectionState } from '@/components/youtube-doctor/types';
import { useAuth } from '@/contexts/auth-context';

interface ViralConfig {
  enabled: boolean;
  hasAccess: boolean;
  cost: number;
  maxDurationSec: number;
  maxBodyFrames: number;
}

type LoadState = 'loading' | 'ready' | 'error';

export default function ViralEnginePage() {
  const { user } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [config, setConfig] = useState<ViralConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [picking, setPicking] = useState(false);

  const engine = useViralEngine(user?.id ?? null, config);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [configRes, connRes] = await Promise.all([fetch('/api/viral-engine/config'), fetch('/api/youtube/connection')]);
      if (!configRes.ok) throw new Error('load failed');
      setConfig(await configRes.json());
      const conn: ConnectionState | null = connRes.ok ? await connRes.json() : null;
      setConnected(Boolean(conn?.connected && conn.connection.status === 'active'));
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showReport = engine.result && !picking && engine.phase === 'idle';

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-6">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              <Rocket size={22} className="text-emerald-400" />
              Viral Engine
            </h1>
            <p className="page-subtitle text-base">See, second by second, where your Short loses viewers and what to fix.</p>
          </div>
        </header>

        {loadState === 'loading' && (
          <div className="card flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-zinc-400" />
          </div>
        )}

        {loadState === 'error' && (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle size={22} className="text-rose-400" />
            <p className="text-sm text-zinc-300">Could not load Viral Engine. Check your connection and try again.</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm">
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {loadState === 'ready' && config && !config.enabled && (
          <div className="card text-sm text-zinc-300">Viral Engine isn’t available yet. Please check back later.</div>
        )}

        {loadState === 'ready' && config?.enabled && !config.hasAccess && (
          <div className="card space-y-3 text-sm text-zinc-300">
            <p>Viral Engine is not included in your current plan.</p>
            <Link href="/plan" className="btn-primary btn-sm inline-flex">
              See plans
            </Link>
          </div>
        )}

        {loadState === 'ready' && config?.enabled && config.hasAccess && (
          <>
            {showReport && engine.result ? (
              <>
              {engine.error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {engine.error.message}
                </div>
              )}
              <ViralReportView
                result={engine.result}
                media={engine.media}
                restoring={engine.restoring}
                onRestore={engine.restoreMedia}
                onFormat={engine.setFormat}
                onNew={() => setPicking(true)}
              />
              </>
            ) : (
              <>
                <PickerPanel
                  cost={config.cost}
                  maxDurationSec={config.maxDurationSec}
                  connected={connected}
                  phase={engine.phase}
                  extract={engine.extract}
                  stages={engine.stages}
                  error={engine.error}
                  onRun={async (input) => {
                    if (await engine.run(input)) setPicking(false);
                  }}
                  onCancel={engine.cancel}
                />
                {engine.result && engine.phase === 'idle' && (
                  <button type="button" onClick={() => setPicking(false)} className="text-sm text-zinc-400 hover:text-white">
                    Back to the last report
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
