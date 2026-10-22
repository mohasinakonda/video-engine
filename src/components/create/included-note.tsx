import { CheckCircle2 } from 'lucide-react';

/** The quiet line under an AI button: "Included · 2 of 3 left", or the run's price once it has one. */
export function IncludedNote({ note, included }: { note: string | null; included: boolean }) {
  if (!note) return null;
  return (
    <p className="text-xs text-zinc-500 inline-flex items-center gap-1">
      {included && <CheckCircle2 size={12} className="text-emerald-400/80" />}
      {note}
    </p>
  );
}
