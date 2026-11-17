import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bestSellers, isBestSellerUrl, searchProducts } from '@/lib/affiliate/canopy';
import { rankProducts } from '@/lib/affiliate/rank';
import { DOMAINS, type SearchResult } from '@/lib/affiliate/types';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
// A list with every product's details takes Canopy about a minute.
export const maxDuration = 120;

const requestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('bestsellers'),
    categoryId: z
      .string()
      .trim()
      .regex(/^[\w-]{1,60}$/),
    /** A sub-category's best-seller page (from the last result). */
    categoryUrl: z.string().trim().max(400).refine(isBestSellerUrl).optional(),
    categoryName: z.string().trim().min(1).max(80),
    domain: z.enum(DOMAINS),
  }),
  z.object({
    mode: z.literal('keyword'),
    term: z.string().trim().min(2, 'Type at least 2 letters.').max(100),
    domain: z.enum(DOMAINS),
  }),
]);

/**
 * POST /api/affiliate/search — Amazon best sellers in a niche (or a keyword search) through Canopy,
 * then the best 10 for a review. Charged per search (every Canopy call costs money), refunded if
 * Amazon data can't be read. Nothing is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Pick a niche or type a product.' }, { status: 400 });
  const input = parsed.data;

  return streamAnalysis<'connect' | 'fetch' | 'rank' | 'done'>({
    userId,
    feature: 'affiliate',
    needsYouTube: false,
    label: 'affiliate/search',
    cost: (s) => s.affiliate.searchCreditCost,
    reserve: async ({ affiliate }) =>
      (await consumeQuota(`affiliate-search:user:${userId}`, 1, affiliate.searchesPerUserDay))
        ? null
        : `You’ve used today’s ${affiliate.searchesPerUserDay} searches. They reset tomorrow.`,
    run: async ({ onStage }): Promise<SearchResult> => {
      onStage('fetch');
      if (input.mode === 'bestsellers') {
        const r = await bestSellers({ categoryId: input.categoryId, url: input.categoryUrl }, input.domain);
        onStage('rank');
        return {
          mode: 'bestsellers',
          label: r.category?.current.name || input.categoryName,
          domain: input.domain,
          products: rankProducts(r.products, 'bestsellers'),
          category: r.category,
          searchedAt: new Date().toISOString(),
        };
      }
      const products = await searchProducts(input.term, input.domain);
      onStage('rank');
      return { mode: 'keyword', label: input.term, domain: input.domain, products: rankProducts(products, 'keyword'), category: null, searchedAt: new Date().toISOString() };
    },
  });
}
