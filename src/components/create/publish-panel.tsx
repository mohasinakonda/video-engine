'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, Check, ClipboardCopy, ExternalLink, Hammer, Link2, Loader2, Search, Unlink } from 'lucide-react';
import { THUMBNAIL_FIELDS, packagingSchema, packagingToText } from '@/lib/youtube/create/packaging';
import type { Candidate, Upload } from '@/lib/youtube/create/publish';
import type { PublishedLink } from '@/lib/youtube/create/published-videos';
import type { VideoProject } from './types';

const PRIVACY_TEXT: Record<Upload['privacy'], string> = { public: 'Public', unlisted: 'Unlisted', private: 'Private' };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Who the error message should send where. */
function errorText(data: { error?: string; code?: string }, fallback: string) {
  return { message: data.error || fallback, code: data.code };
}

type Failure = { message: string; code?: string };

/** Before publishing: what to copy into YouTube, and marking the video as in production. */
export function PublishChecklist({ project, onProject }: { project: VideoProject; onProject: (p: VideoProject) => void }) {
  const parsed = packagingSchema.safeParse(project.packaging);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!parsed.success) return null;
  const p = parsed.data;
  const title = p.selectedTitle !== null ? p.titles[p.selectedTitle].title : '';
  const thumb = p.selectedThumbnail !== null ? p.thumbnails[p.selectedThumbnail] : null;

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked.
    }
  };
  const setStatus = async (action: 'start_production' | 'back_to_packaging') => {
    setBusy(true);
    const res = await fetch(`/api/create/projects/${project.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setBusy(false);
    if (res.ok) onProject((await res.json()).project);
  };

  const rows: { key: string; label: string; value: string }[] = [
    { key: 'title', label: 'Title', value: title },
    { key: 'description', label: 'Description', value: p.description },
    { key: 'tags', label: 'Tags', value: p.tags.join(', ') },
  ];

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">What goes into YouTube</h2>
        <button type="button" className="btn-secondary btn-sm" onClick={() => copy('all', packagingToText(p))}>
          {copied === 'all' ? <Check size={14} /> : <ClipboardCopy size={14} />}
          Copy all
        </button>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-400">{r.label}</p>
              <p className={`text-base whitespace-pre-line ${r.value ? 'text-zinc-100' : 'text-zinc-500'} ${r.key === 'description' ? 'line-clamp-4' : ''}`}>{r.value || 'Empty'}</p>
            </div>
            <button type="button" className="btn-ghost btn-xs mt-5" disabled={!r.value} onClick={() => copy(r.key, r.value)} aria-label={`Copy ${r.label.toLowerCase()}`}>
              {copied === r.key ? <Check size={13} /> : <ClipboardCopy size={13} />}
            </button>
          </li>
        ))}
        {thumb && (
          <li>
            <p className="text-sm font-semibold text-zinc-400">Thumbnail</p>
            <p className="text-base text-zinc-100">
              {THUMBNAIL_FIELDS.filter((f) => thumb[f.key])
                .slice(0, 4)
                .map((f) => thumb[f.key])
                .join(' · ')}
            </p>
          </li>
        )}
      </ul>
      <div className="pt-1 border-t border-bg-border flex flex-wrap items-center gap-3">
        {project.status === 'PACKAGED' ? (
          <>
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => setStatus('start_production')}>
              <Hammer size={14} />
              I’m making this video
            </button>
            <span className="text-sm text-zinc-500">Optional. We’ll look out for it on your channel.</span>
          </>
        ) : (
          <>
            <span className="text-sm text-emerald-300 inline-flex items-center gap-1.5">
              <Hammer size={14} />
              In production. We’ll spot it when it’s uploaded.
            </span>
            <button type="button" className="btn-ghost btn-xs" disabled={busy} onClick={() => setStatus('back_to_packaging')}>
              Not making it yet
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** After publishing: find the video on the connected channel, confirm it, or paste a link. */
export function FindVideo({ project, onLinked }: { project: VideoProject; onLinked: (p: VideoProject) => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pasted, setPasted] = useState('');
  const [linking, setLinking] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const find = async () => {
    setState('loading');
    setFailure(null);
    const res = await fetch(`/api/create/projects/${project.id}/publish-candidates`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState('idle');
      return setFailure(errorText(data, 'Couldn’t read your recent uploads.'));
    }
    setCandidates(data.candidates);
    setSuggestion(data.suggestion);
    setShowAll(!data.suggestion);
    setState('ready');
  };

  const link = async (video: string, method: 'suggested' | 'picked' | 'pasted') => {
    setLinking(video);
    setFailure(null);
    const res = await fetch(`/api/create/projects/${project.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video, method }) });
    const data = await res.json().catch(() => ({}));
    setLinking(null);
    if (!res.ok) return setFailure(errorText(data, 'Couldn’t link that video.'));
    onLinked(data.project);
  };

  const suggested = candidates.find((c) => c.videoId === suggestion);
  const others = candidates.filter((c) => c.videoId !== suggestion);

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Published it?</h2>
        <p className="text-sm text-zinc-400">We’ll find it on your connected channel; you confirm. Private and scheduled videos count too.</p>
      </div>

      {failure && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-100 space-y-2">
          <p>{failure.message}</p>
          {(failure.code === 'not_connected' || failure.code === 'reauth') && (
            <Link href="/youtube-doctor" className="btn-secondary btn-sm w-fit">
              {failure.code === 'reauth' ? 'Reconnect YouTube' : 'Connect YouTube'}
            </Link>
          )}
        </div>
      )}

      {state !== 'ready' ? (
        <button type="button" className="btn-primary px-5 py-2.5 text-base" disabled={state === 'loading'} onClick={find}>
          {state === 'loading' ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
          Find my video
        </button>
      ) : (
        <div className="space-y-4">
          {suggested && (
            <div className="rounded-xl border border-white/60 bg-white/5 p-4 space-y-3">
              <p className="text-base font-semibold text-white">Is this your video?</p>
              <VideoRow video={suggested} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" disabled={!!linking} onClick={() => link(suggested.videoId, 'suggested')}>
                  {linking === suggested.videoId ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Yes, this one
                </button>
                {!showAll && (
                  <button type="button" className="btn-ghost" onClick={() => setShowAll(true)}>
                    No, show my other uploads
                  </button>
                )}
              </div>
            </div>
          )}

          {showAll && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-300">{suggested ? 'Your other recent uploads' : 'Which of your recent uploads is it?'}</p>
              {others.length === 0 && <p className="text-sm text-zinc-500">No other recent uploads that aren’t already linked.</p>}
              <ul className="space-y-2">
                {others.map((c) => (
                  <li key={c.videoId} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-bg-border">
                    <VideoRow video={c} />
                    <button type="button" className="btn-secondary btn-sm shrink-0" disabled={!!linking} onClick={() => link(c.videoId, 'picked')}>
                      {linking === c.videoId ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                      This one
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">Older video? Paste its link</summary>
            <div className="flex gap-2 mt-2">
              <input className="input text-sm flex-1" value={pasted} placeholder="https://youtu.be/…" onChange={(e) => setPasted(e.target.value)} />
              <button type="button" className="btn-secondary btn-sm" disabled={!pasted.trim() || !!linking} onClick={() => link(pasted, 'pasted')}>
                Link
              </button>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function VideoRow({ video }: { video: Upload }) {
  return (
    <div className="flex gap-3 items-center flex-1 min-w-0">
      {video.thumbnailUrl ? (
        <Image src={video.thumbnailUrl} alt="" width={128} height={72} className="w-28 sm:w-32 aspect-video rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-28 sm:w-32 aspect-video rounded-lg bg-bg-elevated shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-base font-semibold text-white line-clamp-2">{video.title}</p>
        <p className="text-sm text-zinc-400">
          {PRIVACY_TEXT[video.privacy]} · {video.scheduledFor ? `scheduled for ${when(video.scheduledFor)}` : when(video.publishedAt)}
        </p>
      </div>
    </div>
  );
}

/** The linked video, read live from YouTube, with an undo while it isn't being measured. */
export function LinkedVideo({ project, onUnlinked }: { project: VideoProject; onUnlinked: (p: VideoProject) => void }) {
  const [data, setData] = useState<{ link: PublishedLink | null; video: Upload | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/create/projects/${project.id}/publish`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ link: null, video: null }));
  }, [project.id, project.status]);

  const unlink = async () => {
    if (!window.confirm('Unlink this video? The project goes back to packaged.')) return;
    setBusy(true);
    const res = await fetch(`/api/create/projects/${project.id}/publish`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) onUnlinked((await res.json()).project);
  };

  if (!data) {
    return (
      <section className="card flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </section>
    );
  }
  if (!data.link) return <section className="card text-base text-zinc-300">No video is linked to this project.</section>;

  const waiting = data.link.status === 'waiting_public';
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
      <p className="text-lg font-semibold text-white inline-flex items-center gap-2">
        <Check size={18} className="text-emerald-300" />
        Linked to your video
      </p>
      {data.video ? <VideoRow video={data.video} /> : <p className="text-sm text-zinc-400">YouTube couldn’t be reached just now, so its details aren’t shown.</p>}
      <p className="text-base text-zinc-300">
        {waiting
          ? 'Tracking starts when it goes public.'
          : 'Its performance can be compared with your usual videos from a few days after publishing.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {!waiting && (
          <Link href={`/create/${project.id}/measure`} className="btn-primary btn-sm">
            <BarChart3 size={14} />
            Check performance
          </Link>
        )}
        <a href={`https://www.youtube.com/watch?v=${data.link.youtubeVideoId}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
          <ExternalLink size={14} />
          Open on YouTube
        </a>
        {project.status === 'PUBLISHED' && (
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={unlink}>
            <Unlink size={14} />
            Wrong video? Unlink
          </button>
        )}
      </div>
    </section>
  );
}
