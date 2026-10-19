import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MIN_COMPETITORS, runResearch } from '@/lib/youtube/discover/research';
import type { ResearchStage } from '@/lib/youtube/discover/types';
import { listWatchlist } from '@/lib/youtube/discover/watchlist';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({ window: z.enum(['30d', '90d']) });

/**
 * POST /api/youtube/discover/research — market research on the active watchlist, streamed
 * as NDJSON. Competitor ids come from the user's saved rows, never from the request.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose 30 or 90 days.' }, { status: 400 });

  let competitorIds: string[] = [];
  return streamAnalysis<ResearchStage>({
    userId,
    feature: 'discover',
    label: 'discover/research',
    cost: (settings) => settings.discover.researchCreditCost,
    reserve: async ({ discover }) => {
      // Read here, inside the request: the session client needs the request's cookies.
      competitorIds = (await listWatchlist(userId))
        .filter((r) => r.active)
        .map((r) => r.channelId)
        .slice(0, discover.maxCompetitors);
      return competitorIds.length < MIN_COMPETITORS ? `Add at least ${MIN_COMPETITORS} competitors before running research.` : null;
    },
    run: ({ token, settings, onStage }) =>
      runResearch({
        accessToken: token.accessToken,
        connection: token.connection,
        settings: settings.discover,
        window: parsed.data.window,
        competitorIds,
        onStage,
      }),
  });
}
