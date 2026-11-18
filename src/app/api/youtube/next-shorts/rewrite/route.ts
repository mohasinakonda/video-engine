import { NextResponse } from 'next/server';
import { UserFacingError } from '@/lib/youtube/errors';
import { rewriteRequestSchema } from '@/lib/youtube/next-shorts/types';
import { rewriteShort } from '@/lib/youtube/next-shorts/writer';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/**
 * POST /api/youtube/next-shorts/rewrite — a new storyboard for one Short of a saved batch (same
 * idea, the creator's note applied). Create plans only; one script's price up front, refunded if
 * nothing comes back. Nothing is stored: the browser replaces the Short in its saved ideas.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const parsed = rewriteRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'This Short can’t be rewritten. Make new ideas instead.', code: 'input' }, { status: 400 });
  const input = parsed.data;

  return streamAnalysis<'connect' | 'scripts' | 'done'>({
    userId: auth.user.id,
    feature: 'create',
    needsYouTube: false,
    label: 'youtube/next-shorts/rewrite',
    cost: (settings) => settings.create.scriptCreditCost,
    run: async ({ settings, onStage }) => {
      onStage('scripts');
      const short = await rewriteShort(input, settings.textModels);
      if (!short) throw new UserFacingError('The AI couldn’t rewrite this Short right now. Your credits were returned; please try again.');
      return short;
    },
  });
}
