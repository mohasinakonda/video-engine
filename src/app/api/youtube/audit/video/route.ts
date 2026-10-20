import { NextResponse } from 'next/server';
import { z } from 'zod';
import { describeThumbnail, isAllowedThumbnailUrl, type ThumbnailFindings } from '@/lib/youtube/analysis/thumbnails';
import { viewerThemes, type ViewerThemes } from '@/lib/youtube/audit/ai/comments';
import { writeLessons } from '@/lib/youtube/audit/ai/lessons';
import { fetchAuditVideo, fetchChannelVideos, fetchCommentTexts } from '@/lib/youtube/audit/fetch';
import { thumbnailFindings } from '@/lib/youtube/audit/thumbnail-audit';
import { resolveTarget } from '@/lib/youtube/audit/resolve';
import { auditVideo, sortFindings } from '@/lib/youtube/audit/video-audit';
import { UserFacingError } from '@/lib/youtube/errors';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const bodySchema = z.object({ link: z.string().trim().min(1).max(300), language: z.enum(['English', 'Bangla']).optional() });

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

  const language = parsed.data.language ?? 'English';

  return streamAnalysis<'connect' | 'video' | 'channel' | 'analyze' | 'thumbnail' | 'comments' | 'lessons' | 'done'>({
    userId,
    feature: 'audit',
    label: 'audit/video',
    cost: (s) => s.audit.videoAuditCreditCost,
    // A daily cap per user protects the shared YouTube quota.
    reserve: async ({ audit }) =>
      (await consumeQuota(auditBucket(userId), 1, audit.runsPerUserDay)) ? null : `You’ve reached today’s limit of ${audit.runsPerUserDay} analyses. It resets tomorrow.`,
    run: async ({ token, settings, onStage }) => {
      onStage('video');
      const video = await fetchAuditVideo(token.accessToken, target.videoId);
      if (!video) throw new UserFacingError('YouTube didn’t return this video. It may be private, deleted or age-restricted. Your credits were returned.');
      if (video.liveOrUpcoming) throw new UserFacingError('This is a live stream or an upcoming premiere, so there’s nothing final to analyze yet. Your credits were returned.');

      onStage('channel');
      const channelVideos = await fetchChannelVideos(token.accessToken, video.channelId, 50);

      onStage('analyze');
      const result = auditVideo(video, channelVideos, new Date());

      // Thumbnail: Shorts are mostly reached by swiping, not by choosing a thumbnail.
      onStage('thumbnail');
      let thumbnail: ThumbnailFindings | null = null;
      if (result.format === 'short') result.limitations.push('Shorts are mostly found by swiping, so the thumbnail isn’t judged.');
      else if (isAllowedThumbnailUrl(video.thumbnailUrl)) {
        thumbnail = (await describeThumbnail(video.thumbnailUrl, settings.visionModels))?.findings ?? null;
        if (thumbnail) {
          result.findings.push(...thumbnailFindings(thumbnail, video.title));
          sortFindings(result.findings);
        }
        else result.limitations.push('The thumbnail couldn’t be read just now.');
      }

      // What viewers said (public comments, read with the server key; no names kept or sent).
      onStage('comments');
      let viewers: ViewerThemes | null = null;
      const comments = await fetchCommentTexts(video.id, settings.audit.maxComments).catch(() => null);
      if (!comments?.available) result.limitations.push('Viewer comments aren’t read: comment reading isn’t set up.');
      else if (comments.disabled) result.limitations.push('Comments are turned off on this video.');
      else {
        viewers = await viewerThemes(comments.texts, { language, models: settings.textModels });
        if (!viewers) result.limitations.push('The comments couldn’t be grouped just now.');
      }

      onStage('lessons');
      const { verdict, lessons } = await writeLessons({ label: result.performance.label, findings: result.findings, themes: viewers?.themes ?? [], language, models: settings.textModels });

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
        thumbnail,
        viewers,
        verdict,
        lessons,
      };
    },
  });
}
