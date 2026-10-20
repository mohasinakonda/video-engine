import { NextResponse } from 'next/server';
import { z } from 'zod';
import { briefSchema } from '@/lib/youtube/create/brief';
import { ownedProject, projectErrorResponse } from '@/lib/youtube/create/route-helpers';
import { channelInfo, recentUploads, searchTopic, videoDetails, type YouTubeAuth } from '@/lib/youtube/create/topic-fetch';
import { buildLandscape, usualRatio } from '@/lib/youtube/create/topic-landscape';
import type { VideoProject } from '@/lib/youtube/create/types';
import { mapLimit } from '@/lib/youtube/fetcher';
import { SEARCH_BUCKET, consumeQuota, quotaUsed } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** The user's own YouTube Data API key (Launch Kit settings), if they saved one: their quota, not ours. */
const bodySchema = z.object({ youtubeApiKey: z.string().trim().regex(/^[\w-]{30,60}$/).optional() });

const userBucket = (userId: string) => `topic-search:user:${userId}`;

/**
 * POST /api/create/projects/:id/topic-search — who made videos on this project's topic and how
 * they perform (streamed; credits up front, refunded on failure). One YouTube search per run,
 * from the shared daily search budget unless the user brings their own key. Nothing is stored.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That API key doesn’t look valid.' }, { status: 400 });
  const ownKey = parsed.data.youtubeApiKey;

  let project: VideoProject;
  try {
    const found = await ownedProject(userId, params.id);
    if (found instanceof NextResponse) return found;
    project = found;
  } catch (err) {
    return projectErrorResponse(err, 'topic search');
  }
  const brief = briefSchema.safeParse(project.brief);
  const topic = (brief.success ? brief.data.topic : project.title).trim();
  const language = brief.success ? brief.data.language : 'English';
  const planned = brief.success ? [brief.data.angle, brief.data.corePromise, ...brief.data.titleDirections.map((d) => d.direction)].filter(Boolean) : [project.title];

  return streamAnalysis<'connect' | 'search' | 'details' | 'channels' | 'done'>({
    userId,
    feature: 'create',
    // With their own key, no connection is needed and our search budget isn't touched.
    needsYouTube: !ownKey,
    label: 'create/topic-search',
    cost: (s) => s.create.topicSearchCreditCost,
    reserve: async ({ create, discover }) => {
      const limit = create.topicSearchesPerUserDay;
      if (limit <= 0) return 'Topic search is turned off.';
      if ((await quotaUsed(userBucket(userId))) >= limit) return `You’ve used today’s ${limit} topic searches. They reset tomorrow.`;
      if (!ownKey && !(await consumeQuota(SEARCH_BUCKET, 1, discover.searchDailyGlobalLimit))) {
        return 'Today’s YouTube search budget is used up. It resets tomorrow, or add your own YouTube API key in Settings.';
      }
      await consumeQuota(userBucket(userId), 1, limit);
      return null;
    },
    run: async ({ token, settings, onStage }) => {
      const yt: YouTubeAuth = ownKey ? { key: ownKey } : { token: token.accessToken };
      const now = new Date();

      onStage('search');
      const ids = await searchTopic(yt, topic, language, 50);

      onStage('details');
      const videos = (await videoDetails(yt, ids)).filter((v) => !v.liveOrUpcoming);

      onStage('channels');
      const channels = await channelInfo(yt, Array.from(new Set(videos.map((v) => v.channelId))));
      // "× its usual" for the most-viewed results' channels (about 2 units each).
      const top = [...videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
      const picked: typeof videos = [];
      for (const v of top) if (picked.length < settings.create.topicSearchBaselineChannels && !picked.some((p) => p.channelId === v.channelId)) picked.push(v);
      const usual = new Map<string, number | null>(
        await mapLimit(picked, 5, async (v) => [v.id, usualRatio(v, await recentUploads(yt, v.channelId, 30).catch(() => []), now)] as [string, number | null])
      );

      return { landscape: buildLandscape({ topic, plannedLines: planned, videos, channels, usual, now }), usedOwnKey: !!ownKey };
    },
  });
}
