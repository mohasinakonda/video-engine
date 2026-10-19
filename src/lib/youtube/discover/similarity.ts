/** Vector helpers for embeddings. Pure. */

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** For each vector in `items`, its highest cosine to any vector in `targets` (0 when there are none). */
export function bestMatches(items: number[][], targets: number[][]): number[] {
  return items.map((v) => targets.reduce((best, t) => Math.max(best, cosine(v, t)), 0));
}

// Built with RegExp: the tsconfig target lacks the u flag in literals.
const EMOJI = new RegExp('[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]', 'gu');

/**
 * Prepares a title for embedding: removes hashtags, emoji, URLs and years so "Best X 2026"
 * and "best x" land together. Keeps letters from every script (Bangla included).
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(EMOJI, ' ')
    .replace(/[|•–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The part of a title that says what the video is about. Channels often append
 * " | Series | Channel name", which would make one channel's titles cluster together, so
 * only the first segment is kept (two if the first is very short) and the channel name is removed.
 */
export function topicText(title: string, channelTitle: string): string {
  const segments = title.split(/\s+[|｜•]\s+|\s+-\s+(?=[^-]*$)/).map((s) => s.trim()).filter(Boolean);
  let main = segments[0] ?? title;
  if (main.split(/\s+/).length < 3 && segments[1]) main = `${main} ${segments[1]}`;
  if (channelTitle.trim().length >= 3) main = main.replace(new RegExp(escapeRegExp(channelTitle.trim()), 'gi'), ' ');
  return normalizeTitle(main);
}
