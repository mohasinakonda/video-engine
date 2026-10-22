import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  GOOGLE_AUTH_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_TOKEN_URL,
  YOUTUBE_SCOPES,
  getOAuthConfig,
} from './config';
import { googleFetch, googleJson } from './google-fetch';

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export function createOAuthState() {
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { state, verifier, challenge };
}

export function statesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function buildAuthUrl(state: string, challenge: string): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    // consent: ask again so Google returns a refresh token; select_account: pick the channel's account
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return googleJson<TokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    retries: 0,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getOAuthConfig();
  return googleJson<TokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
    retries: 1,
  });
}

/** Returns true only when Google confirms the revocation. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    await googleFetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      retries: 1,
    });
    return true;
  } catch {
    return false;
  }
}

/** True when every scope Phase 1 needs was granted (users can untick scopes on the consent screen). */
export function hasRequiredScopes(granted: string | undefined): boolean {
  const list = (granted || '').split(/\s+/);
  return YOUTUBE_SCOPES.every((scope) => list.includes(scope));
}
