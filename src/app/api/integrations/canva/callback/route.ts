import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCanvaCode } from '@/lib/canva/client';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  let origin = req.nextUrl.origin;
  if (origin.includes('localhost')) {
    origin = origin.replace('localhost', '127.0.0.1');
  }
  const redirectTarget = `${origin}/export?canva=connected`;

  if (error) {
    console.error('[Canva OAuth Error]:', error);
    return NextResponse.redirect(`${origin}/export?canva_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/export?canva_error=missing_code`);
  }

  const cookieStore = cookies();
  const savedState = cookieStore.get('canva_auth_state')?.value;
  const codeVerifier = cookieStore.get('canva_code_verifier')?.value;

  if (!codeVerifier) {
    console.error('[Canva OAuth] Missing PKCE code_verifier cookie');
    return NextResponse.redirect(`${origin}/export?canva_error=missing_verifier`);
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = `${origin}/api/integrations/canva/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/export?canva_error=missing_client_credentials`);
  }

  try {
    const tokenData = await exchangeCanvaCode(
      code,
      codeVerifier,
      redirectUri,
      clientId,
      clientSecret
    );

    // Store access token and refresh token in secure HTTP-only cookies
    cookieStore.set('canva_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 3600 * 4,
      path: '/',
    });

    if (tokenData.refresh_token) {
      cookieStore.set('canva_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600 * 24 * 30, // 30 days
        path: '/',
      });
    }

    // Clean up temporary verifier
    cookieStore.delete('canva_code_verifier');
    cookieStore.delete('canva_auth_state');

    return NextResponse.redirect(redirectTarget);
  } catch (err: any) {
    console.error('[Canva OAuth Callback Failure]:', err);
    return NextResponse.redirect(
      `${origin}/export?canva_error=${encodeURIComponent(err.message || 'token_exchange_failed')}`
    );
  }
}
