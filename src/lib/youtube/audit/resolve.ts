/**
 * What a pasted link points at (docs/audit-plan.md §6). Pure: no network. Accepts video links
 * in every common shape, channel links (/channel/UC…, /@handle) and bare @handles.
 */
export type AuditTarget = { kind: 'video'; videoId: string } | { kind: 'channel'; channelId: string } | { kind: 'handle'; handle: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
/** YouTube handles: 3–30 letters (any script), digits, dots, dashes and underscores. */
const HANDLE = new RegExp('^@[\\p{L}\\p{M}\\p{N}._-]{3,30}$', 'u');

/** A video id from a bare id or any common YouTube link (watch, youtu.be, shorts, live, embed). */
export function parseVideoId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function resolveTarget(input: string): AuditTarget | null {
  const text = input.trim();
  if (!text || text.length > 300) return null;

  const videoId = parseVideoId(text);
  if (videoId) return { kind: 'video', videoId };
  if (CHANNEL_ID.test(text)) return { kind: 'channel', channelId: text };
  if (HANDLE.test(text)) return { kind: 'handle', handle: text };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  if (host !== 'youtube.com') return null;
  const [first, second] = url.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (first === 'channel' && second && CHANNEL_ID.test(second)) return { kind: 'channel', channelId: second };
  if (first?.startsWith('@') && HANDLE.test(first)) return { kind: 'handle', handle: first };
  return null;
}
