import { NextResponse } from 'next/server';
import { SEARCH_BUCKET, nextQuotaReset, quotaUsed, userDiscoveryBucket } from '@/lib/youtube/quota-budget';
import { getChannelDoctorSettings, getUserAccess } from '@/lib/youtube/settings';
import { requireUser } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/youtube/discover/config — what the Discover UI needs from the admin settings:
 * access, current credit prices, limits and today's remaining search budget.
 */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const settings = await getChannelDoctorSettings();
  const { discover } = settings;
  const [{ tier, hasDiscoverAccess, hasAuditAccess, isAdmin }, searchUsed, userRuns] = await Promise.all([
    getUserAccess(auth.user.id, settings),
    quotaUsed(SEARCH_BUCKET),
    quotaUsed(userDiscoveryBucket(auth.user.id)),
  ]);

  // A discovery run needs a full set of search calls; fewer left means search is unavailable today.
  const searchCallsLeft = Math.max(0, discover.searchDailyGlobalLimit - searchUsed);
  const userRunsLeft = Math.max(0, discover.discoveryRunsPerUserDay - userRuns);

  return NextResponse.json({
    enabled: discover.enabled,
    hasAccess: hasDiscoverAccess,
    /** True when only the admin bypass gives access (Discover is off for users). */
    adminPreview: isAdmin && !discover.enabled,
    tier,
    allowedPlans: discover.allowedPlans,
    costs: {
      discovery: discover.discoveryCreditCost,
      research: discover.researchCreditCost,
      opportunity: discover.opportunityCreditCost,
    },
    maxCompetitors: discover.maxCompetitors,
    // Analyzing any channel or video (docs/audit-plan.md).
    audit: {
      enabled: settings.audit.enabled,
      hasAccess: hasAuditAccess,
      costs: { video: settings.audit.videoAuditCreditCost, channel: settings.audit.channelAuditCreditCost },
    },
    search: {
      available: searchCallsLeft >= discover.searchCallsPerDiscovery && userRunsLeft > 0,
      phrasesPerRun: discover.searchCallsPerDiscovery,
      userRunsLeft,
      resetsAt: nextQuotaReset(),
    },
  });
}
