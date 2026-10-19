import { decryptToken, encryptToken } from './crypto';
import { getServiceClient } from './db';
import type { ChannelIdentity } from './data-client';
import { GoogleApiError } from './google-fetch';
import { refreshAccessToken, revokeToken, type TokenResponse } from './oauth';
import { deleteReachJob } from './reporting-client';

export type ConnectionStatus = 'active' | 'needs_reauth' | 'revoked';

interface ConnectionRow {
  user_id: string;
  channel_id: string;
  channel_title: string | null;
  channel_thumbnail: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: ConnectionStatus;
  reporting_job_id: string | null;
  reporting_job_created_at: string | null;
  updated_at: string;
}

/** What the browser may see: no tokens, ever. */
export interface PublicConnection {
  channelId: string;
  title: string | null;
  thumbnail: string | null;
  url: string;
  status: ConnectionStatus;
  reportingStartedAt: string | null;
}

export class NotConnectedError extends Error {
  constructor() {
    super('YouTube is not connected');
  }
}

export class ReauthRequiredError extends Error {
  constructor() {
    super('YouTube authorization expired. Please reconnect.');
  }
}

const TABLE = 'youtube_connections';
/** Refresh a little early so a token never expires mid-analysis. */
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

async function getRow(userId: string): Promise<ConnectionRow | null> {
  const { data, error } = await getServiceClient().from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Could not load the YouTube connection (${error.code})`);
  return (data as ConnectionRow) || null;
}

export function toPublicConnection(row: ConnectionRow): PublicConnection {
  return {
    channelId: row.channel_id,
    title: row.channel_title,
    thumbnail: row.channel_thumbnail,
    url: `https://www.youtube.com/channel/${row.channel_id}`,
    status: row.status,
    reportingStartedAt: row.reporting_job_created_at,
  };
}

export async function getPublicConnection(userId: string): Promise<PublicConnection | null> {
  const row = await getRow(userId);
  return row ? toPublicConnection(row) : null;
}

/**
 * Saves the connection after OAuth. Google may omit the refresh token on re-authorization,
 * so an existing one is kept for the same channel. Without any refresh token the
 * connection is marked needs_reauth instead of pretending it will keep working.
 */
export async function saveConnection(
  userId: string,
  channel: ChannelIdentity,
  tokens: TokenResponse,
  reportingJob: { id: string; createdAt: string } | null
): Promise<void> {
  const existing = await getRow(userId);
  const sameChannel = existing?.channel_id === channel.id;
  const refreshTokenEnc = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : sameChannel
      ? existing?.refresh_token_enc ?? null
      : null;

  const row = {
    user_id: userId,
    channel_id: channel.id,
    channel_title: channel.title,
    channel_thumbnail: channel.thumbnail,
    access_token_enc: encryptToken(tokens.access_token),
    refresh_token_enc: refreshTokenEnc,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: (tokens.scope || '').split(/\s+/).filter(Boolean),
    status: refreshTokenEnc ? 'active' : 'needs_reauth',
    reporting_job_id: reportingJob?.id ?? (sameChannel ? existing?.reporting_job_id ?? null : null),
    reporting_job_created_at:
      reportingJob?.createdAt ?? (sameChannel ? existing?.reporting_job_created_at ?? null : null),
    updated_at: new Date().toISOString(),
  };

  const { error } = await getServiceClient().from(TABLE).upsert(row, { onConflict: 'user_id' });
  if (error) throw new Error(`Could not save the YouTube connection (${error.code})`);
}

export async function updateReportingJob(userId: string, job: { id: string; createdAt: string }) {
  await getServiceClient()
    .from(TABLE)
    .update({ reporting_job_id: job.id, reporting_job_created_at: job.createdAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

async function setStatus(userId: string, status: ConnectionStatus) {
  await getServiceClient().from(TABLE).update({ status, updated_at: new Date().toISOString() }).eq('user_id', userId);
}

/**
 * A usable access token for the user's channel, refreshed when close to expiry.
 * Throws NotConnectedError or ReauthRequiredError for the UI to handle.
 */
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; connection: PublicConnection; reportingJobId: string | null }> {
  const row = await getRow(userId);
  if (!row) throw new NotConnectedError();
  if (row.status !== 'active') throw new ReauthRequiredError();

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token_enc && expiresAt - Date.now() > EXPIRY_MARGIN_MS) {
    return { accessToken: decryptToken(row.access_token_enc), connection: toPublicConnection(row), reportingJobId: row.reporting_job_id };
  }

  if (!row.refresh_token_enc) {
    await setStatus(userId, 'needs_reauth');
    throw new ReauthRequiredError();
  }

  try {
    const tokens = await refreshAccessToken(decryptToken(row.refresh_token_enc));
    const update: Record<string, string> = {
      access_token_enc: encryptToken(tokens.access_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Google can rotate refresh tokens; keep the newest one.
    if (tokens.refresh_token) update.refresh_token_enc = encryptToken(tokens.refresh_token);
    await getServiceClient().from(TABLE).update(update).eq('user_id', userId);
    return { accessToken: tokens.access_token, connection: toPublicConnection(row), reportingJobId: row.reporting_job_id };
  } catch (err) {
    // invalid_grant: the user revoked access, or a Testing-mode token expired after 7 days.
    if (err instanceof GoogleApiError && err.kind === 'auth') {
      await setStatus(userId, 'needs_reauth');
      throw new ReauthRequiredError();
    }
    throw err;
  }
}

/**
 * Disconnect: stop the reporting job, revoke at Google, then delete the local row.
 * The result says honestly whether Google confirmed the revocation.
 */
export async function deleteConnection(userId: string): Promise<{ hadConnection: boolean; revokedAtGoogle: boolean }> {
  const row = await getRow(userId);
  if (!row) return { hadConnection: false, revokedAtGoogle: false };

  let revokedAtGoogle = false;
  try {
    const { accessToken, reportingJobId } = await getValidAccessToken(userId);
    if (reportingJobId) await deleteReachJob(accessToken, reportingJobId);
  } catch {
    // Expired or revoked tokens can't delete the job; revoking below still ends our access.
  }
  try {
    const token = row.refresh_token_enc
      ? decryptToken(row.refresh_token_enc)
      : row.access_token_enc
        ? decryptToken(row.access_token_enc)
        : null;
    if (token) revokedAtGoogle = await revokeToken(token);
  } catch {
    revokedAtGoogle = false;
  }

  const { error } = await getServiceClient().from(TABLE).delete().eq('user_id', userId);
  if (error) throw new Error(`Could not remove the YouTube connection (${error.code})`);
  return { hadConnection: true, revokedAtGoogle };
}
