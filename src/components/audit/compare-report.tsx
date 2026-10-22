'use client';

import Image from 'next/image';
import { Lightbulb, Scale } from 'lucide-react';
import { formatCompact } from '@/components/youtube-doctor/format';
import type { CompareReport as Report } from './types';

function Side({ label, a }: { label: string; a: Report['yours'] }) {
  return (
    <div className="flex-1 min-w-0 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      {a.video.thumbnailUrl ? (
        <Image src={a.video.thumbnailUrl} alt="" width={320} height={180} className="w-full aspect-video rounded-xl object-cover" />
      ) : (
        <div className="w-full aspect-video rounded-xl bg-bg-elevated" />
      )}
      <a href={`https://www.youtube.com/watch?v=${a.video.id}`} target="_blank" rel="noopener noreferrer" className="block text-base font-semibold text-white leading-snug hover:underline">
        {a.video.title}
      </a>
      <p className="text-sm text-zinc-400">
        {a.video.channelTitle}
        {a.video.views !== null && ` · ${formatCompact(a.video.views)} views`}
      </p>
    </div>
  );
}

/** Your video next to another: the main difference and what to try, then the table. */
export function CompareReport({ report }: { report: Report }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 flex flex-col sm:flex-row gap-5">
        <Side label="Yours" a={report.yours} />
        <Side label="Theirs" a={report.theirs} />
      </section>

      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 space-y-4">
        <p className="text-lg text-white leading-relaxed">{report.verdict}</p>
        {report.lessons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-300 inline-flex items-center gap-1.5">
              <Lightbulb size={15} className="text-amber-300" />
              Try on your next video
            </p>
            <ul className="space-y-1.5">
              {report.lessons.map((l) => (
                <li key={l} className="text-base text-zinc-200 flex gap-2">
                  <span className="text-amber-300">→</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {report.differences.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
            <Scale size={17} />
            Clear differences
          </h3>
          <ul className="space-y-2">
            {report.differences.map((d) => (
              <li key={d.id} className="rounded-xl border border-bg-border bg-bg-surface p-4">
                <p className="text-base text-zinc-100">{d.statement}</p>
                {d.evidence && <p className="text-sm text-zinc-400">{d.evidence}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-bg-border bg-bg-surface p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400">
              <th className="font-medium py-2 pr-3" />
              <th className="font-medium py-2 pr-3">Yours</th>
              <th className="font-medium py-2">Theirs</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.label} className={`border-t border-bg-border ${r.differs ? 'bg-amber-500/5' : ''}`}>
                <td className="py-2 pr-3 text-zinc-400">{r.label}</td>
                <td className="py-2 pr-3 text-zinc-100">{r.yours}</td>
                <td className="py-2 text-zinc-100">{r.theirs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-500 mt-3">Each video is judged against its own channel’s usual, so a small and a big channel compare fairly. Highlighted rows differ clearly.</p>
      </section>

      {[...report.yours.limitations, ...report.theirs.limitations].length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-500">
          {Array.from(new Set([...report.yours.limitations, ...report.theirs.limitations])).map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
