'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface GenerationOverlayProps {
  open: boolean;
  /** Ordered stage labels shown as a checklist */
  stages: string[];
  /** Index of the stage currently running */
  currentStage: number;
  /** Live detail message from the AI pipeline */
  detail?: string;
}

/** Full-screen stage-by-stage progress shown while the storyboard is being built. */
export default function GenerationOverlay({ open, stages, currentStage, detail }: GenerationOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-bg-surface border border-bg-border shadow-2xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white">Building your storyboard</h2>
          <p className="text-xs text-zinc-400 mt-1">This usually takes under a minute. Please keep this tab open.</p>
        </div>

        <ol className="space-y-3">
          {stages.map((label, i) => {
            const done = i < currentStage;
            const active = i === currentStage;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono border ${
                    done
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : active
                        ? 'bg-white text-zinc-950 border-white'
                        : 'border-bg-border text-zinc-600'
                  }`}
                >
                  {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                </span>
                <span
                  className={`text-sm ${done ? 'text-zinc-400' : active ? 'text-white font-medium' : 'text-zinc-600'}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="pt-3 border-t border-bg-border/60 flex items-start justify-between gap-3">
          <p className="text-xs text-zinc-400 line-clamp-2 min-h-[2rem]">{detail || ' '}</p>
          <span className="text-xs font-mono text-zinc-500 flex-shrink-0">{elapsed}s</span>
        </div>
      </div>
    </div>
  );
}
