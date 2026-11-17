/**
 * The store database, for rendoza.com's server only. Every function takes the signed-in user's id
 * (or a store already loaded for them) and only touches that user's store: ownership is checked
 * here, because the store database can't see rendoza's users.
 */
import { z } from 'zod';
import { decryptToken, encryptToken } from '../youtube/crypto';
import { getStoreClient } from './db';
import {
  MARKETPLACES,
  MAX_LINKS,
  handleProblem,
  isAmazonTag,
  isAsin,
  isHttpsUrl,
  normalizeAsin,
  normalizeCategory,
  normalizeHandle,
  normalizeTags,
  type Marketplace,
} from './validation';

export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: 'no_store' | 'has_store' | 'handle_taken' | 'invalid' | 'not_found' | 'db',
  ) {
    super(message);
  }
}

export interface StoreLink {
  label: string;
  url: string;
}

export interface Store {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  marketplace: Marketplace;
  amazonTag: string | null;
  links: StoreLink[];
  imagekitUrlEndpoint: string | null;
  imagekitPublicKey: string | null;
  /** Whether a private key is saved (the key itself is never sent back). */
  hasImagekitPrivateKey: boolean;
  createdAt: string;
}

export interface StoreProduct {
  id: string;
  asin: string;
  name: string;
  imageUrl: string | null;
  blurb: string | null;
  category: string | null;
  tags: string[];
  show: boolean;
  sortOrder: number;
  createdAt: string;
}

// ─── Input schemas (shared with the API routes) ─────────────────────────────

const httpsUrl = z.string().trim().max(1000).refine(isHttpsUrl, 'Use a full https:// link.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

export const createStoreSchema = z.object({
  handle: z
    .string()
    .transform(normalizeHandle)
    .superRefine((h, ctx) => {
      const problem = handleProblem(h);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }),
  displayName: z.string().trim().min(1, 'Add a display name.').max(60),
});

export const updateStoreSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    bio: optionalText(300),
    avatarUrl: httpsUrl.nullable(),
    marketplace: z.enum(MARKETPLACES),
    amazonTag: z
      .string()
      .trim()
      .refine((t) => !t || isAmazonTag(t), 'An Amazon store ID looks like mychannel-20.')
      .transform((v) => v || null)
      .nullable(),
    links: z.array(z.object({ label: z.string().trim().min(1).max(40), url: httpsUrl })).max(MAX_LINKS),
    imagekitUrlEndpoint: z
      .string()
      .trim()
      .refine((u) => !u || /^https:\/\/ik\.imagekit\.io\/[\w-]+\/?$/.test(u), 'It looks like https://ik.imagekit.io/your_id')
      .transform((v) => (v ? v.replace(/\/$/, '') : null))
      .nullable(),
    imagekitPublicKey: optionalText(200),
    /** Sent only to set or replace it; an empty string removes it. */
    imagekitPrivateKey: z.string().trim().max(200).optional(),
  })
  .partial();
export type StoreUpdate = z.infer<typeof updateStoreSchema>;

export const productInputSchema = z.object({
  asin: z.string().transform(normalizeAsin).refine(isAsin, 'An ASIN is 10 letters and numbers, like B0ABCDEF12.'),
  name: z.string().trim().min(1, 'Add a title.').max(200),
  imageUrl: httpsUrl.nullable(),
  /** Other images from Amazon, kept in the shared catalog for the image picker. */
  images: z.array(httpsUrl).max(20).default([]),
  source: z.enum(['canopy', 'manual']),
  category: z.string().max(60).nullable().default(null).transform(normalizeCategory),
  tags: z.array(z.string().max(60)).max(40).default([]).transform(normalizeTags),
  blurb: optionalText(160).default(null),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    imageUrl: httpsUrl.nullable(),
    category: z.string().max(60).nullable().transform(normalizeCategory),
    tags: z.array(z.string().max(60)).max(40).transform(normalizeTags),
    blurb: optionalText(160),
    show: z.boolean(),
    sortOrder: z.number().int().min(-100_000).max(100_000),
  })
  .partial();
export type ProductUpdate = z.input<typeof productUpdateSchema>;

// ─── Mapping ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStore(row: any, hasKey: boolean): Store {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    marketplace: row.marketplace,
    amazonTag: row.amazon_tag,
    links: Array.isArray(row.links) ? row.links : [],
    imagekitUrlEndpoint: row.imagekit_url_endpoint,
    imagekitPublicKey: row.imagekit_public_key,
    hasImagekitPrivateKey: hasKey,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toProduct(row: any): StoreProduct {
  return {
    id: row.id,
    asin: row.asin,
    name: row.name,
    imageUrl: row.image_url,
    blurb: row.blurb,
    category: row.category,
    tags: row.tags ?? [],
    show: row.show,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

const fail = (what: string, error: { code?: string; message?: string }): never => {
  console.error(`[store] ${what} failed:`, error.code);
  throw new StoreError('The store couldn’t be reached. Please try again.', 'db');
};

// ─── Stores ─────────────────────────────────────────────────────────────────

export async function getMyStore(userId: string): Promise<Store | null> {
  const db = getStoreClient();
  const { data, error } = await db.from('stores').select('*').eq('owner_user_id', userId).maybeSingle();
  if (error) fail('get store', error);
  if (!data) return null;
  const { data: secret } = await db.from('store_secrets').select('imagekit_private_key_enc').eq('store_id', data.id).maybeSingle();
  return toStore(data, Boolean(secret?.imagekit_private_key_enc));
}

export async function requireMyStore(userId: string): Promise<Store> {
  const store = await getMyStore(userId);
  if (!store) throw new StoreError('Create your store first: pick a handle.', 'no_store');
  return store;
}

export async function isHandleFree(handle: string): Promise<boolean> {
  const { data, error } = await getStoreClient().from('stores').select('id').eq('handle', normalizeHandle(handle)).maybeSingle();
  if (error) fail('check handle', error);
  return !data;
}

/** One store per user; the handle is set here and can't be changed afterwards. */
export async function createStore(userId: string, input: z.input<typeof createStoreSchema>): Promise<Store> {
  const { handle, displayName } = createStoreSchema.parse(input);
  if (await getMyStore(userId)) throw new StoreError('You already have a store.', 'has_store');
  const { data, error } = await getStoreClient().from('stores').insert({ owner_user_id: userId, handle, display_name: displayName }).select('*').single();
  if (error?.code === '23505') {
    // Unique: either the handle was just taken, or this user created a store a moment ago.
    if (await getMyStore(userId)) throw new StoreError('You already have a store.', 'has_store');
    throw new StoreError('That handle was just taken. Try another.', 'handle_taken');
  }
  if (error || !data) return fail('create store', error ?? {});
  return toStore(data, false);
}

export async function updateStore(userId: string, input: StoreUpdate): Promise<Store> {
  const store = await requireMyStore(userId);
  const u = updateStoreSchema.parse(input);
  const row: Record<string, unknown> = {};
  if (u.displayName !== undefined) row.display_name = u.displayName;
  if (u.bio !== undefined) row.bio = u.bio;
  if (u.avatarUrl !== undefined) row.avatar_url = u.avatarUrl;
  if (u.marketplace !== undefined) row.marketplace = u.marketplace;
  if (u.amazonTag !== undefined) row.amazon_tag = u.amazonTag;
  if (u.links !== undefined) row.links = u.links;
  if (u.imagekitUrlEndpoint !== undefined) row.imagekit_url_endpoint = u.imagekitUrlEndpoint;
  if (u.imagekitPublicKey !== undefined) row.imagekit_public_key = u.imagekitPublicKey;
  const db = getStoreClient();
  if (Object.keys(row).length) {
    const { error } = await db.from('stores').update(row).eq('id', store.id);
    if (error) fail('update store', error);
  }
  if (u.imagekitPrivateKey !== undefined) {
    const enc = u.imagekitPrivateKey ? encryptToken(u.imagekitPrivateKey) : null;
    const { error } = await db.from('store_secrets').upsert({ store_id: store.id, imagekit_private_key_enc: enc });
    if (error) fail('save key', error);
  }
  return requireMyStore(userId);
}

/** The creator's ImageKit private key, decrypted, for signing an upload. Never sent to the browser. */
export async function getImagekitPrivateKey(storeId: string): Promise<string | null> {
  const { data, error } = await getStoreClient().from('store_secrets').select('imagekit_private_key_enc').eq('store_id', storeId).maybeSingle();
  if (error) fail('read key', error);
  return data?.imagekit_private_key_enc ? decryptToken(data.imagekit_private_key_enc) : null;
}

// ─── Products ───────────────────────────────────────────────────────────────

export interface ProductFilter {
  q?: string;
  tag?: string;
  category?: string;
  /** Is this ASIN already in the store? */
  asin?: string;
}

/** All of the creator's products, shown and hidden, in bio order. */
export async function listProducts(storeId: string, filter: ProductFilter = {}): Promise<StoreProduct[]> {
  let query = getStoreClient().from('store_products').select('*').eq('store_id', storeId);
  if (filter.tag) query = query.contains('tags', [filter.tag]);
  if (filter.category) query = query.eq('category', filter.category);
  if (filter.asin) query = query.eq('asin', normalizeAsin(filter.asin));
  const words = (filter.q ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .slice(0, 8);
  if (words.length) query = query.textSearch('search', words.map((w) => `${w}:*`).join(' & '), { config: 'simple' });
  const { data, error } = await query.order('sort_order').order('created_at', { ascending: false }).limit(500);
  if (error) fail('list products', error);
  return (data ?? []).map(toProduct);
}

/** The categories in use, for the category picker. */
export async function listCategories(storeId: string): Promise<string[]> {
  const { data, error } = await getStoreClient().from('store_products').select('category').eq('store_id', storeId).not('category', 'is', null);
  if (error) fail('list categories', error);
  return Array.from(new Set((data ?? []).map((r) => r.category as string))).sort((a, b) => a.localeCompare(b));
}

export async function getProductByAsin(storeId: string, asin: string): Promise<StoreProduct | null> {
  const { data, error } = await getStoreClient().from('store_products').select('*').eq('store_id', storeId).eq('asin', normalizeAsin(asin)).maybeSingle();
  if (error) fail('get product', error);
  return data ? toProduct(data) : null;
}

/** Adds a product, or, when its ASIN is already in the store, adds only the new tags. */
export async function addProduct(storeId: string, input: ProductInput): Promise<{ product: StoreProduct; existed: boolean }> {
  const p = productInputSchema.parse(input);
  const db = getStoreClient();
  const { data, error } = await db.rpc('add_store_product', {
    p_store_id: storeId,
    p_asin: p.asin,
    p_name: p.name,
    p_image_url: p.imageUrl,
    p_images: p.images,
    p_source: p.source,
    p_category: p.category,
    p_tags: p.tags,
    p_blurb: p.blurb,
  });
  if (error) fail('add product', error);
  const result = Array.isArray(data) ? data[0] : data;
  const { data: row, error: readError } = await db.from('store_products').select('*').eq('id', result.id).single();
  if (readError || !row) fail('read product', readError ?? {});
  return { product: toProduct(row), existed: Boolean(result.existed) };
}

export async function updateProduct(storeId: string, id: string, input: ProductUpdate): Promise<StoreProduct> {
  const u = productUpdateSchema.parse(input);
  const row: Record<string, unknown> = {};
  if (u.name !== undefined) row.name = u.name;
  if (u.imageUrl !== undefined) row.image_url = u.imageUrl;
  if (u.category !== undefined) row.category = u.category;
  if (u.tags !== undefined) row.tags = u.tags;
  if (u.blurb !== undefined) row.blurb = u.blurb;
  if (u.show !== undefined) row.show = u.show;
  if (u.sortOrder !== undefined) row.sort_order = u.sortOrder;
  const { data, error } = await getStoreClient().from('store_products').update(row).eq('id', id).eq('store_id', storeId).select('*').maybeSingle();
  if (error) fail('update product', error);
  if (!data) throw new StoreError('That product isn’t in your store.', 'not_found');
  return toProduct(data);
}

export async function deleteProduct(storeId: string, id: string): Promise<void> {
  const { data, error } = await getStoreClient().from('store_products').delete().eq('id', id).eq('store_id', storeId).select('id');
  if (error) fail('delete product', error);
  if (!data?.length) throw new StoreError('That product isn’t in your store.', 'not_found');
}
