import { NextResponse } from 'next/server';
import { UserFacingError } from '@/lib/youtube/errors';
import { packagingRequestSchema, writeShortPackaging } from '@/lib/youtube/next-shorts/packaging';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/youtube/next-shorts/packaging — title options, description, hashtags, cover and a
 * pinned comment for one planned Short (sent by the browser, which holds the ideas). Create
 * plans only; the packaging price up front, refunded if nothing comes back. Nothing is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const parsed = packagingRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'This Short is missing its storyboard. Make the ideas again.', code: 'input' }, { status: 400 });
  const input = parsed.data;

  return streamAnalysis<'connect' | 'packaging' | 'done'>({
    userId: auth.user.id,
    feature: 'create',
    needsYouTube: false,
    label: 'youtube/next-shorts/packaging',
    cost: (settings) => settings.create.packagingCreditCost,
    run: async ({ settings, onStage }) => {
      onStage('packaging');
      const packaging = await writeShortPackaging(input, settings.textModels);
      if (!packaging || packaging.titles.length === 0) throw new UserFacingError('The AI couldn’t write the packaging right now. Your credits were returned; please try again.');
      return packaging;
    },
  });
}
