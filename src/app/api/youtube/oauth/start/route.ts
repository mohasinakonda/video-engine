import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ConfigError, OAUTH_COOKIES, OAUTH_COOKIE_MAX_AGE, safeReturnPath } from '@/lib/youtube/config';
import { buildAuthUrl, createOAuthState } from '@/lib/youtube/oauth';
import { requireUser } from '@/lib/youtube/route-auth';

export const dynamic = 'force-dynamic';

/** GET /api/youtube/oauth/start — sends the signed-in user to Google's consent screen. */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;

  const returnTo = safeReturnPath(req.nextUrl.searchParams.get('return_to'));

  let authUrl: string;
  const { state, verifier, challenge } = createOAuthState();
  try {
    authUrl = buildAuthUrl(state, challenge);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[youtube/oauth/start]', err.message);
      return NextResponse.redirect(new URL(`${returnTo.split('?')[0]}?yt=not_configured`, req.url));
    }
    throw err;
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: '/api/youtube/oauth',
  };
  const store = cookies();
  store.set(OAUTH_COOKIES.state, state, cookieOptions);
  store.set(OAUTH_COOKIES.verifier, verifier, cookieOptions);
  store.set(OAUTH_COOKIES.returnTo, returnTo, cookieOptions);

  return NextResponse.redirect(authUrl);
}
