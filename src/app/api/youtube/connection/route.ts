import { NextResponse } from 'next/server';
import {
  NotConnectedError,
  ReauthRequiredError,
  deleteConnection,
  getPublicConnection,
  getValidAccessToken,
} from '@/lib/youtube/connection-service';
import { fetchMyChannels } from '@/lib/youtube/data-client';
import { GoogleApiError } from '@/lib/youtube/google-fetch';
import { requireUser } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/youtube/connection — connection status and channel identity.
 * Subscriber and video counts are fetched live (1 quota unit) and never stored.
 */
export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  try {
    const connection = await getPublicConnection(auth.user.id);
    if (!connection) return NextResponse.json({ connected: false });
    if (connection.status !== 'active') {
      return NextResponse.json({ connected: true, connection, stats: null });
    }

    let stats: { subscriberCount: number | null; videoCount: number | null; url: string } | null = null;
    try {
      const { accessToken } = await getValidAccessToken(auth.user.id);
      const channel = (await fetchMyChannels(accessToken)).find((c) => c.id === connection.channelId);
      if (channel) stats = { subscriberCount: channel.subscriberCount, videoCount: channel.videoCount, url: channel.url };
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        return NextResponse.json({ connected: true, connection: { ...connection, status: 'needs_reauth' }, stats: null });
      }
      if (!(err instanceof GoogleApiError || err instanceof NotConnectedError)) throw err;
      // Stats are optional; the connection itself is still valid.
    }

    return NextResponse.json({ connected: true, connection, stats });
  } catch (err) {
    console.error('[youtube/connection] GET failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not load your YouTube connection.' }, { status: 500 });
  }
}

/** DELETE /api/youtube/connection — stop the reporting job, revoke at Google, delete locally. */
export async function DELETE() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  try {
    const result = await deleteConnection(auth.user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[youtube/connection] DELETE failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not disconnect YouTube. Please try again.' }, { status: 500 });
  }
}
