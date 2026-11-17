import { NextResponse } from 'next/server';
import { videoRequestSchema, type ProductFacts } from '@/lib/affiliate/video/types';
import { writeVideoPack } from '@/lib/affiliate/video/writer';
import { UserFacingError } from '@/lib/youtube/errors';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/**
 * POST /api/affiliate/video — the Flow prompts for a product-review Short of the selected products
 * (up to 5, 8 seconds each), written from the details that came with the search (the listing's own
 * feature bullets), so the script only claims what the listing says. Charged up front, refunded if nothing comes back. Nothing is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const parsed = videoRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Select 1 to 5 products first.' }, { status: 400 });
  const input = parsed.data;

  return streamAnalysis<'connect' | 'script' | 'done'>({
    userId: auth.user.id,
    feature: 'affiliate',
    needsYouTube: false,
    label: 'affiliate/video',
    cost: (s) => s.affiliate.videoCreditCost,
    run: async ({ settings, onStage }) => {
      // The products' details came with the search (one Canopy call for the whole list): no second read.
      const products: ProductFacts[] = input.products.map((p) => ({ asin: p.asin, title: p.title, brand: p.brand, bullets: p.featureBullets, imageUrl: p.imageUrl }));
      onStage('script');
      const pack = await writeVideoPack(input, products, settings.textModels);
      if (!pack) throw new UserFacingError('The AI couldn’t write the video right now. Your credits were returned; please try again.');
      return pack;
    },
  });
}
