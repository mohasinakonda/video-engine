import { NextResponse } from 'next/server';
import { getChannelDoctorSettings, getUserAccess } from '@/lib/youtube/settings';
import { requireUser } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/** GET /api/youtube/config — the parts of the admin settings the Channel Doctor UI needs. */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const settings = await getChannelDoctorSettings();
  const { tier, hasAccess } = await getUserAccess(auth.user.id, settings);

  return NextResponse.json({
    enabled: settings.enabled,
    hasAccess,
    tier,
    allowedPlans: settings.allowedPlans,
    diagnosisCost: settings.diagnosisCreditCost,
    videoCost: settings.videoAnalysisCreditCost,
  });
}
