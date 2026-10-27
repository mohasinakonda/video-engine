/**
 * fetch wrapper for Google APIs: timeout, bounded retries for transient failures only,
 * no caching, and errors mapped to kinds the UI can explain. Never logs response bodies.
 * Every attempt is metered for the admin YouTube units dashboard (quota-meter.ts).
 */

import { meterRequest } from './quota-meter';

export type GoogleErrorKind =
  | 'auth'          // 401: token expired or revoked
  | 'quota'         // quota or rate limit exhausted
  | 'forbidden'     // 403 for another reason (missing scope, report not allowed)
  | 'not_found'
  | 'bad_request'   // invalid query; also how unsupported metrics come back
  | 'unavailable'   // 5xx after retries
  | 'network';      // timeout or connection failure

export class GoogleApiError extends Error {
  constructor(
    public kind: GoogleErrorKind,
    public status: number,
    /** Google's machine-readable reason, e.g. "quotaExceeded". Safe to log. */
    public reason?: string
  ) {
    super(`Google API ${kind} (${status}${reason ? `, ${reason}` : ''})`);
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded']);

interface GoogleFetchOptions extends Omit<RequestInit, 'signal' | 'cache'> {
  timeoutMs?: number;
  retries?: number;
}

export async function googleFetch(url: string, options: GoogleFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 2, ...init } = options;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    meterRequest(url);
    try {
      res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      if (attempt < retries) {
        await wait(attempt);
        continue;
      }
      throw new GoogleApiError('network', 0);
    }

    if (res.ok) return res;

    const reason = await readReason(res);
    if (RETRYABLE.has(res.status) && attempt < retries && !QUOTA_REASONS.has(reason || '')) {
      await wait(attempt);
      continue;
    }
    throw new GoogleApiError(classify(res.status, reason), res.status, reason);
  }
}

/** JSON helper: googleFetch + parse. */
export async function googleJson<T>(url: string, options: GoogleFetchOptions = {}): Promise<T> {
  const res = await googleFetch(url, options);
  return (await res.json()) as T;
}

function classify(status: number, reason?: string): GoogleErrorKind {
  if (status === 401) return 'auth';
  if (QUOTA_REASONS.has(reason || '') || status === 429) return 'quota';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 400) return reason === 'invalid_grant' ? 'auth' : 'bad_request';
  return 'unavailable';
}

/** Pulls only the error reason code out of a Google error body (never the full body). */
async function readReason(res: Response): Promise<string | undefined> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error; // OAuth endpoints: {"error":"invalid_grant"}
    return body?.error?.errors?.[0]?.reason || body?.error?.status || undefined;
  } catch {
    return undefined;
  }
}

function wait(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 500 * 3 ** attempt));
}
