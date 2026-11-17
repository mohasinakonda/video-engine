/**
 * The best 10 for a product-review creator, without AI: products that sell (best-seller rank) and
 * that buyers rate well, so a review doesn't recommend something people return. Sponsored results
 * and products without a photo are left out. Every pick says why it is on the list.
 */
import type { ListedProduct, RankedProduct } from './types';

export const SHOWN = 10;

const GATES = [
  { rating: 4.0, ratings: 100 },
  { rating: 3.8, ratings: 30 },
  { rating: 0, ratings: 0 },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ratingScore = (r: number | null) => (r === null ? 0 : clamp01((r - 3.5) / 1.5));
const popularity = (n: number | null) => (n === null || n <= 0 ? 0 : clamp01((Math.log10(n) - 1) / 4));
const fmt = (n: number) => n.toLocaleString('en-US');

export function rankProducts(items: ListedProduct[], mode: 'bestsellers' | 'keyword', limit = SHOWN): RankedProduct[] {
  const seen = new Set<string>();
  const pool = items.filter((p) => !p.sponsored && p.imageUrl && !seen.has(p.asin) && seen.add(p.asin));
  const maxRank = Math.max(1, ...pool.map((p) => p.bestSellersRank ?? 0));

  const score = (p: ListedProduct) => {
    const quality = ratingScore(p.rating);
    const reviews = popularity(p.ratingsTotal);
    const bonus = (p.isPrime ? 0.03 : 0) + (p.coupon ? 0.02 : 0);
    if (mode === 'bestsellers' && p.bestSellersRank !== null) {
      const sales = 1 - (p.bestSellersRank - 1) / maxRank;
      return 0.5 * sales + 0.35 * quality + 0.15 * reviews + bonus;
    }
    return 0.6 * quality + 0.4 * reviews + bonus;
  };

  // Strict quality first; relax only as far as needed to fill the list.
  // Products that only fill the list stay below the ones that passed the stricter bar.
  const picked: ListedProduct[] = [];
  for (const gate of GATES) {
    for (const p of [...pool].sort((a, b) => score(b) - score(a))) {
      if (picked.length >= limit) break;
      if (picked.includes(p)) continue;
      if ((p.rating ?? 0) >= gate.rating && (p.ratingsTotal ?? 0) >= gate.ratings) picked.push(p);
    }
    if (picked.length >= limit) break;
  }

  return picked.map((p, i) => {
    const reasons: string[] = [];
    if (p.bestSellersRank !== null) reasons.push(`#${p.bestSellersRank} best seller`);
    if (p.rating !== null && p.ratingsTotal !== null) reasons.push(`${p.rating.toFixed(1)}★ from ${fmt(p.ratingsTotal)} ratings`);
    if (p.rating !== null && p.rating < 4) reasons.push('rated under 4★: check reviews first');
    if (p.isPrime) reasons.push('Prime');
    if (p.coupon) reasons.push(p.coupon);
    return { ...p, rank: i + 1, score: Math.round(score(p) * 100) / 100, reasons };
  });
}
