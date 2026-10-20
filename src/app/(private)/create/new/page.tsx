'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AccessGate } from '@/components/create/access-gate';
import { VideoPrice } from '@/components/create/video-price';
import { useCreateConfig } from '@/components/create/use-create-config';

/** Start a video from your own idea. Ideas from Discover start from the idea's page instead. */
export default function NewProjectPage() {
  const router = useRouter();
  const { config, error } = useCreateConfig();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // A starting title passed from elsewhere (e.g. "Start my version" on a video analysis).
  useEffect(() => {
    const passed = new URLSearchParams(window.location.search).get('title');
    if (passed) setTitle(passed.slice(0, 200));
  }, []);

  const create = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/create/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: 'manual', title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create the project.');
      window.dispatchEvent(new Event('credits_updated'));
      router.push(`/create/${data.project.id}`);
    } catch (err) {
      setMessage((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-3xl space-y-6">
        <Link href="/create" className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to Create
        </Link>
        <AccessGate config={config} error={error}>
          <section className="card space-y-4">
            <h1 className="text-2xl font-bold text-white">What’s the video about?</h1>
            <p className="text-base text-zinc-400">A working title or topic is enough. You’ll plan the rest in the brief.</p>
            <input
              className="input text-lg"
              value={title}
              maxLength={200}
              autoFocus
              placeholder="e.g. How deep-sea animals survive without sunlight"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && title.trim() && !busy && create()}
            />
            {message && <p className="text-sm text-rose-400">{message}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary px-5" disabled={!title.trim() || busy} onClick={create}>
                {busy && <Loader2 size={16} className="animate-spin" />}
                Start this video
              </button>
              <Link href="/discover?tab=next" className="btn-ghost">
                Or pick an idea from Discover
              </Link>
            </div>
            {config && <VideoPrice config={config} />}
          </section>
        </AccessGate>
      </div>
    </div>
  );
}
