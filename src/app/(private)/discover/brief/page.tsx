'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Copy, FileText, Loader2 } from 'lucide-react';
import { FORMAT_LABELS } from '@/components/discover/types';
import { useAuth } from '@/contexts/auth-context';
import { briefKey } from '@/lib/channel-doctor-storage';
import { briefAsText, type VideoBrief } from '@/lib/youtube/discover/brief';

export default function BriefPage() {
  return (
    <Suspense fallback={null}>
      <BriefInner />
    </Suspense>
  );
}

/**
 * The hand-off point to video creation. Script and video generation from a brief come in the
 * next phase; until then the brief can be copied, and nothing pretends to generate.
 */
function BriefInner() {
  const id = useSearchParams().get('id') || '';
  const { user } = useAuth();
  const [brief, setBrief] = useState<VideoBrief | null | 'missing'>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.sessionStorage.getItem(briefKey(user.id, id));
      setBrief(raw ? (JSON.parse(raw) as VideoBrief) : 'missing');
    } catch {
      setBrief('missing');
    }
  }, [user, id]);

  const copy = async (b: VideoBrief) => {
    try {
      await navigator.clipboard.writeText(briefAsText(b));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container max-w-3xl space-y-6">
        <Link href={`/discover/opportunity/${encodeURIComponent(id)}`} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to the idea
        </Link>

        {brief === null ? (
          <div className="card flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-zinc-400" />
          </div>
        ) : brief === 'missing' ? (
          <section className="card space-y-3">
            <h1 className="text-xl font-bold text-white">No brief here yet</h1>
            <p className="text-base text-zinc-300">Open an idea from Discover and choose “Create video brief”. Briefs stay in this browser tab.</p>
            <Link href="/discover?tab=next" className="btn-primary w-fit">
              See next-video ideas
            </Link>
          </section>
        ) : (
          <>
            <section className="card space-y-5">
              <div className="flex items-center gap-2 text-emerald-300">
                <FileText size={20} />
                <span className="text-sm font-semibold uppercase tracking-wide">Video brief</span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-snug">{brief.angle}</h1>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
                <Item label="Topic" value={brief.topic} />
                <Item label="Format" value={brief.format ? FORMAT_LABELS[brief.format] : null} />
                <Item label="For" value={brief.audience} />
                <Item label="Viewer need" value={brief.viewerProblem} />
              </dl>
              {brief.whyThisVideo.length > 0 && (
                <div>
                  <p className="text-sm text-zinc-400">Why this video</p>
                  {brief.whyThisVideo.map((w) => (
                    <p key={w} className="text-base text-zinc-200">
                      {w}
                    </p>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => copy(brief)} className="btn-secondary w-fit">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy brief'}
              </button>
            </section>

            <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-2">
              <h2 className="text-lg font-semibold text-white">Next: script and video</h2>
              <p className="text-base text-zinc-300">
                Turning a brief into a script, scenes and a finished video is coming in the next update. For now, copy the brief and use it in a new project.
              </p>
              <Link href="/projects" className="btn-ghost w-fit">
                Go to my projects
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className="text-zinc-100">{value}</dd>
    </div>
  );
}
