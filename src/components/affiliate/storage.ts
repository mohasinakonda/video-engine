/**
 * What Affiliate Intelligence keeps in this browser: the products selected for a video (up to 5)
 * and the last video pack. Shared by the products page and the video page.
 */
import type { ProductDetails, RankedProduct } from '@/lib/affiliate/types';
import type { SavedPack } from './video-pack';

export const MAX_SELECTED = 5;

const selectionKey = (userId: string) => `affiliate:selection:v1:${userId}`;
const packKey = (userId: string) => `affiliate:pack:v1:${userId}`;

export function loadSelection(userId: string): RankedProduct[] {
  try {
    const raw = window.localStorage.getItem(selectionKey(userId));
    const list = raw ? (JSON.parse(raw) as RankedProduct[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX_SELECTED) : [];
  } catch {
    return [];
  }
}

export function saveSelection(userId: string, list: RankedProduct[]) {
  try {
    window.localStorage.setItem(selectionKey(userId), JSON.stringify(list));
  } catch {
    // storage blocked: the selection lasts for this visit only
  }
}

export function loadPack(userId: string): SavedPack | null {
  try {
    const raw = window.localStorage.getItem(packKey(userId));
    const p = raw ? (JSON.parse(raw) as SavedPack) : null;
    return p?.version === 1 ? p : null;
  } catch {
    return null;
  }
}

export function savePack(userId: string, pack: SavedPack | null) {
  try {
    if (pack) window.localStorage.setItem(packKey(userId), JSON.stringify(pack));
    else window.localStorage.removeItem(packKey(userId));
  } catch {
    // storage blocked: the pack lasts for this visit only
  }
}

/** The details a search already brought (photos, brand, bullets): no extra Canopy call. */
export function detailsFromList(p: RankedProduct): ProductDetails {
  return {
    asin: p.asin,
    title: p.title,
    brand: p.brand ?? null,
    images: p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [],
    featureBullets: p.featureBullets ?? [],
    rating: p.rating,
    ratingsTotal: p.ratingsTotal,
    price: p.price,
    categories: [],
    isPrime: p.isPrime,
  };
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}
