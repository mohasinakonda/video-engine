import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bump, runCost } from '@/lib/youtube/create/bundle';
import { updateProject } from '@/lib/youtube/create/projects';
import { briefSchema } from '@/lib/youtube/create/brief';
import { ownedProject, projectErrorResponse } from '@/lib/youtube/create/route-helpers';
import { channelInfo, recentUploads, searchTopic, videoDetails, type YouTubeAuth } from '@/lib/youtube/create/topic-fetch';
import { COMPETITOR_SCAN, buildLandscape, pickTopicMatches, usualRatio } from '@/lib/youtube/create/topic-landscape';
import { listWatchlist } from '@/lib/youtube/discover/watchlist';
import { UserFacingError } from '@/lib/youtube/errors';
import type { VideoProject } from '@/lib/youtube/create/types';
import { mapLimit } from '@/lib/youtube/fetcher';
import { SEARCH_BUCKET, consumeQuota, quotaUsed, userTopicSearchBucket as userBucket } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * youtubeApiKey: the user's own YouTube Data API key (Launch Kit settings), if they saved one:
 * their quota, not ours. scope: 'auto' checks the followed channels first; 'youtube' always searches.
 */
const bodySchema = z.object({
  youtubeApiKey: z.string().trim().regex(/^[\w-]{30,60}$/).optional(),
  scope: z.enum(['auto', 'youtube']).default('auto'),
});

/**
 * POST /api/create/projects/:id/topic-search — who made videos on this project's topic and how
 * they perform (streamed; credits up front, refunded on failure). When the user follows enough
 * competitors, their latest uploads are checked first (about 2 units per channel); only if too few
 * are about the topic does it run one YouTube search call from the shared daily budget,
 * unless the user brings their own key. Nothing is stored.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That API key doesn’t look valid.' }, { status: 400 });
  const ownKey = parsed.data.youtubeApiKey;
  const scope = parsed.data.scope;
  // Read now (the session is needed); channel ids only.
  const followed = (await listWatchlist(userId).catch(() => [])).filter((r) => r.active).map((r) => r.channelId);
  const tryCompetitors = scope === 'auto' && followed.length >= COMPETITOR_SCAN.minFollowed;
  let searchReserved = false;

  /** Takes one search from the user's daily limit and the shared budget, or says why it can't. */
  const reserveSearch = async (perUserLimit: number, globalLimit: number): Promise<string | null> => {
    if ((await quotaUsed(userBucket(userId))) >= perUserLimit) return `You’ve used today’s ${perUserLimit} topic searches. They reset tomorrow.`;
    if (!ownKey && !(await consumeQuota(SEARCH_BUCKET, 1, globalLimit))) {
      return 'Today’s YouTube search budget is used up. It resets tomorrow, or add your own YouTube API key in Settings.';
    }
    await consumeQuota(userBucket(userId), 1, perUserLimit);
    return null;
  };

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

  return streamAnalysis<'connect' | 'competitors' | 'search' | 'details' | 'channels' | 'done'>({
    userId,
    feature: 'create',
    // With their own key, no connection is needed and our search budget isn't touched.
    needsYouTube: !ownKey,
    label: 'create/topic-search',
    // Included in the video's price while the allowance lasts.
    cost: (s) => runCost(project, s.create, 'topicSearch'),
    // The daily limits guard YouTube searches. Without enough followed channels a search is certain,
    // so it is reserved here, before any charge. Otherwise the followed channels may answer without
    // one, and the search is reserved in run only if it turns out to be needed.
    reserve: async ({ create, discover }) => {
      const limit = create.topicSearchesPerUserDay;
      if (limit <= 0) return 'Topic search is turned off.';
      if (tryCompetitors) return null;
      const blocked = await reserveSearch(limit, discover.searchDailyGlobalLimit);
      searchReserved = !blocked;
      return blocked;
    },
    run: async ({ token, settings, onStage }) => {
      const yt: YouTubeAuth = ownKey ? { key: ownKey } : { token: token.accessToken };
      const now = new Date();

      // 1. The followed channels' latest uploads: often enough to answer without a search.
      if (tryCompetitors) {
        onStage('competitors');
        const scanned = followed.slice(0, COMPETITOR_SCAN.maxChannels);
        const uploads = new Map(
          await mapLimit(scanned, 4, async (id) => [id, await recentUploads(yt, id, COMPETITOR_SCAN.uploadsPerChannel).catch(() => [])] as const)
        );
        const matches = pickTopicMatches(topic, Array.from(uploads.values()).flat());
        if (matches.length >= COMPETITOR_SCAN.minMatches) {
          onStage('channels');
          const channels = await channelInfo(yt, Array.from(new Set(matches.map((v) => v.channelId))));
          // Each channel's other uploads are already here, so "× its usual" costs nothing extra.
          const usual = new Map(matches.map((v) => [v.id, usualRatio(v, uploads.get(v.channelId) ?? [], now)] as [string, number | null]));
          const landscape = buildLandscape({ topic, plannedLines: planned, videos: matches, channels, usual, now, source: { kind: 'competitors', channelsChecked: scanned.length } });
          const updated = await updateProject(userId, project, { usage: bump(project, 'topicSearch') });
          return { landscape, usedOwnKey: !!ownKey, project: updated, followed };
        }
      }

      // 2. A YouTube search (reserved above unless the followed channels were tried first).
      if (!searchReserved) {
        const blocked = await reserveSearch(settings.create.topicSearchesPerUserDay, settings.discover.searchDailyGlobalLimit);
        if (blocked) throw new UserFacingError(`Your competitors had too few videos on this topic. ${blocked}`);
      }

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

      const landscape = buildLandscape({ topic, plannedLines: planned, videos, channels, usual, now, source: { kind: 'youtube' } });
      const updated = await updateProject(userId, project, { usage: bump(project, 'topicSearch') });
      return { landscape, usedOwnKey: !!ownKey, project: updated, followed };
    },
  });
}
