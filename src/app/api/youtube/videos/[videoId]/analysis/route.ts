import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';
import { analyzeSingleVideo } from '@/lib/youtube/video-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
    run: ({ token, settings, onStage }) =>
      analyzeSingleVideo({
        accessToken: token.accessToken,
        connection: token.connection,
        reportingJobId: token.reportingJobId,
        settings,
        videoId: videoId.data,
        range: body.data.range,
        onStage,
      }),
  });
}
