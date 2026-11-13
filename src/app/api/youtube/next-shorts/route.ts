import { NextResponse } from 'next/server';
import { UserFacingError } from '@/lib/youtube/errors';
import { writeNextShorts } from '@/lib/youtube/next-shorts/writer';
import { requestSchema } from '@/lib/youtube/next-shorts/types';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/youtube/next-shorts — the next batch of Shorts from the creator's own views check
 * (sent by the browser, which holds it): ideas, second-by-second Flow scripts and packaging.
 * Create plans only; credits per Short up front, refunded if nothing comes back. Nothing is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Run the views check first: it needs at least 3 of your Shorts.', code: 'input' }, { status: 400 });
  }
  const input = parsed.data;

  return streamAnalysis<'connect' | 'ideas' | 'scripts' | 'done'>({
    userId: auth.user.id,
    feature: 'create',
    needsYouTube: false,
    label: 'youtube/next-shorts',
    // One script's price per Short.
    cost: (settings) => settings.create.scriptCreditCost * input.count,
    run: async ({ settings, onStage }) => {
      const pack = await writeNextShorts(input, settings.textModels, onStage);
      if (!pack) throw new UserFacingError('The AI couldn’t write your Shorts right now. Your credits were returned; please try again.');
      return pack;
    },
  });
}
