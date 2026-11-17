/** Rules every product clip keeps, checked without AI; failures go back to the AI once. */
import { countActions } from '../../youtube/next-shorts/complexity';
import { ON_SCREEN_MAX_WORDS, VO_MAX_WORDS, VO_MIN_WORDS, type ProductFacts, type VideoScript } from './types';

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
/** Claims a review can't back up from the listing. */
const CLAIMS = /(\$\s?\d|\b\d+\s?%\s?off\b|\bbest ever\b|\b#1\b|\bnumber one\b|\bguarantee[ds]?\b|\bcheapest\b|\blowest price\b|\bon sale\b|\blimited time\b|\bmiracle\b)/i;
const MOVING_CAMERA = /\b(pulls? back|push(?:es)? in|zooms?|dolly|pans?|orbits?|tracks?|tracking|circles? around)\b/i;

/** The words that identify a product in speech: its first two meaningful words. */
export function nameKey(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'pack', 'set'].includes(w))
    .slice(0, 2);
}

export function scriptIssues(script: VideoScript, products: ProductFacts[]): string[] {
  const issues: string[] = [];
  const order = products.map((p) => p.asin);
  const got = script.clips.map((c) => c.asin);
  if (got.length !== order.length || got.some((a, i) => a !== order[i])) {
    issues.push(`Write exactly one clip per product, in this order: ${order.join(', ')}.`);
  }
  script.clips.forEach((c, i) => {
    const n = `clip-${i + 1}`;
    const w = words(c.voiceover);
    if (w < VO_MIN_WORDS || w > VO_MAX_WORDS)
      issues.push(`${n}: the voiceover has ${w} words; it must be ${VO_MIN_WORDS}–${VO_MAX_WORDS} (8 seconds at about 200 words a minute).`);
    const key = nameKey(c.productName);
    if (key.length && !key.some((k) => c.voiceover.toLowerCase().includes(k))) issues.push(`${n}: say the product’s name (“${c.productName}”) in the voiceover.`);
    if (CLAIMS.test(c.voiceover) || CLAIMS.test(c.onScreenText)) issues.push(`${n}: no prices, discounts, “#1”, “best ever” or guarantees: say what the product does.`);
    if (countActions(c.action) > 1) issues.push(`${n}: one action only (“${c.action}”).`);
    if (c.camera.movement === 'none' && MOVING_CAMERA.test(c.action)) issues.push(`${n}: the camera is static but the action describes a camera move.`);
    if (words(c.onScreenText) > ON_SCREEN_MAX_WORDS) issues.push(`${n}: on-screen text has more than ${ON_SCREEN_MAX_WORDS} words.`);
  });
  if (script.clips[0] && !script.clips[0].voiceover.toLowerCase().startsWith(script.hook.toLowerCase().slice(0, 12))) {
    issues.push('clip-1: the voiceover must start with the hook.');
  }
  return issues;
}

/** A tag for the video's bio link, from the niche and today's date: "car-care-1113". */
export function videoTagFor(label: string, now = new Date()): string {
  const base = label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
    .replace(/-$/, '');
  const mmdd = `${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `${base || 'picks'}-${mmdd}`;
}
