'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';
import { CopyButton } from '../components/copy-button';

export function SeoDescriptionCard() {
  const { packaging } = useLaunchKit();

  if (!packaging?.description) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Complete YouTube SEO Description
          </h3>
        </div>
        <CopyButton
          text={packaging.description}
          copyKey="description"
          label="Description"
          className="btn-ghost text-xs px-2.5 py-1 text-zinc-300 hover:text-white flex items-center gap-1.5"
          buttonText="Copy Full Description"
          copiedText="Copied!"
          iconSize={13}
        />
      </div>

      <textarea
        readOnly
        rows={8}
        value={packaging.description}
        className="input font-mono text-xs leading-relaxed text-zinc-300 bg-zinc-950/70 resize-none"
      />
    </div>
  );
}
