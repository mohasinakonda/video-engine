/**
 * Thumbnail findings (docs/audit-plan.md §2), from the vision model's description of what is
 * visible. The model only describes; the rules here judge. Vision can misread, so nothing
 * from it is rated above medium confidence.
 */
import type { ThumbnailFindings } from '../analysis/thumbnails';
import type { AuditFinding } from './video-audit';

/** More words than this rarely read at a glance. */
export const THUMB_MAX_WORDS = 4;

const NON_WORD = new RegExp('[^\\p{L}\\p{M}\\p{N}\\s]', 'gu');
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

/** Share of the thumbnail's words that the title already says (0–1). */
export function titleOverlap(thumbnailText: string | null, title: string): number {
  const t = words(thumbnailText ?? '');
  if (t.length === 0) return 0;
  const titleWords = new Set(words(title));
  return t.filter((w) => titleWords.has(w)).length / t.length;
}

export function thumbnailFindings(f: ThumbnailFindings, title: string): AuditFinding[] {
  const out: AuditFinding[] = [];
  const add = (kind: AuditFinding['kind'], statement: string, evidence: string | null) =>
    out.push({ id: `thumbnail_${out.length + 1}`, area: 'thumbnail', kind, statement, evidence, confidence: 'medium' });

  if (!f.readableAtSmallSize) add('weakness', 'Hard to read at phone size, where most people decide to click.', `Main subject: ${f.subject}.`);
  if (f.wordCount > THUMB_MAX_WORDS) add('weakness', `${f.wordCount} words on the thumbnail; more than ${THUMB_MAX_WORDS} rarely get read at a glance.`, f.textOnImage ? `“${f.textOnImage}”` : null);
  if (f.subjectSizePct < 20) add('weakness', 'The main subject is small, so the image doesn’t say much in a feed.', `It fills about ${Math.round(f.subjectSizePct)}% of the image.`);
  if (f.contrast === 'low') add('weakness', 'Low contrast makes it blend into the feed.', null);
  if (f.background === 'busy') add('weakness', 'A busy background competes with the main subject.', null);

  const overlap = titleOverlap(f.textOnImage, title);
  if (overlap >= 0.6) {
    add('weakness', 'The thumbnail text repeats the title, so the two together say less than they could.', `Thumbnail: “${f.textOnImage}”.`);
  } else if (f.textOnImage && overlap === 0) {
    add('strength', 'The thumbnail text adds to the title instead of repeating it.', `Thumbnail: “${f.textOnImage}”.`);
  }

  if (f.readableAtSmallSize && f.contrast === 'high' && f.background !== 'busy') {
    add('strength', 'Clear at phone size: high contrast and an uncluttered image.', `Main subject: ${f.subject}.`);
  }
  return out;
}
