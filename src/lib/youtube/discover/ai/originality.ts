/**
 * Originality guard (docs/discover-plan.md §8.3): a recommended angle must not reproduce a
 * competitor's title. Pure; the embedding similarity is passed in by the caller.
 */
import { DISCOVER_RULES } from '../../analysis/rules-config';
import { normalizeTitle } from '../similarity';

const O = DISCOVER_RULES.originality;
// Built with RegExp: the tsconfig target lacks the u flag in literals. Keeps letters of every script.
const NON_WORD = new RegExp('[^\\p{L}\\p{M}\\p{N}\\s]', 'gu');

/** Words of a title for comparison: normalized, without the year-like and filler noise. */
export function titleWords(text: string): string[] {
  return normalizeTitle(text)
    .replace(NON_WORD, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Share of distinct words the two texts have in common (Jaccard). */
export function wordOverlap(a: string, b: string): number {
  const wa = new Set(titleWords(a));
  const wb = new Set(titleWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => wb.has(w) && shared++);
  return shared / (wa.size + wb.size - shared);
}

/** Longest run of identical consecutive words. */
export function longestSharedRun(a: string, b: string): number {
  const x = titleWords(a);
  const y = titleWords(b);
  let best = 0;
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) {
      let k = 0;
      while (i + k < x.length && j + k < y.length && x[i + k] === y[j + k]) k++;
      best = Math.max(best, k);
    }
  }
  return best;
}

/**
 * The competitor title an angle is too close to, or null when it is original enough.
 * `similarity(i)` returns the embedding cosine between the angle and title i, if known.
 */
export function tooCloseTo(angle: string, titles: string[], similarity?: (i: number) => number | null): string | null {
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const cos = similarity?.(i) ?? null;
    if (
      wordOverlap(angle, title) >= O.maxWordOverlap ||
      longestSharedRun(angle, title) > O.maxSharedRun ||
      (cos !== null && cos >= O.maxEmbeddingSimilarity)
    ) {
      return title;
    }
  }
  return null;
}
