import { NextResponse } from 'next/server';
import { fetchMyChannels, fetchUploadIds, fetchVideoDetails } from '@/lib/youtube/data-client';
import { suggestQueries } from '@/lib/youtube/discover/queries';
import { googleErrorResponse, requireDiscover, tokenOrResponse } from '@/lib/youtube/discover/route-helpers';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';
import { acquireRun } from '@/lib/youtube/run-guard';
import { withQuotaMeter } from '@/lib/youtube/quota-meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/youtube/discover/queries — suggested search phrases from your recent titles.
 * Free (no credits, no search quota: ~3 Data API units), limited to 10 per hour.
 */
export function POST() {
  return withQuotaMeter('discover/suggest', suggestPhrases);
}

async function suggestPhrases() {
  const auth = await requireDiscover();
  if ('response' in auth) return auth.response;

  const guard = acquireRun(`queries:${auth.user.id}`, 10);
  if (!guard.ok) return NextResponse.json({ error: 'Please wait a little before asking for new suggestions.' }, { status: 429 });

  try {
    const token = await tokenOrResponse(auth.user.id);
    if (token instanceof NextResponse) return token;

    const me = (await fetchMyChannels(token.accessToken)).find((c) => c.id === token.connection.channelId);
    if (!me?.uploadsPlaylistId) return NextResponse.json({ queries: [] });
    const videos = await fetchVideoDetails(token.accessToken, await fetchUploadIds(token.accessToken, me.uploadsPlaylistId, 25));
    const { textModels } = await getChannelDoctorSettings();

    const queries = await suggestQueries({
      channelTitle: me.title,
      titles: videos.map((v) => v.title),
      count: auth.settings.searchCallsPerDiscovery,
      models: textModels,
    });
    return NextResponse.json({ queries });
  } catch (err) {
    return googleErrorResponse(err, 'discover/queries');
  } finally {
    guard.release();
  }
}
