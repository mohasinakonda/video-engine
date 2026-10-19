import { getServiceClient } from './db';

/**
 * Shared YouTube quota budget, counted in Postgres so every server instance sees the same
 * numbers. search.list has its own bucket of 100 calls per day for the whole Google project,
 * reset at midnight Pacific time.
 */

export class QuotaBudgetError extends Error {
  constructor(
    public scope: 'global' | 'user',
    message: string
  ) {
    super(message);
  }
}

export const SEARCH_BUCKET = 'search';
export const userDiscoveryBucket = (userId: string) => `discovery:user:${userId}`;

/** Reserves `amount` from a bucket. Returns false when that would pass `limit`. */
export async function consumeQuota(bucket: string, amount: number, limit: number): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('consume_youtube_quota', {
    p_bucket: bucket,
    p_amount: amount,
    p_limit: limit,
  });
  // If the counter can't be read, refuse: an unknown budget must not burn the shared quota.
  if (error) {
    console.error('[quota-budget] consume failed:', error.code);
    return false;
  }
  return data === true;
}

/** Today's usage of a bucket (0 when unused). */
export async function quotaUsed(bucket: string): Promise<number> {
  const { data } = await getServiceClient()
    .from('youtube_quota_usage')
    .select('used')
    .eq('day', pacificDate())
    .eq('bucket', bucket)
    .maybeSingle();
  return data?.used ?? 0;
}

/** The current date in America/Los_Angeles as YYYY-MM-DD (YouTube's quota day). */
export function pacificDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
}

/** When the quota day next resets, as an ISO timestamp. */
export function nextQuotaReset(now: Date = new Date()): string {
  // Walk forward hour by hour until the Pacific date changes (DST-safe, at most 25 steps).
  const today = pacificDate(now);
  const t = new Date(now);
  t.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 26 && pacificDate(t) === today; i++) t.setUTCHours(t.getUTCHours() + 1);
  return t.toISOString();
}
