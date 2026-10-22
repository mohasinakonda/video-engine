import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ConfigError, OAUTH_COOKIES, safeReturnPath } from '@/lib/youtube/config';
import { exchangeCode, hasRequiredScopes, statesMatch } from '@/lib/youtube/oauth';
import { fetchMyChannels } from '@/lib/youtube/data-client';
import { ensureReachJob } from '@/lib/youtube/reporting-client';
import { saveConnection } from '@/lib/youtube/connection-service';
import { GoogleApiError } from '@/lib/youtube/google-fetch';
import { requireUser } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/youtube/oauth/callback — Google redirects here after consent.
 * Validates state, exchanges the code on the server, resolves the channel and saves
 * the encrypted connection. Always ends with a redirect carrying ?yt=<outcome>.
 */
export async function GET(req: NextRequest) {
  const store = cookies();
  const savedState = store.get(OAUTH_COOKIES.state)?.value;
  const verifier = store.get(OAUTH_COOKIES.verifier)?.value;
  const returnTo = safeReturnPath(store.get(OAUTH_COOKIES.returnTo)?.value).split('?')[0];
  for (const name of Object.values(OAUTH_COOKIES)) {
    store.set(name, '', { path: '/api/youtube/oauth', maxAge: 0 });
  }

  const finish = (outcome: string) => NextResponse.redirect(new URL(`${returnTo}?yt=${outcome}`, req.url));

  const auth = await requireUser();
  if ('response' in auth) return NextResponse.redirect(new URL('/login', req.url));

  const params = req.nextUrl.searchParams;
  if (params.get('error')) {
    return finish(params.get('error') === 'access_denied' ? 'cancelled' : 'error');
  }

  const code = params.get('code');
  if (!code || !verifier || !statesMatch(params.get('state') || undefined, savedState)) {
    return finish('invalid_state');
  }

  try {
    const tokens = await exchangeCode(code, verifier);
    if (!hasRequiredScopes(tokens.scope)) return finish('missing_scope');

    const channels = await fetchMyChannels(tokens.access_token);
    if (channels.length === 0) return finish('no_channel');
    // mine=true returns the channel of the account picked on the consent screen. If Google
    // ever returns more than one, don't guess: ask the user to reconnect with one account.
    if (channels.length > 1) return finish('multiple_channels');

    // The reach report (impressions + CTR) only covers days after its job exists, so start it now.
    // A failure here must not block the connection; the next analysis retries.
    let reportingJob: { id: string; createdAt: string } | null = null;
    try {
      reportingJob = await ensureReachJob(tokens.access_token);
    } catch (err) {
      console.warn('[youtube/oauth/callback] reporting job not created:', err instanceof GoogleApiError ? err.message : 'unknown error');
    }

    await saveConnection(auth.user.id, channels[0], tokens, reportingJob);
    return finish('connected');
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[youtube/oauth/callback]', err.message);
      return finish('not_configured');
    }
    console.error('[youtube/oauth/callback] failed:', err instanceof GoogleApiError ? err.message : (err as Error)?.message);
    // A YouTube API is not enabled in the Google Cloud project that owns the OAuth client.
    if (err instanceof GoogleApiError && err.reason === 'accessNotConfigured') return finish('api_not_enabled');
    return finish('error');
  }
}
