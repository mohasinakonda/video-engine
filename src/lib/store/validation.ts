/**
 * Rules for store fields, the same as the store database's CHECK constraints, so a bad value is
 * refused with a clear message before it reaches the database.
 */
export const MARKETPLACES = ['US', 'UK', 'CA'] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

const AMAZON_HOST: Record<Marketplace, string> = { US: 'www.amazon.com', UK: 'www.amazon.co.uk', CA: 'www.amazon.ca' };

export const MAX_TAGS = 20;
export const MAX_LINKS = 5;

/** Words a handle can't be: they would read as rendoza's own pages. */
const RESERVED = new Set([
  'admin',
  'api',
  'app',
  'bio',
  'blog',
  'dashboard',
  'help',
  'login',
  'logout',
  'me',
  'rendoza',
  'root',
  'settings',
  'signup',
  'store',
  'support',
  'system',
  'www',
  'about',
  'privacy',
  'terms',
  'amazon',
]);

export const normalizeHandle = (h: string) => h.trim().replace(/^@/, '').toLowerCase();

/** Why a handle can't be used, or null when it can. */
export function handleProblem(raw: string): string | null {
  const h = normalizeHandle(raw);
  if (h.length < 3) return 'Use at least 3 characters.';
  if (h.length > 30) return 'Use at most 30 characters.';
  if (!/^[a-z0-9][a-z0-9_.]*$/.test(h)) return 'Use letters, numbers, dots and underscores, starting with a letter or number.';
  if (/\.\.|\.$/.test(h)) return 'A handle can’t end with a dot or have two dots in a row.';
  if (RESERVED.has(h)) return 'This handle is reserved. Try another.';
  return null;
}

export const normalizeAsin = (a: string) => a.trim().toUpperCase();
export const isAsin = (a: string) => /^[A-Z0-9]{10}$/.test(normalizeAsin(a));

/** The ASIN from a pasted Amazon link, or the text itself when it already is one. */
export function asinFrom(input: string): string | null {
  const t = input.trim();
  if (isAsin(t)) return normalizeAsin(t);
  const m = t.match(/(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

/** Amazon Associates store IDs look like "mychannel-20". */
export const isAmazonTag = (t: string) => /^[A-Za-z0-9-]{3,40}-\d{2}$/.test(t.trim());

/** A tag as stored: lower-case words joined by dashes ("Car Gadgets" → "car-gadgets"). */
export function slugTag(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '');
}

/** Slugged, without empties or repeats, at most 20. */
export function normalizeTags(raw: string[]): string[] {
  return Array.from(new Set(raw.map(slugTag).filter((t) => /^[a-z0-9][a-z0-9-]*$/.test(t)))).slice(0, MAX_TAGS);
}

/** A category is free text: trimmed, at most 40 characters, or none. */
export function normalizeCategory(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return c || null;
}

export const isHttpsUrl = (u: string) => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

/** The product's Amazon page with the creator's store ID. */
export function amazonProductUrl(asin: string, tag: string | null, marketplace: Marketplace = 'US'): string {
  const q = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  return `https://${AMAZON_HOST[marketplace]}/dp/${encodeURIComponent(normalizeAsin(asin))}${q}`;
}
