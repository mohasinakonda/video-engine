import { NextResponse } from 'next/server';
import { fetchAIModelsRemote } from '@/lib/supabase-service';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';
import { pricingCatalog } from '@/lib/pricing-catalog';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pricing/catalog — public: which plans include each YouTube growth tool, what each run
 * costs, and the image models' prices, straight from the admin settings. No user data.
 */
export async function GET() {
  try {
    const [settings, models] = await Promise.all([getChannelDoctorSettings(), fetchAIModelsRemote(createServerClient(), false).catch(() => null)]);
    return NextResponse.json(pricingCatalog(settings, models ?? []));
  } catch (err) {
    console.error('[API /api/pricing/catalog] failed:', err);
    return NextResponse.json({ error: 'Could not load prices.' }, { status: 500 });
  }
}
