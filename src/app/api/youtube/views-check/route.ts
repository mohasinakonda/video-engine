import { NextResponse } from 'next/server';
import { consumeQuota } from '@/lib/youtube/quota-budget';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';
import { runViewsCheck, type ViewsCheckRunStage } from '@/lib/youtube/views-check/run';
import { getChannelDoctorSettings, getUserAccess } from '@/lib/youtube/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/youtube/views-check — why recent videos get (almost) no views and why Shorts stop
 * after a first burst, streamed as NDJSON (credits up front, refunded on failure). Nothing is stored.
 */
export async function POST() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const settings = await getChannelDoctorSettings();
  // Admins can test it while it is off for users.
  if (!settings.viewsCheck.enabled && !(await getUserAccess(userId, settings)).isAdmin) {
    return NextResponse.json({ error: 'The views check is not available yet.' }, { status: 503 });
  }

  return streamAnalysis<ViewsCheckRunStage>({
    userId,
    label: 'youtube/views-check',
    cost: (s) => s.viewsCheck.creditCost,
    reserve: async ({ viewsCheck }) =>
      (await consumeQuota(`views-check:user:${userId}`, 1, viewsCheck.runsPerUserDay))
        ? null
        : `You’ve used today’s ${viewsCheck.runsPerUserDay} views checks. They reset tomorrow.`,
    run: ({ token, settings, onStage }) =>
      runViewsCheck({
        userId,
        accessToken: token.accessToken,
        connection: token.connection,
        reportingJobId: token.reportingJobId,
        settings,
        onStage,
      }),
  });
}
