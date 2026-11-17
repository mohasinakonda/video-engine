import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeSeo } from '@/lib/affiliate/video/writer';
import { getMyStore } from '@/lib/store/repo';
import { UserFacingError } from '@/lib/youtube/errors';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({
  label: z.string().trim().min(1).max(80),
  videoTag: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),
  hook: z.string().trim().min(1).max(160),
  productNames: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  productTitles: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
});

/**
 * POST /api/affiliate/seo — titles, thumbnail, description (with the bio link for this video's
 * products), keywords and hashtags. Charged up front, refunded if nothing comes back.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Make the video prompts first.' }, { status: 400 });
  const input = parsed.data;

  return streamAnalysis<'connect' | 'seo' | 'done'>({
    userId: auth.user.id,
    feature: 'affiliate',
    needsYouTube: false,
    label: 'affiliate/seo',
    cost: (s) => s.affiliate.seoCreditCost,
    run: async ({ settings, onStage }) => {
      onStage('seo');
      // The bio link shows just this video's products (their tag). No store yet: "link in my bio".
      const store = await getMyStore(auth.user.id).catch(() => null);
      const base = (process.env.NEXT_PUBLIC_BIO_URL || 'https://bio.rendoza.com').replace(/\/$/, '');
      const bioLink = store ? `${base}/@${store.handle}?q=${input.videoTag}` : null;
      const seo = await writeSeo(input, bioLink, settings.textModels);
      if (!seo) throw new UserFacingError('The AI couldn’t write the SEO pack right now. Your credits were returned; please try again.');
      return seo;
    },
  });
}
