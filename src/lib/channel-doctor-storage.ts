/**
 * Channel Doctor reports live only in this tab's sessionStorage (never on our servers).
 * Every access is wrapped: storage can be blocked, full or missing.
 */

const PREFIX = 'channel-doctor:v1:';

export function reportKey(userId: string, channelId: string, range: string, videoId?: string) {
  return `${PREFIX}${userId}:${channelId}:${videoId ? `video:${videoId}:` : ''}${range}`;
}

export function loadReport<T>(key: string): { analyzedAt: string; result: T } | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveReport<T>(key: string, result: T) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ analyzedAt: new Date().toISOString(), result }));
  } catch {
    // Storage full or blocked: the report still shows, it just won't survive a refresh.
  }
}

/**
 * Next Shorts ideas stay in this browser's localStorage (never on our servers) so the creator can
 * come back to them; a new batch replaces the old one. Cleared with the reports below.
 */
const NEXT_SHORTS_PREFIX = 'next-shorts:v3:';

export const nextShortsKey = (userId: string, channelId: string) => `${NEXT_SHORTS_PREFIX}${userId}:${channelId}`;

export function loadNextShorts<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveNextShorts<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the ideas still show, they just won't be there next time.
  }
}

/** Forgets the saved ideas, and the copy this tab kept of the batch that made them. */
export function clearNextShorts(key: string, tabKey: string) {
  try {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(tabKey);
  } catch {
    // nothing to clear
  }
}

/** Left in browsers by Create's removed Publish and Measure steps; they hold analytics and video ids. */
const CREATE_SESSION_PREFIX = 'create:performance:';
const CREATE_LOCAL_PREFIX = 'create:publish-reminders:';

const removeWhere = (storage: Storage, test: (key: string) => boolean) => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && test(key)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
};

/** Clears every saved report (on disconnect, sign-out or channel change), including leftovers from Create's old steps. */
export function clearAllReports() {
  try {
    removeWhere(window.sessionStorage, (key) => key.startsWith(PREFIX) || key.startsWith(CREATE_SESSION_PREFIX));
    removeWhere(window.localStorage, (key) => key.startsWith(CREATE_LOCAL_PREFIX) || key.startsWith(NEXT_SHORTS_PREFIX));
  } catch {
    // nothing to clear
  }
}

/** Finds a saved research result in this tab that contains the opportunity, if any. */
export function findSavedOpportunity<R extends { opportunities?: { id: string }[] }>(
  userId: string,
  opportunityId: string
): { analyzedAt: string; result: R } | null {
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key?.startsWith(`${PREFIX}${userId}:`) || !/:research-(30d|90d)$/.test(key)) continue;
      const saved = loadReport<R>(key);
      if (saved?.result.opportunities?.some((o) => o.id === opportunityId)) return saved;
    }
  } catch {
    // storage blocked
  }
  return null;
}
