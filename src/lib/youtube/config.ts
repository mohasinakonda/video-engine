/**
 * Channel Doctor server configuration. Server-only: imported by API routes, never by
 * client components, so secrets stay out of the browser bundle.
 */

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const;

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const YOUTUBE_DATA_API = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2';
export const YOUTUBE_REPORTING_API = 'https://youtubereporting.googleapis.com/v1';

/** Reporting API report that carries thumbnail impressions and CTR. */
export const REACH_REPORT_TYPE = 'channel_reach_basic_a1';

/** OAuth handshake cookies (HTTP-only, short-lived). */
export const OAUTH_COOKIES = {
  state: 'yt_oauth_state',
  verifier: 'yt_oauth_verifier',
  returnTo: 'yt_oauth_return',
} as const;
export const OAUTH_COOKIE_MAX_AGE = 60 * 10;

export const DEFAULT_RETURN_PATH = '/youtube-doctor';

export class ConfigError extends Error {}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Reads the Google OAuth settings, with a setup hint when one is missing. */
export function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  const missing = [
    !clientId && 'GOOGLE_OAUTH_CLIENT_ID',
    !clientSecret && 'GOOGLE_OAUTH_CLIENT_SECRET',
    !redirectUri && 'GOOGLE_OAUTH_REDIRECT_URI',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new ConfigError(
      `YouTube connection is not configured. Set ${missing.join(', ')} (see docs/youtube-doctor-plan.md, section 15).`
    );
  }
  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! };
}

/** Only same-site relative paths, so the return address can't become an open redirect. */
export function safeReturnPath(value: string | null | undefined): string {
  const path = value || '';
  return /^\/(?![/\\])[A-Za-z0-9\-._~/?=&]*$/.test(path) ? path : DEFAULT_RETURN_PATH;
}
