import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';
import { ownVideoExtras } from '@/lib/youtube/audit/own-video';
import { analyzeSingleVideo } from '@/lib/youtube/video-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const bodySchema = z.object({ range: z.enum(['28d', '90d']) });
const videoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

/** POST /api/youtube/videos/[videoId]/analysis — one video, streamed like the channel diagnosis. */
export async function POST(req: Request, { params }: { params: { videoId: string } }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const videoId = videoIdSchema.safeParse(params.videoId);
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!videoId.success || !body.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  return streamAnalysis({
    userId: auth.user.id,
    label: 'youtube/video-analysis',
    cost: (settings) => settings.videoAnalysisCreditCost,
    run: async ({ token, settings, onStage }) => {
      const result = await analyzeSingleVideo({
        accessToken: token.accessToken,
        connection: token.connection,
        reportingJobId: token.reportingJobId,
        settings,
        videoId: videoId.data,
        range: body.data.range,
        onStage,
      });
      // Packaging rules, what viewers say, and (for Create videos) retention by script part.
      const extras = await ownVideoExtras({
        userId: auth.user.id,
        accessToken: token.accessToken,
        videoId: videoId.data,
        title: result.video.title,
        durationSec: result.video.durationSec,
        thumbnail: result.thumbnail,
        retention: result.retention,
        maxComments: settings.audit.maxComments,
        textModels: settings.textModels,
      }).catch(() => null);
      return extras ? { ...result, extras, limitations: [...result.limitations, ...extras.limitations] } : result;
    },
  });
}
