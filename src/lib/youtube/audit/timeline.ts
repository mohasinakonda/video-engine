/**
 * Placing retention on what was said (docs/audit-plan.md §4). Pure and browser-safe: no network,
 * nothing stored. Two sources of "what was said": a Create script (sections, timed from their
 * word counts) or a transcript the creator pastes (SRT/VTT cues, or plain text spread evenly).
 */
import type { RetentionAnomaly, RetentionPoint } from '../types';

/** Share of viewers still watching at a position (0–1 of the video), interpolated. */
export function watchAt(points: RetentionPoint[], ratio: number): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.ratio - b.ratio);
  if (ratio <= sorted[0].ratio) return sorted[0].watchRatio;
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    if (ratio <= b.ratio) return a.watchRatio + ((b.watchRatio - a.watchRatio) * (ratio - a.ratio)) / (b.ratio - a.ratio || 1);
  }
  return sorted[sorted.length - 1].watchRatio;
}

export interface TimedPart {
  id: string;
  heading: string;
  startSec: number;
  endSec: number;
  /** Percent of viewers still watching at the start and end of the part. */
  startPct: number | null;
  endPct: number | null;
  /** Percentage points lost during the part. */
  dropPts: number | null;
}

export interface ScriptTimeline {
  parts: TimedPart[];
  /** The part that lost the most viewers (the opening part's natural early drop counts too). */
  worstId: string | null;
}

const pct = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 10);

/**
 * Times each script part by its share of the script's words, scaled to the real video length
 * (the edit rarely matches the estimate exactly, so the UI says these are estimates).
 */
export function scriptTimeline(points: RetentionPoint[], durationSec: number, parts: { id: string; heading: string; words: number }[]): ScriptTimeline | null {
  const total = parts.reduce((s, p) => s + p.words, 0);
  if (!total || durationSec <= 0 || points.length < 2) return null;
  let at = 0;
  const timed = parts.map((p) => {
    const start = at;
    at += p.words / total;
    const [s, e] = [watchAt(points, start), watchAt(points, at)];
    return {
      id: p.id,
      heading: p.heading,
      startSec: Math.round(start * durationSec),
      endSec: Math.round(at * durationSec),
      startPct: pct(s),
      endPct: pct(e),
      dropPts: s === null || e === null ? null : Math.round((s - e) * 1000) / 10,
    };
  });
  const worst = timed.filter((t) => t.dropPts !== null && t.dropPts > 0).sort((a, b) => (b.dropPts as number) - (a.dropPts as number))[0];
  return { parts: timed, worstId: worst?.id ?? null };
}

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
