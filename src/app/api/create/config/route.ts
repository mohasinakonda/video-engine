import { NextResponse } from 'next/server';
import { getChannelDoctorSettings, getUserAccess } from '@/lib/youtube/settings';
import { sectionCost } from '@/lib/youtube/create/script';
import { requireUser } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/** GET /api/create/config — access and current prices for the Create pages (read from admin settings each time). */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const settings = await getChannelDoctorSettings();
  const { create } = settings;
  const { hasCreateAccess, isAdmin, tier } = await getUserAccess(auth.user.id, settings);
  return NextResponse.json({
    enabled: create.enabled,
    hasAccess: hasCreateAccess,
    adminPreview: isAdmin && !create.enabled,
    tier,
    allowedPlans: create.allowedPlans,
    topicSearchesPerDay: create.topicSearchesPerUserDay,
    // One price per video, and the AI runs it includes (docs/create-plan.md §20).
    bundle: {
      cost: create.bundleCreditCost,
      includes: {
        brief: create.bundleBriefDrafts,
        script: create.bundleScriptWrites,
        section: create.bundleSectionRewrites,
        packaging: create.bundlePackagingRuns,
        topicSearch: create.bundleTopicSearches,
      },
    },
    costs: {
      brief: create.briefCreditCost,
      script: create.scriptCreditCost,
      scriptSection: sectionCost(create.scriptCreditCost),
      packaging: create.packagingCreditCost,
      topicSearch: create.topicSearchCreditCost,
    },
  });
}
