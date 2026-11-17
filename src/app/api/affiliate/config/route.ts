import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/youtube/route-auth';
import { getChannelDoctorSettings, getUserAccess } from '@/lib/youtube/settings';

export const dynamic = 'force-dynamic';

/** GET /api/affiliate/config — access and current prices for Affiliate Intelligence and the Store (read from admin settings each time). */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const settings = await getChannelDoctorSettings();
  const { affiliate } = settings;
  const { hasAffiliateAccess, isAdmin, tier } = await getUserAccess(auth.user.id, settings);
  return NextResponse.json({
    enabled: affiliate.enabled,
    hasAccess: hasAffiliateAccess,
    adminPreview: isAdmin && !affiliate.enabled,
    tier,
    allowedPlans: affiliate.allowedPlans,
    costs: { search: affiliate.searchCreditCost, video: affiliate.videoCreditCost, seo: affiliate.seoCreditCost },
    limits: { searchesPerDay: affiliate.searchesPerUserDay },
    bioBaseUrl: process.env.NEXT_PUBLIC_BIO_URL || 'https://bio.rendoza.com',
  });
}
