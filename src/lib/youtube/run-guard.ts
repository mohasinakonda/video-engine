/**
 * Per-user guard: one analysis at a time and an hourly cap, to protect the Google quota.
 * In memory per server instance, so it's a soft limit; credits remain the real limit.
 */
const running = new Set<string>();
const history = new Map<string, number[]>();
const HOUR_MS = 60 * 60 * 1000;

export type GuardResult = { ok: true; release: () => void } | { ok: false; reason: 'running' | 'hourly_limit' };

export function acquireRun(userId: string, hourlyLimit: number): GuardResult {
  if (running.has(userId)) return { ok: false, reason: 'running' };
  const now = Date.now();
  const recent = (history.get(userId) || []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= hourlyLimit) return { ok: false, reason: 'hourly_limit' };

  recent.push(now);
  history.set(userId, recent);
  running.add(userId);
  return { ok: true, release: () => running.delete(userId) };
}
