import { NextResponse } from 'next/server';
import { loadLearningRows } from '@/lib/youtube/create/learning';
import { projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';
import { summarize } from '@/lib/youtube/create/track-record';

export const dynamic = 'force-dynamic';

/** GET /api/create/learning — what the creator's measured videos say, as grouped labels. Free. */
export async function GET() {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    return NextResponse.json({ summary: summarize(await loadLearningRows(auth.user.id), auth.settings.learningMinVideos) });
  } catch (err) {
    return projectErrorResponse(err, 'learning');
  }
}
