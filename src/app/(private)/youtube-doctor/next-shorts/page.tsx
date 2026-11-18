'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { loadReport, reportKey } from '@/lib/channel-doctor-storage';
import type { ViewsCheckResult } from '@/lib/youtube/views-check/run';
import type { ConnectionState } from '@/components/youtube-doctor/types';
import { NextShorts } from '@/components/youtube-doctor/views-check/next-shorts';

/** Next video ideas: new Shorts from the views check in this tab, and the last ideas made. */
export default function NextShortsPage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [viewsCheck, setViewsCheck] = useState<ViewsCheckResult | null>(null);

  useEffect(() => {
    fetch('/api/youtube/connection')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setConnection)
      .catch(() => setConnection({ connected: false }));
  }, []);

  const channelId = connection?.connected ? connection.connection.channelId : null;
  useEffect(() => {
    if (!user || !channelId) return;
    setViewsCheck(loadReport<ViewsCheckResult>(reportKey(user.id, channelId, 'views-check'))?.result ?? null);
  }, [user, channelId]);

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl space-y-5">
        <Link href="/youtube-doctor?tab=views" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Performance
        </Link>
        {!connection || !user ? (
          <div className="card flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-zinc-400" aria-label="Loading" />
          </div>
        ) : !channelId ? (
          <div className="card text-sm text-zinc-300">
            Connect YouTube first on the{' '}
            <Link href="/youtube-doctor" className="underline">
              Channel Doctor
            </Link>{' '}
            page.
          </div>
        ) : (
          <NextShorts result={viewsCheck} userId={user.id} channelId={channelId} />
        )}
      </div>
    </div>
  );
}
