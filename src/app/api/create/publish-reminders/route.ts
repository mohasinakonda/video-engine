import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/youtube/connection-service';
import { listProjects } from '@/lib/youtube/create/projects';
import { findReminders } from '@/lib/youtube/create/publish';
import { fetchRecentUploads, linkedVideoIds } from '@/lib/youtube/create/published-videos';
import { projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';
import { consumeQuota } from '@/lib/youtube/quota-budget';

export const dynamic = 'force-dynamic';

/** Checks per user per day; the library also waits an hour between checks. */
const DAILY_CHECKS = 24;

/**
 * GET /api/create/publish-reminders — new uploads that look like a project in production.
 * The creator still confirms each one. Quiet (empty) when there's nothing to check or
 * YouTube isn't connected.
 */
export async function GET() {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;
  try {
    const waiting = (await listProjects(userId)).filter((p) => p.status === 'IN_PRODUCTION');
    if (!waiting.length) return NextResponse.json({ reminders: [] });
    if (!(await consumeQuota(`create-reminders:user:${userId}`, 1, DAILY_CHECKS))) return NextResponse.json({ reminders: [] });

    let token: Awaited<ReturnType<typeof getValidAccessToken>>;
    try {
      token = await getValidAccessToken(userId);
    } catch {
      return NextResponse.json({ reminders: [] });
    }
    const [uploads, linked] = await Promise.all([fetchRecentUploads(token.accessToken, token.connection.channelId, 10), linkedVideoIds(userId)]);
    return NextResponse.json({ reminders: findReminders(waiting, uploads, linked) });
  } catch (err) {
    return projectErrorResponse(err, 'publish reminders');
  }
}
