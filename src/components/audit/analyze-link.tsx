'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanSearch } from 'lucide-react';
import { resolveTarget } from '@/lib/youtube/audit/resolve';

/** Paste any YouTube video or channel link (or @handle) to analyze it. */
export function AnalyzeLink({ from }: { from: 'competitors' | 'market' }) {
  const router = useRouter();
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const go = () => {
    const target = resolveTarget(link);
    if (!target) return setError('Paste a YouTube video or channel link, or an @handle.');
    if (target.kind === 'video') router.push(`/discover/video/${target.videoId}?from=${from}`);
    else router.push(`/discover/channel/${encodeURIComponent(target.kind === 'channel' ? target.channelId : target.handle)}?from=${from}`);
  };

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
          <ScanSearch size={17} className="text-amber-300" />
          Analyze any video or channel
        </h3>
        <p className="text-sm text-zinc-400">A video: why it did well or badly. A channel: what works there, and how it compares with yours.</p>
      </div>
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <input
          className="input text-base flex-1"
          value={link}
          placeholder="Video link, channel link or @handle"
          onChange={(e) => {
            setLink(e.target.value);
            setError('');
          }}
        />
        <button type="submit" className="btn-secondary" disabled={!link.trim()}>
          Analyze
        </button>
      </form>
      {error && <p className="text-sm text-amber-300">{error}</p>}
    </section>
  );
}
