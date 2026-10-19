import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runDiscovery } from '@/lib/youtube/discover/discovery';
import { queryText } from '@/lib/youtube/discover/queries';
import type { DiscoveryStage } from '@/lib/youtube/discover/types';
import { listWatchlist } from '@/lib/youtube/discover/watchlist';
import { SEARCH_BUCKET, consumeQuota, quotaUsed, userDiscoveryBucket } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({ queries: z.array(queryText).min(1).max(5) });

/**
 * POST /api/youtube/discover/discovery — find competitor candidates, streamed as NDJSON.
 * Reserves the run's search calls from the shared daily budget before charging credits.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Add at least one search phrase.' }, { status: 400 });
  }

  let queries: string[] = [];
  let watchlistIds: string[] = [];
  return streamAnalysis<DiscoveryStage>({
    userId,
    feature: 'discover',
    label: 'discover/discovery',
    cost: (settings) => settings.discover.discoveryCreditCost,
    reserve: async ({ discover }) => {
      queries = Array.from(new Set(parsed.data.queries.map((q) => q.toLowerCase()))).slice(0, discover.searchCallsPerDiscovery);
      // Read here, inside the request: the session client needs the request's cookies.
      watchlistIds = (await listWatchlist(userId)).map((r) => r.channelId);
      // Read first so a refused run doesn't use up either counter.
      const [userRuns, searchUsed] = await Promise.all([quotaUsed(userDiscoveryBucket(userId)), quotaUsed(SEARCH_BUCKET)]);
      if (userRuns >= discover.discoveryRunsPerUserDay) {
        return `You can search for competitors ${discover.discoveryRunsPerUserDay} time${discover.discoveryRunsPerUserDay === 1 ? '' : 's'} a day. You can still add competitors by pasting their channel link.`;
      }
      if (searchUsed + queries.length > discover.searchDailyGlobalLimit) {
        return 'Today’s YouTube search limit for our app is used up. You can still add competitors by pasting their channel link, or try again after the daily reset.';
      }
      const reserved =
        (await consumeQuota(SEARCH_BUCKET, queries.length, discover.searchDailyGlobalLimit)) &&
        (await consumeQuota(userDiscoveryBucket(userId), 1, discover.discoveryRunsPerUserDay));
      return reserved ? null : 'Today’s search limit was just reached. Please try again after the daily reset.';
    },
    run: async ({ token, settings, onStage }) =>
      runDiscovery({
        accessToken: token.accessToken,
        connection: token.connection,
        settings: settings.discover,
        queries,
        watchlistIds,
        onStage,
      }),
  });
}
