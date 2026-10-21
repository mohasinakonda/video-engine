import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveTarget } from '@/lib/youtube/audit/resolve';
import { runVideoAudit } from '@/lib/youtube/audit/run-video';
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


  return streamAnalysis<'connect' | 'video' | 'channel' | 'analyze' | 'thumbnail' | 'comments' | 'lessons' | 'done'>({
    userId,
    feature: 'audit',
    label: 'audit/video',
    cost: (s) => s.audit.videoAuditCreditCost,
    // A daily cap per user protects the shared YouTube quota.
    reserve: async ({ audit }) =>
      (await consumeQuota(auditBucket(userId), 1, audit.runsPerUserDay)) ? null : `You’ve reached today’s limit of ${audit.runsPerUserDay} analyses. It resets tomorrow.`,
    run: ({ token, settings, onStage }) =>
      runVideoAudit({ accessToken: token.accessToken, myChannelId: token.connection.channelId, videoId: target.videoId, settings, language: parsed.data.language, onStage }),
  });
}
