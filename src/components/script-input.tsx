'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Word Count Helpers ───────────────────────────────────────────────────────

const WORDS_PER_MINUTE = 135;

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function estimateMinutes(words: number): string {
  if (words === 0) return '0 min';
  const mins = words / WORDS_PER_MINUTE;
  if (mins < 1) return `~${Math.round(mins * 60)}s`;
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScriptInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScriptInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Paste your full narration script here…\n\nThe script will be semantically split into ~3-minute audio chunks using Gemini.',
}: ScriptInputProps) {
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState('0 min');
  const [chunkEstimate, setChunkEstimate] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const wc = countWords(value);
    setWordCount(wc);
    setReadTime(estimateMinutes(wc));
    // ~420 words per chunk
    setChunkEstimate(wc > 0 ? Math.max(1, Math.ceil(wc / 420)) : 0);
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(240, el.scrollHeight)}px`;
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="script-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="textarea w-full resize-none font-mono text-xs leading-relaxed min-h-[240px]
                     disabled:opacity-50 disabled:cursor-not-allowed"
          spellCheck={false}
        />
        {disabled && (
          <div className="absolute inset-0 bg-bg-base/40 rounded-lg pointer-events-none" />
        )}
      </div>

      {/* Metrics Bar */}
      {wordCount > 0 && (
        <div className="flex items-center gap-5 px-1 animate-fade-in">
          <Metric label="Words" value={wordCount.toLocaleString()} />
          <div className="w-px h-4 bg-bg-border" />
          <Metric label="Est. Read Time" value={readTime} accent />
          <div className="w-px h-4 bg-bg-border" />
          <Metric
            label="Expected Chunks"
            value={`~${chunkEstimate}`}
            sub={`at 420 words/chunk`}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <span className={`text-sm font-semibold ${accent ? 'text-accent-purple-light' : 'text-white'}`}>
        {value}
      </span>
      <span className="text-[10px] text-slate-500 ml-1.5">{label}</span>
      {sub && <span className="text-[9px] text-slate-600 ml-1">{sub}</span>}
    </div>
  );
}
