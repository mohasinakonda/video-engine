'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanSearch } from 'lucide-react';
import { resolveTarget } from '@/lib/youtube/audit/resolve';

/** Paste any YouTube video link to analyze it. Channel analysis comes later (A4). */
export function AnalyzeLink({ from }: { from: 'competitors' | 'market' }) {
  const router = useRouter();
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const go = () => {
    const target = resolveTarget(link);
    if (!target) return setError('Paste a YouTube video link, like youtube.com/watch?v=… or youtu.be/…');
    if (target.kind !== 'video') return setError('That’s a channel. For now, paste a link to one of its videos.');
    router.push(`/discover/video/${target.videoId}?from=${from}`);
  };

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
          <ScanSearch size={17} className="text-amber-300" />
          Analyze any video
        </h3>
        <p className="text-sm text-zinc-400">See why a video did well or badly: its title, thumbnail, description and what viewers say.</p>
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
          placeholder="https://youtu.be/…"
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
