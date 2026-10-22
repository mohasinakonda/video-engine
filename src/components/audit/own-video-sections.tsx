'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { linesAtDrops, transcriptCues } from '@/lib/youtube/audit/timeline';
import type { AuditFinding } from '@/lib/youtube/audit/video-audit';
import type { RetentionAnomaly } from '@/lib/youtube/types';

const time = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Title, description and thumbnail rules, compact, for the check-up's packaging card. */
export function PackagingFindings({ findings }: { findings: AuditFinding[] }) {
  const shown = findings.filter((f) => f.kind !== 'note');
  if (!shown.length) return null;
  return (
    <ul className="space-y-2 pt-3 border-t border-bg-border">
      {shown.map((f) => (
        <li key={f.id} className="text-sm flex gap-2">
          {f.kind === 'weakness' ? <AlertTriangle size={14} className="text-amber-300 shrink-0 mt-0.5" /> : <CheckCircle2 size={14} className="text-emerald-300 shrink-0 mt-0.5" />}
          <span className="text-zinc-200">
            {f.statement}
            {f.evidence && <span className="block text-xs text-zinc-500">{f.evidence}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Paste a transcript (SRT, VTT or plain text) to see what was said where viewers left. Runs in the browser only. */
export function TranscriptMatch({ anomalies, durationSec }: { anomalies: RetentionAnomaly[]; durationSec: number | null }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const drops = anomalies.filter((a) => a.kind === 'steep_drop' || a.kind === 'early_exit');
  const result = useMemo(() => {
    if (!text.trim() || !durationSec) return null;
    const { cues, timed } = transcriptCues(text, durationSec);
    return { timed, lines: linesAtDrops(cues, drops, durationSec) };
  }, [text, durationSec, drops]);

  if (!drops.length || !durationSec) return null;
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">What you were saying when viewers left</h3>
          <p className="text-sm text-zinc-400">Paste the video’s transcript or subtitle file (SRT/VTT works best). It stays in your browser.</p>
        </div>
        {!open && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
            <FileText size={14} />
            Paste transcript
          </button>
        )}
      </div>
      {open && (
        <textarea
          className="input text-sm min-h-[120px] font-mono"
          value={text}
          maxLength={200_000}
          placeholder={'1\n00:00:00,000 --> 00:00:04,000\nIn this video…'}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {result && (
        <>
          {!result.timed && <p className="text-xs text-amber-300">No timestamps found, so lines are placed by word count. An SRT or VTT file is exact.</p>}
          <ul className="space-y-2">
            {result.lines.map((l) => (
              <li key={`${l.atSec}-${l.kind}`} className="p-3 rounded-lg bg-bg-elevated space-y-1">
                <p className="text-xs text-amber-300">
                  {time(l.atSec)} · {l.kind === 'early_exit' ? 'many left early' : `${Math.round(l.magnitude)} points left at once`}
                </p>
                <p className="text-sm text-zinc-200">“{l.text}”</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
