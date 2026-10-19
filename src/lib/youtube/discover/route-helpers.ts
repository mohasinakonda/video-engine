import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { NotConnectedError, ReauthRequiredError, getValidAccessToken } from '../connection-service';
import { GoogleApiError } from '../google-fetch';
import { requireUser } from '../route-auth';
import { getChannelDoctorSettings, getUserAccess, type DiscoverSettings } from '../settings';

/** Signed in, and allowed to use Discover (plan, or admin while it's switched off for users). */
export async function requireDiscover(): Promise<{ user: User; settings: DiscoverSettings } | { response: NextResponse }> {
  const auth = await requireUser();
  if ('response' in auth) return auth;
  const settings = await getChannelDoctorSettings();
  const access = await getUserAccess(auth.user.id, settings);
  if (!access.hasDiscoverAccess) {
    return {
      response: settings.discover.enabled
        ? NextResponse.json({ error: 'Discover is not included in your current plan.', code: 'plan' }, { status: 403 })
        : NextResponse.json({ error: 'Discover is not available yet.' }, { status: 503 }),
    };
  }
  return { user: auth.user, settings: settings.discover };
}

/** The user's YouTube token, or a response explaining what to do. */
export async function tokenOrResponse(userId: string) {
  try {
    return await getValidAccessToken(userId);
  } catch (err) {
    if (err instanceof NotConnectedError) return NextResponse.json({ error: 'Connect YouTube first.', code: 'not_connected' }, { status: 409 });
    if (err instanceof ReauthRequiredError) return NextResponse.json({ error: err.message, code: 'reauth' }, { status: 409 });
    console.error('[discover] token error:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not reach YouTube. Please try again.' }, { status: 502 });
  }
}

/** Plain, actionable text for a YouTube failure in a non-streaming route. */
export function googleErrorResponse(err: unknown, label: string) {
  if (err instanceof GoogleApiError) {
    console.error(`[${label}] failed:`, err.message);
    if (err.kind === 'quota') return NextResponse.json({ error: 'YouTube’s API limit for our app was reached. Please try again later.' }, { status: 429 });
    if (err.kind === 'auth') return NextResponse.json({ error: 'YouTube authorization failed. Please reconnect YouTube.', code: 'reauth' }, { status: 409 });
    return NextResponse.json({ error: 'YouTube did not respond. Please try again.' }, { status: 502 });
  }
  console.error(`[${label}] failed:`, (err as Error)?.message);
  return NextResponse.json({ error: 'Something failed on our side. Please try again.' }, { status: 500 });
}
