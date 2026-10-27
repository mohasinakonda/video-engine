import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/youtube/route-auth';
import { unitsByDay } from '@/lib/youtube/quota-meter';
import { nextQuotaReset } from '@/lib/youtube/quota-budget';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';

export const dynamic = 'force-dynamic';

/** GET /api/admin/youtube-usage — YouTube Data API units by feature for the last 7 quota days. */
export async function GET() {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  try {
    const [days, settings] = await Promise.all([unitsByDay(7), getChannelDoctorSettings()]);
    return NextResponse.json({
      days,
      dailyQuotaUnits: settings.discover.dailyQuotaUnits,
      searchCallsPerDay: settings.discover.searchDailyGlobalLimit,
      resetsAt: nextQuotaReset(),
    });
  } catch (err) {
    console.error('[admin/youtube-usage] failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not read usage.' }, { status: 500 });
  }
}
