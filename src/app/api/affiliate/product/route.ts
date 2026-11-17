import { NextResponse } from 'next/server';
import { z } from 'zod';
import { productDetails } from '@/lib/affiliate/canopy';
import { DOMAINS } from '@/lib/affiliate/types';
import { requireAffiliate, storeErrorResponse } from '@/lib/store/route-helpers';
import { UserFacingError } from '@/lib/youtube/errors';
import { consumeQuota } from '@/lib/youtube/quota-budget';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const schema = z.object({ asin: z.string().regex(/^[A-Z0-9]{10}$/), domain: z.enum(DOMAINS) });

/**
 * POST /api/affiliate/product — one product's photos, feature bullets and categories (for the side
 * panel and the Add to bio modal). No credits, but a daily limit: each lookup is a paid Canopy call.
 */
export async function POST(req: Request) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'That isn’t a product.' }, { status: 400 });
  if (!(await consumeQuota(`affiliate-details:user:${auth.user.id}`, 1, auth.settings.detailsPerUserDay))) {
    return NextResponse.json({ error: `You’ve opened ${auth.settings.detailsPerUserDay} products today. The limit resets tomorrow.`, code: 'limit' }, { status: 429 });
  }
  try {
    return NextResponse.json({ product: await productDetails(parsed.data.asin, parsed.data.domain) });
  } catch (err) {
    if (err instanceof UserFacingError) return NextResponse.json({ error: err.message }, { status: 502 });
    return storeErrorResponse(err, 'product details');
  }
}
