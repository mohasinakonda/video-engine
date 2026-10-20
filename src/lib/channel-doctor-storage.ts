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

/** Browser-only data from Create that holds the user's analytics or video ids. */
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

/** Clears every saved report (on disconnect, sign-out or channel change), including Create's measurements and reminders. */
export function clearAllReports() {
  try {
    removeWhere(window.sessionStorage, (key) => key.startsWith(PREFIX) || key.startsWith(CREATE_SESSION_PREFIX));
    removeWhere(window.localStorage, (key) => key.startsWith(CREATE_LOCAL_PREFIX));
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
