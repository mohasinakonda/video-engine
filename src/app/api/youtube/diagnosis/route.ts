import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runDiagnosis } from '@/lib/youtube/diagnosis';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({ range: z.enum(['28d', '90d']) });

/**
 * POST /api/youtube/diagnosis — full channel diagnosis, streamed as NDJSON:
 * {"type":"stage"} lines, then one {"type":"result"} or {"type":"error"}.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose 28 or 90 days.' }, { status: 400 });

  return streamAnalysis({
    userId: auth.user.id,
    label: 'youtube/diagnosis',
    cost: (settings) => settings.diagnosisCreditCost,
    // Trial users get their first diagnosis free (admin-set count).
    trialFree: true,
    run: ({ token, settings, onStage }) =>
      runDiagnosis({
        userId: auth.user.id,
        accessToken: token.accessToken,
        connection: token.connection,
        reportingJobId: token.reportingJobId,
        settings,
        range: parsed.data.range,
        onStage,
      }),
  });
}
