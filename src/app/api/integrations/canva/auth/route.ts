import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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
  const state = Math.random().toString(36).substring(2, 15);

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

  const authUrl = getCanvaAuthUrl(clientId, redirectUri, codeChallenge, state);

  // If requested via JSON API query, return JSON; otherwise redirect directly
  const isJson = req.nextUrl.searchParams.get('format') === 'json';
  if (isJson) {
    return NextResponse.json({ authUrl });
  }

  return NextResponse.redirect(authUrl);
}
