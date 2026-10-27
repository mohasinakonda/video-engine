import { NextResponse } from 'next/server';
import { z } from 'zod';
import { channelInfo, searchTopic, videoDetails } from '@/lib/youtube/create/topic-fetch';
import { channelsFromResults, cleanSearchQuery, searchLanguage } from '@/lib/youtube/discover/channel-search';
import { googleErrorResponse, requireDiscover, tokenOrResponse } from '@/lib/youtube/discover/route-helpers';
import { listWatchlist } from '@/lib/youtube/discover/watchlist';
import { SEARCH_BUCKET, consumeQuota, quotaUsed, userTopicSearchBucket } from '@/lib/youtube/quota-budget';
import { withQuotaMeter } from '@/lib/youtube/quota-meter';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ query: z.string().trim().min(2).max(100) });

/**
 * POST /api/youtube/discover/channel-search — the channels behind a topic's top YouTube videos,
 * to add as competitors. One search call (search has its own daily limit) plus 2 units of details; no credits. Counts
 * against the user's daily topic searches (shared with Create) and the app's search budget.
 * Nothing is stored.
 */
export function POST(req: Request) {
  return withQuotaMeter('discover/channel-search', () => searchChannels(req));
}

async function searchChannels(req: Request) {
  const auth = await requireDiscover();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const query = parsed.success ? cleanSearchQuery(parsed.data.query) : '';
  if (!query) return NextResponse.json({ error: 'Type a topic of at least 2 letters.' }, { status: 400 });

  const token = await tokenOrResponse(userId);
  if (token instanceof NextResponse) return token;

  const { create } = await getChannelDoctorSettings();
  const limit = create.topicSearchesPerUserDay;
  const bucket = userTopicSearchBucket(userId);
  if (limit <= 0) return NextResponse.json({ error: 'Topic search is turned off. You can still add channels by link.' }, { status: 403 });
  if ((await quotaUsed(bucket)) >= limit) {
    return NextResponse.json({ error: `You’ve used today’s ${limit} topic searches. They reset tomorrow. You can still add channels by link.`, code: 'limit' }, { status: 429 });
  }
  if (!(await consumeQuota(SEARCH_BUCKET, 1, auth.settings.searchDailyGlobalLimit))) {
    return NextResponse.json({ error: 'Today’s YouTube search limit for our app is used up. You can still add channels by link.', code: 'budget' }, { status: 429 });
  }
  await consumeQuota(bucket, 1, limit);

  try {
    const yt = { token: token.accessToken };
    const followed = (await listWatchlist(userId)).map((r) => r.channelId);
    const ids = await searchTopic(yt, query, searchLanguage(query), 50);
    const videos = await videoDetails(yt, ids);
    const channels = await channelInfo(yt, Array.from(new Set(videos.map((v) => v.channelId))));
    const hits = channelsFromResults({ videos, channels, ownChannelId: token.connection.channelId, followed });
    return NextResponse.json({ query, channels: hits, searchesLeft: Math.max(0, limit - (await quotaUsed(bucket))) });
  } catch (err) {
    return googleErrorResponse(err, 'discover/channel-search');
  }
}
