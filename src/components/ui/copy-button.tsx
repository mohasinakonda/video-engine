'use client';

import { useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';

/** Copies `text` and says "Copied" for a moment. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="btn-ghost btn-sm shrink-0" onClick={copy}>
      {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
