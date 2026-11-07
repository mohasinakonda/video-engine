import { NextResponse } from 'next/server';
import { parseVideoId } from '@/lib/youtube/audit/resolve';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';
import { MAX_BODY_BYTES, viralRequestSchema } from '@/lib/viral-engine/request';
import { runViralEngine, type ViralStage } from '@/lib/viral-engine/server/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/viral-engine — frame-by-frame check of one Short, streamed as NDJSON (credits up front,
 * refunded on failure). The browser sends still frames and measured numbers, never the video.
 * Nothing is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'Too much data was sent. Please try again.' }, { status: 413 });
  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Too much data was sent. Please try again.' }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = viralRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const request = parsed.data;

  const videoId = request.videoLink ? parseVideoId(request.videoLink) : null;
  // A linked Short always needs the channel, for its retention.
  const useChannel = request.useChannel || Boolean(videoId);
  if (request.videoLink && !videoId) {
    return NextResponse.json({ error: 'That doesn’t look like a YouTube link. Paste the link to your published Short, or leave it empty.' }, { status: 400 });
  }

  const settings = await getChannelDoctorSettings();
  const limits = settings.viralEngine;
  if (request.signals.durationSec > limits.maxDurationSec + 1) {
    return NextResponse.json({ error: `Shorts up to ${limits.maxDurationSec} seconds can be checked.` }, { status: 400 });
  }
  if (request.sheets.reduce((n, s) => n + s.times.length, 0) > limits.maxBodyFrames) {
    return NextResponse.json({ error: 'Too many frames were sent. Please reload the page and try again.' }, { status: 400 });
  }

  return streamAnalysis<ViralStage>({
    userId,
    feature: 'viral',
    // YouTube is only needed to compare with the channel; without it, unconnected users can run it.
    needsYouTube: useChannel,
    label: 'viral-engine',
    cost: (s) => s.viralEngine.creditCost,
    reserve: async ({ viralEngine }) =>
      (await consumeQuota(`viral-engine:user:${userId}`, 1, viralEngine.runsPerUserDay))
        ? null
        : `You’ve used today’s ${viralEngine.runsPerUserDay} Viral Engine checks. They reset tomorrow.`,
    run: ({ token, settings, onStage }) =>
      runViralEngine({
        request,
        videoId,
        token: useChannel ? { accessToken: token.accessToken, connection: token.connection } : null,
        settings,
        onStage,
      }),
  });
}
