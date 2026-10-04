'use client';

import React from 'react';
import { Tag } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';
import { CopyButton } from '../components/copy-button';

export function TagsCard() {
  const { packaging } = useLaunchKit();

  if (!packaging?.tags || packaging.tags.length === 0) return null;

  const tagString = packaging.tags.join(', ');

  return (
    <div className="card p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={15} className="text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            SEO Tags &amp; Hashtags
          </h3>
        </div>
        <CopyButton
          text={tagString}
          copyKey="tags"
          label="Tags (CSV)"
          className="btn-ghost text-xs px-2.5 py-1 text-zinc-300 hover:text-white flex items-center gap-1.5"
          buttonText="Copy All Tags (CSV)"
          copiedText="Copied!"
          iconSize={13}
        />
      </div>

      <div className="space-y-2">
        <span className="text-[11px] text-zinc-400 block font-medium">
          YouTube Studio Tags (Comma-separated keywords):
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
          {packaging.tags.map((tag, i) => (
            <span
              key={i}
              className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {packaging.hashtags && packaging.hashtags.length > 0 && (
        <div className="pt-2 border-t border-zinc-800 space-y-2">
          <span className="text-[11px] text-zinc-400 block font-medium">
            Trending Hashtags:
          </span>
          <div className="flex flex-wrap gap-2">
            {packaging.hashtags.map((ht, i) => (
              <span
                key={i}
                className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-blue-300"
              >
                {ht}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
