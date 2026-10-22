/**
 * Placing retention on what was said (docs/audit-plan.md §4). Pure and browser-safe: no network,
 * nothing stored. "What was said" is a transcript the creator pastes (SRT/VTT cues, or plain
 * text spread evenly).
 */
import type { RetentionAnomaly } from '../types';

// ─── Pasted transcripts ───────────────────────────────────────────────────────

export interface Cue {
  startSec: number;
  text: string;
}

const toSec = (h: string | undefined, m: string, s: string) => Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s.replace(',', '.'));

/** SRT or WebVTT cues; empty when the text has no timestamps. */
export function parseTimedTranscript(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((l) => /-->/.test(l));
    if (timeIndex < 0) continue;
    const m = lines[timeIndex].match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2}(?:[.,]\d{1,3})?)\s*-->/);
    if (!m) continue;
    const text = lines.slice(timeIndex + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) cues.push({ startSec: toSec(m[1], m[2], m[3]), text });
  }
  return cues.sort((a, b) => a.startSec - b.startSec);
}

/** Plain text without timestamps: sentences spread over the video by word count (an estimate). */
export function spreadPlainTranscript(raw: string, durationSec: number): Cue[] {
  const sentences = raw.replace(/\s+/g, ' ').split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);
  const words = sentences.map((s) => s.split(' ').length);
  const total = words.reduce((a, b) => a + b, 0);
  if (!total || durationSec <= 0) return [];
  let at = 0;
  return sentences.map((text, i) => {
    const cue = { startSec: Math.round((at / total) * durationSec), text };
    at += words[i];
    return cue;
  });
}

export function transcriptCues(raw: string, durationSec: number): { cues: Cue[]; timed: boolean } {
  const timed = parseTimedTranscript(raw);
  return timed.length >= 3 ? { cues: timed, timed: true } : { cues: spreadPlainTranscript(raw, durationSec), timed: false };
}

/** What was being said at each place viewers left in numbers (drops and early exits). */
export function linesAtDrops(cues: Cue[], anomalies: RetentionAnomaly[], durationSec: number): { atSec: number; kind: RetentionAnomaly['kind']; magnitude: number; text: string }[] {
  if (!cues.length) return [];
  return anomalies
    .filter((a) => a.kind === 'steep_drop' || a.kind === 'early_exit')
    .map((a) => {
      const atSec = a.atSec ?? Math.round(a.atRatio * durationSec);
      const i = cues.reduce((best, c, idx) => (c.startSec <= atSec ? idx : best), 0);
      // The line just before the drop is usually what made people leave.
      const text = [cues[i - 1]?.text, cues[i].text].filter(Boolean).join(' ').slice(0, 300);
      return { atSec, kind: a.kind, magnitude: a.magnitude, text };
    });
}
