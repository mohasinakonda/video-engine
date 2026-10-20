'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCopy, FileText, Hash, ListChecks, Scale } from 'lucide-react';
import { lowerFirst } from '@/lib/youtube/audit/patterns';
import type { VideoAuditReport } from './types';

/** "Make your own version": what to copy from this video, and a start in Create. */
export function Playbook({ report }: { report: VideoAuditReport }) {
  const items = recipe(report);
  const start = report.myVersion ?? report.video.title;

  return (
    <section className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.04] p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
          <ListChecks size={18} className="text-emerald-300" />
          Make your own version
        </h3>
        <p className="text-sm text-zinc-400">What this video does that you can reuse. Each point comes from the checks below.</p>
      </div>

      {report.titleTemplate && <TitleShape template={report.titleTemplate} />}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((x) => (
            <li key={x} className="text-base text-zinc-200 flex gap-2">
              <Check size={16} className="text-emerald-400 shrink-0 mt-1" />
              {x}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-start gap-3 pt-1">
        {!report.isOwn && (
          <div className="space-y-1">
            <Link href={`/create/new?title=${encodeURIComponent(start.slice(0, 200))}`} className="btn-primary">
              <FileText size={16} />
              Start my version
            </Link>
            <p className="text-xs text-zinc-500 max-w-xs">Opens Create with “{start.slice(0, 80)}” as the working title. You can change it.</p>
          </div>
        )}
        {!report.isOwn && (
          <Link href={`/discover/compare?theirs=${report.video.id}`} className="btn-secondary">
            <Scale size={16} />
            Compare with one of my videos
          </Link>
        )}
      </div>
    </section>
  );
}

function TitleShape({ template }: { template: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(template).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl bg-bg-elevated border border-bg-border p-3 space-y-1">
      <p className="text-xs text-zinc-500">Title shape</p>
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-white break-words">{template}</p>
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={copy}>
          {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** The reusable parts, from the patterns and the video's own setup. */
function recipe(r: VideoAuditReport): string[] {
  const out: string[] = [];
  for (const p of r.patterns?.patterns ?? []) {
    if (p.lift > 1 && p.thisHas) out.push(`${p.label}: on this channel that goes with ${p.lift >= 10 ? Math.round(p.lift) : p.lift.toFixed(1)}× the views.`);
  }
  const avoid = (r.patterns?.patterns ?? []).find((p) => p.lift < 1 && p.thisHas);
  if (avoid) out.push(`Watch out: ${lowerFirst(avoid.label)} usually goes with fewer views on this channel.`);
  if (r.video.durationSec && r.format === 'video') out.push(`Length: about ${Math.round(r.video.durationSec / 60)} minutes.`);
  const d = r.description;
  // Reports saved before these parts existed don't have them.
  const desc = !d ? [] : [d.lyrics && 'the lyrics', d.playlists > 0 && `${d.playlists} playlist link${d.playlists > 1 ? 's' : ''}`, d.videoLinks > 0 && 'links to its other videos', d.chapters > 0 && 'chapters'].filter(Boolean);
  if (desc.length) out.push(`Description: ${desc.join(', ')}.`);
  if (r.madeForKids) out.push('Made for kids: plan for no comments, bell notifications or end screens.');
  return out;
}

/** The description's setup and the uploader's tags (public, shown as-is). */
export function DescriptionAndTags({ report }: { report: VideoAuditReport }) {
  const { description: d, tags } = report;
  if (!d || !tags) return null;
  const chips = [
    d.lyrics && 'Lyrics',
    d.chapters > 0 && `${d.chapters} chapters`,
    d.playlists > 0 && `${d.playlists} playlist link${d.playlists > 1 ? 's' : ''}`,
    d.videoLinks > 0 && `${d.videoLinks} video link${d.videoLinks > 1 ? 's' : ''}`,
    d.socialLinks > 0 && `${d.socialLinks} social link${d.socialLinks > 1 ? 's' : ''}`,
    d.otherLinks > 0 && `${d.otherLinks} other link${d.otherLinks > 1 ? 's' : ''}`,
    d.sponsor && 'Sponsor or discount code',
    d.hashtags > 0 && `${d.hashtags} hashtags`,
  ].filter((x): x is string => Boolean(x));
  const shared = new Set(tags.shared);
  const best = tags.from === 'standouts' ? 'its standout videos' : 'its most-viewed videos';
  if (!chips.length && !tags.all.length) return null;

  return (
    <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
      <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
        <Hash size={18} className="text-sky-300" />
        Description and tags
      </h3>
      {chips.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-400">What the description has</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="text-sm px-2.5 py-1 rounded-full bg-bg-elevated text-zinc-200">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {tags.all.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-400">
            Its {tags.all.length} tags{tags.shared.length > 0 && <> · <span className="text-emerald-300">green</span> ones set {best} apart</>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.all.map((t) => (
              <span key={t} className={`text-sm px-2.5 py-1 rounded-full ${shared.has(t.trim().toLowerCase()) ? 'bg-emerald-500/15 text-emerald-200' : 'bg-bg-elevated text-zinc-300'}`}>
                {t}
              </span>
            ))}
          </div>
          {tags.missing.length > 0 && (
            <p className="text-sm text-zinc-400">
              On most of {best} (and not the rest) but not here: <span className="text-zinc-200">{tags.missing.join(', ')}</span>
            </p>
          )}
          {(tags.boilerplate?.length ?? 0) > 0 && (
            <p className="text-sm text-zinc-400">{tags.boilerplate.length} of them are on most of the channel’s videos: its standard set, so they don’t explain this one.</p>
          )}
          <p className="text-xs text-zinc-500">Tags matter little for search today; they mostly help with misspellings. The title, thumbnail and description matter far more.</p>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">This video has no tags.</p>
      )}
    </section>
  );
}
