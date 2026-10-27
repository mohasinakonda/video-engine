import { AsyncLocalStorage } from 'node:async_hooks';
import { consumeQuota, pacificDate } from './quota-budget';
import { getServiceClient } from './db';

/**
 * Counts what each feature spends from the app's own Google project, for the admin dashboard.
 * Only calls billed to that project count: YouTube Data API v3 requests made with a user's OAuth
 * token. Calls with an API key (the user's own key, or the comments key) use another project's
 * quota, and the Analytics and Reporting APIs have their own quotas.
 *
 * Since June 2026 search.list has its own quota bucket (100 calls a day by default, 1 per call),
 * apart from the 10,000 daily units every other method shares, so the two are counted apart.
 *
 * A request's counts are added up in memory (per async context) and written once when it ends.
 */

export const UNITS_PREFIX = 'units:';
export const SEARCHES_PREFIX = 'searches:';
/** An accounting bucket, not a limit: high enough never to refuse. */
const NO_LIMIT = 2_000_000_000;

interface Cost {
  /** From the shared daily units (10,000 by default). */
  units: number;
  /** From search.list's own bucket (100 calls a day by default). */
  searches: number;
}

const meter = new AsyncLocalStorage<{ feature: string } & Cost>();

/** What a request costs the app's project: search.list 1 search, any other Data API call 1 unit. */
export function costFor(url: string): Cost {
  const none = { units: 0, searches: 0 };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return none;
  }
  if (u.hostname !== 'www.googleapis.com' || !u.pathname.startsWith('/youtube/v3/')) return none;
  if (u.searchParams.has('key')) return none;
  return u.pathname === '/youtube/v3/search' ? { units: 0, searches: 1 } : { units: 1, searches: 0 };
}

async function record(feature: string, cost: Cost) {
  if (cost.units > 0) await consumeQuota(`${UNITS_PREFIX}${feature}`.slice(0, 80), cost.units, NO_LIMIT);
  if (cost.searches > 0) await consumeQuota(`${SEARCHES_PREFIX}${feature}`.slice(0, 80), cost.searches, NO_LIMIT);
}

/** Called for every attempt (Google bills failed requests too). */
export function meterRequest(url: string) {
  const cost = costFor(url);
  if (cost.units === 0 && cost.searches === 0) return;
  const current = meter.getStore();
  if (current) {
    current.units += cost.units;
    current.searches += cost.searches;
  }
  // Outside a metered request: record right away so nothing goes uncounted.
  else void record('other', cost).catch(() => {});
}

/** Runs `fn` with its YouTube calls counted under `feature` (e.g. "create/topic-search"). */
export async function withQuotaMeter<T>(feature: string, fn: () => Promise<T>): Promise<T> {
  const store = { feature, units: 0, searches: 0 };
  try {
    return await meter.run(store, fn);
  } finally {
    // Accounting must never fail the request.
    await record(feature, store).catch(() => {});
  }
}

export interface UnitsDay {
  day: string;
  /** Units per feature that day. */
  features: Record<string, number>;
  /** Search calls per feature that day. */
  searches: Record<string, number>;
  total: number;
  searchCalls: number;
}

/** The last `days` YouTube quota days (Pacific time), newest first. */
export async function unitsByDay(days = 7, now = new Date()): Promise<UnitsDay[]> {
  const dates = Array.from({ length: days }, (_, i) => pacificDate(new Date(now.getTime() - i * 86_400_000)));
  const { data, error } = await getServiceClient()
    .from('youtube_quota_usage')
    .select('day, bucket, used')
    .in('day', dates)
    .or(`bucket.like.${UNITS_PREFIX}*,bucket.like.${SEARCHES_PREFIX}*`);
  if (error) throw new Error(`youtube_quota_usage read failed: ${error.code}`);
  return dates.map((day) => {
    const rows = (data ?? []).filter((r) => r.day === day);
    const features: Record<string, number> = {};
    const searches: Record<string, number> = {};
    for (const r of rows) {
      if (r.bucket.startsWith(UNITS_PREFIX)) features[r.bucket.slice(UNITS_PREFIX.length)] = r.used;
      else searches[r.bucket.slice(SEARCHES_PREFIX.length)] = r.used;
    }
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    return { day, features, searches, total: sum(features), searchCalls: sum(searches) };
  });
}
