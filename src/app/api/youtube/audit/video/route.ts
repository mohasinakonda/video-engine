import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchAuditVideo, fetchChannelVideos } from '@/lib/youtube/audit/fetch';
import { resolveTarget } from '@/lib/youtube/audit/resolve';
import { auditVideo } from '@/lib/youtube/audit/video-audit';
import { UserFacingError } from '@/lib/youtube/errors';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({ link: z.string().trim().min(1).max(300) });

const auditBucket = (userId: string) => `audit:user:${userId}`;

/**
 * POST /api/youtube/audit/video — analyze any public video against its own channel's usual
 * (streamed; credits up front, refunded on failure). Nothing about the video is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Paste a YouTube video link.' }, { status: 400 });
  const target = resolveTarget(parsed.data.link);
  if (!target) return NextResponse.json({ error: 'That doesn’t look like a YouTube video link.', code: 'bad_link' }, { status: 400 });
  if (target.kind !== 'video') return NextResponse.json({ error: 'That’s a channel link. Paste a link to one video.', code: 'not_video' }, { status: 400 });

  return streamAnalysis<'connect' | 'video' | 'channel' | 'analyze' | 'done'>({
    userId,
    feature: 'audit',
    label: 'audit/video',
    cost: (s) => s.audit.videoAuditCreditCost,
    // A daily cap per user protects the shared YouTube quota.
    reserve: async ({ audit }) =>
      (await consumeQuota(auditBucket(userId), 1, audit.runsPerUserDay)) ? null : `You’ve reached today’s limit of ${audit.runsPerUserDay} analyses. It resets tomorrow.`,
    run: async ({ token, onStage }) => {
      onStage('video');
      const video = await fetchAuditVideo(token.accessToken, target.videoId);
      if (!video) throw new UserFacingError('YouTube didn’t return this video. It may be private, deleted or age-restricted. Your credits were returned.');
      if (video.liveOrUpcoming) throw new UserFacingError('This is a live stream or an upcoming premiere, so there’s nothing final to analyze yet. Your credits were returned.');

      onStage('channel');
      const channelVideos = await fetchChannelVideos(token.accessToken, video.channelId, 50);

      onStage('analyze');
      const result = auditVideo(video, channelVideos, new Date());
      return {
        video: {
          id: video.id,
          title: video.title,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          durationSec: video.durationSec,
          views: video.views,
        },
        // Your own video has deeper data (click rate, retention) in Channel Doctor's check-up.
        isOwn: video.channelId === token.connection.channelId,
        ...result,
      };
    },
  });
}
