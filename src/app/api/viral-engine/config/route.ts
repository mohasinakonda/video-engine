import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/youtube/route-auth';
import { getChannelDoctorSettings, getUserAccess } from '@/lib/youtube/settings';

export const dynamic = 'force-dynamic';

/** GET /api/viral-engine/config — whether this user can run Viral Engine, and its price and limits. */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const settings = await getChannelDoctorSettings();
  const { hasViralAccess, isAdmin } = await getUserAccess(auth.user.id, settings);
  const v = settings.viralEngine;
  return NextResponse.json({
    enabled: v.enabled || isAdmin,
    hasAccess: hasViralAccess,
    cost: v.creditCost,
    maxDurationSec: v.maxDurationSec,
    maxBodyFrames: v.maxBodyFrames,
  });
}
