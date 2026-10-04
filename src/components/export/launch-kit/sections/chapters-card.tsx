'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';
import { CopyButton } from '../components/copy-button';

export function ChaptersCard() {
  const { packaging } = useLaunchKit();

  if (!packaging?.chapters || packaging.chapters.length === 0) return null;

  const chaptersText = packaging.chapters.map((c) => `${c.time} - ${c.title}`).join('\n');

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 space-y-3.5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-purple-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Automated Chapters &amp; Timestamps
          </h3>
        </div>
        <CopyButton
          text={chaptersText}
          copyKey="chapters"
          label="Chapters"
          className="btn-ghost text-xs px-2.5 py-1 text-zinc-300 hover:text-white flex items-center gap-1.5"
          buttonText="Copy Timestamps"
          copiedText="Copied!"
          iconSize={13}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {packaging.chapters.map((ch, i) => (
          <div
            key={i}
            className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                {ch.time}
              </span>
              <span className="text-xs text-zinc-200 truncate">{ch.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
