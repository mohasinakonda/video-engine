'use client';

import { useEffect, useState } from 'react';
import { runStream, type StreamFailure } from '@/components/create/run-stream';
import { useAuth } from '@/contexts/auth-context';
import { loadReport, reportKey, saveReport } from '@/lib/channel-doctor-storage';
import type { AuditConfig } from './types';

const NO_ACCESS: AuditConfig = { enabled: false, hasAccess: false, costs: { video: 0, channel: 0, compare: 0 } };

/**
 * Runs one audit on request and keeps the result in this tab (cleared on sign-out and
 * disconnect, like Channel Doctor's reports). Nothing runs, or is charged, until `run`.
 */
export function useAudit<T>(kind: 'video' | 'channel' | 'compare', ref: string, endpoint: string, body: () => object) {
  const { user } = useAuth();
  const [config, setConfig] = useState<AuditConfig | null>(null);
  const [report, setReport] = useState<{ result: T; analyzedAt: string } | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [failure, setFailure] = useState<StreamFailure | null>(null);
  const key = user ? reportKey(user.id, 'audit', kind, ref) : null;

  useEffect(() => {
    fetch('/api/youtube/discover/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfig(d?.audit ?? NO_ACCESS))
      .catch(() => setConfig(NO_ACCESS));
  }, []);

  useEffect(() => {
    if (key) setReport(loadReport<T>(key));
  }, [key]);

  const run = async () => {
    setFailure(null);
    setStage('connect');
    const out = await runStream<T>(endpoint, body(), setStage);
    setStage(null);
    if (!out.ok) return setFailure(out.error);
    if (key) saveReport(key, out.data);
    setReport({ result: out.data, analyzedAt: new Date().toISOString() });
  };

  return { config, report, stage, failure, run };
}
