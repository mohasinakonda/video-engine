/**
 * What a pasted link points at (docs/audit-plan.md §6). Pure: no network. Accepts video links
 * in every common shape, channel links (/channel/UC…, /@handle) and bare @handles.
 */
import { parseVideoId } from '../create/publish';

export type AuditTarget = { kind: 'video'; videoId: string } | { kind: 'channel'; channelId: string } | { kind: 'handle'; handle: string };

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
/** YouTube handles: 3–30 letters (any script), digits, dots, dashes and underscores. */
const HANDLE = new RegExp('^@[\\p{L}\\p{M}\\p{N}._-]{3,30}$', 'u');

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
