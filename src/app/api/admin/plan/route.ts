import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  fetchPlansRemote,
  savePlansRemote,
  fetchTopupPacksRemote,
  saveTopupPacksRemote,
  fetchAdminSettingsRemote,
  saveAdminSettingsRemote,
  fetchPromoCodesRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import {
  getSubscriptionPlans,
  getTopupPacks,
  getAdminSettings,
  getAllPromoCodes,
  saveSubscriptionPlans,
  saveTopupPacks,
  saveAdminSettings,
} from '@/lib/subscription-store';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  AdminSettings,
} from '@/types/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isSupabaseConfigured();
  let isLiveSupabase = false;

  let plans = null;
  let topupPacks = null;
  let settings = null;
  let promoCodes = null;

  if (configured) {
    try {
      let serverClient: any = null;
      try {
        serverClient = createServerClient();
      } catch (err) {
        console.warn('[API /api/admin/plan] Could not create serverClient, falling back to anon:', err);
      }

      const [remotePlans, remoteTopups, remoteSettings, remotePromos] = await Promise.all([
        fetchPlansRemote(serverClient),
        fetchTopupPacksRemote(serverClient),
        fetchAdminSettingsRemote(serverClient),
        fetchPromoCodesRemote(),
      ]);

      if (remotePlans && remotePlans.length > 0) {
        plans = remotePlans;
        isLiveSupabase = true;
      }
      if (remoteTopups && remoteTopups.length > 0) {
        topupPacks = remoteTopups;
      }
      if (remoteSettings) {
        settings = remoteSettings;
      }
      if (remotePromos && remotePromos.length > 0) {
        promoCodes = remotePromos;
      }
    } catch (err) {
      console.warn('[API /api/admin/plan] Supabase fetch fallback to local:', err);
    }
  }

  // Fallback to local store defaults if remote data is not yet in Supabase
  const finalPlans = plans || getSubscriptionPlans();
  const finalTopups = topupPacks || getTopupPacks();
  const finalSettings = settings || getAdminSettings();
  const finalPromos = promoCodes || getAllPromoCodes();

  return NextResponse.json({
    success: true,
    isLiveSupabase,
    isConfigured: configured,
    plans: finalPlans,
    topupPacks: finalTopups,
    settings: finalSettings,
    promoCodes: finalPromos,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      plans,
      topupPacks,
      settings,
    }: {
      plans?: SubscriptionPlan[];
      topupPacks?: CreditTopupPack[];
      settings?: AdminSettings;
    } = body;

    let savedToSupabase = false;

    // 1. Sync to Supabase cloud if configured
    if (isSupabaseConfigured()) {
      try {
        const serverClient = createServerClient();
        const promises = [];
        if (plans) promises.push(savePlansRemote(plans, serverClient));
        if (topupPacks) promises.push(saveTopupPacksRemote(topupPacks, serverClient));
        if (settings) promises.push(saveAdminSettingsRemote(settings, serverClient));

        const results = await Promise.all(promises);
        savedToSupabase = results.every(Boolean);
      } catch (err) {
        console.warn('[API /api/admin/plan] Error saving to Supabase:', err);
        savedToSupabase = false;
      }
    }

    // 2. Always persist to local storage cache so client store stays synced
    if (plans) saveSubscriptionPlans(plans);
    if (topupPacks) saveTopupPacks(topupPacks);
    if (settings) saveAdminSettings(settings);

    return NextResponse.json({
      success: true,
      savedToSupabase,
      message: savedToSupabase
        ? 'Successfully saved all plans and settings to Supabase Cloud!'
        : 'Saved locally. (Run supabase/schema.sql in Supabase SQL Editor to sync to cloud database)',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Failed to save admin settings' },
      { status: 500 }
    );
  }
}
