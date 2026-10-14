import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { generatePKCE, getCanvaAuthUrl } from '@/lib/canva/client';

export async function GET(req: NextRequest) {
  const clientId = process.env.CANVA_CLIENT_ID;
  let origin = req.nextUrl.origin;
  if (origin.includes('localhost')) {
    origin = origin.replace('localhost', '127.0.0.1');
  }
  const redirectUri = `${origin}/api/integrations/canva/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'CANVA_CLIENT_ID is not configured in environment variables.' },
      { status: 400 }
    );
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = randomBytes(24).toString('hex');

  const cookieStore = cookies();
  cookieStore.set('canva_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 mins
    path: '/',
  });

  cookieStore.set('canva_auth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });

  // Only allow same-site relative paths (blocks open redirects such as //evil.com or /\\evil.com).
  const requestedReturn = req.nextUrl.searchParams.get('return_to') || '';
  const returnTo =
    /^\/(?![/\\])[A-Za-z0-9\-._~/]*$/.test(requestedReturn) ? requestedReturn : '/youtube-kit-studio';
  cookieStore.set('canva_return_to', returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });

  const authUrl = getCanvaAuthUrl(clientId, redirectUri, codeChallenge, state);

  // If requested via JSON API query, return JSON; otherwise redirect directly
  const isJson = req.nextUrl.searchParams.get('format') === 'json';
  if (isJson) {
    return NextResponse.json({ authUrl });
  }

  return NextResponse.redirect(authUrl);
}
