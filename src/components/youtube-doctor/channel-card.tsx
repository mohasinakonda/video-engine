'use client';

import Image from 'next/image';
import { AlertCircle, ExternalLink, Unplug, Youtube } from 'lucide-react';
import { CONNECT_URL } from './intro-card';
import type { ChannelStats, PublicConnection } from './types';

const numberFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

interface ChannelCardProps {
  connection: PublicConnection;
  stats: ChannelStats | null;
  onDisconnect: () => void;
  children?: React.ReactNode;
}

/** Screen 3: the connected channel's identity, status and actions. */
export function ChannelCard({ connection, stats, onDisconnect, children }: ChannelCardProps) {
  const needsReauth = connection.status !== 'active';
  const url = stats?.url || connection.url;

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {connection.thumbnail ? (
          <Image
            src={connection.thumbnail}
            alt=""
            width={56}
            height={56}
            className="w-14 h-14 rounded-full border border-bg-border object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center">
            <Youtube size={22} className="text-zinc-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white truncate">{connection.title || 'Your channel'}</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                needsReauth
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {needsReauth ? 'Reconnect needed' : 'Connected'}
            </span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1"
          >
            {url.replace('https://www.', '')}
            <ExternalLink size={11} />
          </a>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
            <div className="flex gap-1">
              <dt>Subscribers:</dt>
              <dd className="text-zinc-200 font-medium">
                {stats?.subscriberCount != null ? numberFormat.format(stats.subscriberCount) : 'Not available'}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>Videos:</dt>
              <dd className="text-zinc-200 font-medium">
                {stats?.videoCount != null ? numberFormat.format(stats.videoCount) : 'Not available'}
              </dd>
            </div>
          </dl>
        </div>

        <button type="button" onClick={onDisconnect} className="btn-ghost text-sm self-start sm:self-center">
          <Unplug size={14} />
          Disconnect
        </button>
      </div>

      {needsReauth ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <p className="flex-1 text-base text-amber-100">
            We lost access to this channel. Reconnect to check it again.
          </p>
          <a href={CONNECT_URL} className="btn-primary">
            Reconnect YouTube
          </a>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
