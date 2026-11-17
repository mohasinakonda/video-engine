/**
 * Canopy: Amazon best sellers, search and product details. Server only: the key stays here.
 * Lists use the GraphQL API, which returns each product's photos, brand and feature bullets in the
 * same request (one billed request for a whole list, checked 13 Nov 2026), so opening a product or
 * writing a video needs no second call. Every call costs money: callers charge credits or count it.
 */
import { ConfigError } from '../youtube/config';
import { UserFacingError } from '../youtube/errors';
import type { Category, Domain, ListedProduct, Price, ProductDetails } from './types';

const BASE = 'https://rest.canopyapi.co/api/amazon';
const GRAPHQL = 'https://graphql.canopyapi.co/';
const TIMEOUT_MS = 25_000;
/** A list with every product's details takes Canopy about a minute. */
const LIST_TIMEOUT_MS = 100_000;

function apiKey(): string {
  const key = process.env.CANOPY_API_KEY;
  if (!key) throw new ConfigError('CANOPY_API_KEY is not set.');
  return key;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'API-KEY': apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    throw new UserFacingError('Amazon data took too long. Please try again.');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body || (body.errors?.length && !body.data)) {
    console.error('[canopy] graphql failed:', res.status, body?.errors?.[0]?.message);
    throw new UserFacingError('Amazon data isn’t available right now. Please try again.');
  }
  return body.data as T;
}

/** Each product in a list, with what the side panel and the video need. */
const PRODUCT_FIELDS = `asin title brand bestSellersRank rating ratingsTotal isPrime sponsored
  price { display value } coupon { label } mainImageUrl imageUrls featureBullets`;
const CATEGORY_FIELDS = 'id name url';

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = apiKey();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}?${qs}`, { headers: { 'API-KEY': key }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch {
    throw new UserFacingError('Amazon data couldn’t be reached. Please try again.');
  }
  if (res.status === 404) throw new UserFacingError('Amazon has nothing for that. Try another category or word.');
  if (!res.ok) {
    console.error(`[canopy] ${path} failed:`, res.status);
    throw new UserFacingError('Amazon data isn’t available right now. Please try again.');
  }
  return (await res.json()) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const price = (p: any): Price | null => (p && typeof p.value === 'number' ? { display: String(p.display ?? `${p.symbol ?? '$'}${p.value}`), value: p.value } : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Amazon's list thumbnails carry a crop suffix; the bare image is bigger and cleaner. */
export const fullImage = (url: string | null | undefined) => (url ? url.replace(/\._[^/]*_\.(jpg|jpeg|png|webp)$/i, '.$1') : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listed(r: any, bestseller: boolean): ListedProduct | null {
  if (!r?.asin || !r?.title) return null;
  const main = fullImage(r.mainImageUrl);
  const images = Array.from(new Set([main, ...((r.imageUrls ?? []) as unknown[])].filter((u): u is string => typeof u === 'string' && u.startsWith('https://')))).slice(0, 12);
  return {
    brand: r.brand ? String(r.brand) : null,
    images,
    featureBullets: ((r.featureBullets ?? []) as unknown[]).filter((b): b is string => typeof b === 'string' && b.trim().length > 0).slice(0, 8),
    asin: String(r.asin),
    title: String(r.title),
    imageUrl: fullImage(r.mainImageUrl),
    price: price(r.price),
    rating: num(r.rating),
    ratingsTotal: num(r.ratingsTotal),
    bestSellersRank: bestseller ? num(r.bestSellersRank) : null,
    isPrime: Boolean(r.isPrime),
    sponsored: Boolean(r.sponsored),
    coupon: r.coupon?.label ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const category = (c: any): Category | null =>
  c?.id && c?.name ? { id: String(c.id), name: String(c.name), ...(typeof c.url === 'string' && isBestSellerUrl(c.url) ? { url: c.url } : {}) } : null;

/** Only Amazon best-seller pages may be passed on to Canopy. */
export const isBestSellerUrl = (u: string) => /^https:\/\/www\.amazon\.(com|co\.uk|ca)\/[^\s]*\/zgbs\//.test(u);

/** A top-level niche by its id, or a sub-category by its best-seller page URL. One request. */
export async function bestSellers(where: { categoryId?: string; url?: string }, domain: Domain) {
  const input: Record<string, string> = { domain };
  if (where.url) input.url = where.url;
  else if (where.categoryId) input.categoryId = where.categoryId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await gql<any>(
    `query ($input: AmazonBestSellersInput!) { amazonBestSellers(input: $input) {
      productResults { results { ${PRODUCT_FIELDS} } }
      categoryInfo { currentCategory { ${CATEGORY_FIELDS} } parentCategory { ${CATEGORY_FIELDS} } childCategories { ${CATEGORY_FIELDS} } } } }`,
    { input },
  );
  const b = data?.amazonBestSellers;
  const info = b?.categoryInfo;
  return {
    products: ((b?.productResults?.results ?? []) as unknown[]).map((r) => listed(r, true)).filter((p): p is ListedProduct => p !== null),
    category: info?.currentCategory
      ? {
          current: category(info.currentCategory) as Category,
          parent: category(info.parentCategory),
          children: ((info.childCategories ?? []) as unknown[]).map(category).filter((c): c is Category => c !== null),
        }
      : null,
  };
}

/** A keyword search, with each product's details. One request. */
export async function searchProducts(term: string, domain: Domain) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await gql<any>(
    `query ($input: AmazonProductSearchResultsInput!) { amazonProductSearchResults(input: $input) { productResults { results { ${PRODUCT_FIELDS} } } } }`,
    { input: { domain, searchTerm: term } },
  );
  const results = data?.amazonProductSearchResults?.productResults?.results ?? [];
  return (results as unknown[]).map((r) => listed(r, false)).filter((p): p is ListedProduct => p !== null);
}

export async function productDetails(asin: string, domain: Domain): Promise<ProductDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await get<any>('product', { asin, domain });
  const p = data?.data?.amazonProduct;
  if (!p?.asin) throw new UserFacingError('That product wasn’t found on Amazon.');
  const images = Array.from(new Set([p.mainImageUrl, ...(p.imageUrls ?? [])].filter((u): u is string => typeof u === 'string' && u.startsWith('https://')))).slice(0, 12);
  return {
    asin: String(p.asin),
    title: String(p.title ?? ''),
    brand: p.brand ? String(p.brand) : null,
    images,
    featureBullets: ((p.featureBullets ?? []) as unknown[]).filter((b): b is string => typeof b === 'string' && b.trim().length > 0).slice(0, 8),
    rating: num(p.rating),
    ratingsTotal: num(p.ratingsTotal),
    price: price(p.price),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories: ((p.categories ?? []) as any[]).map((c) => String(c?.name ?? '')).filter(Boolean),
    isPrime: Boolean(p.isPrime),
  };
}
