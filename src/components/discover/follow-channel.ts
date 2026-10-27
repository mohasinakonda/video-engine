/**
 * Adds a channel seen in search results to the Discover watchlist: no YouTube search needed
 * (the server only confirms the channel exists, 1 quota unit), unlike competitor discovery.
 */
export async function followChannel(channelId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/youtube/discover/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: [{ channelId, group: 'direct' }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Couldn’t add this channel to your competitors. Please try again.' };
    if (!data.added?.length && !data.alreadySaved) return { ok: false, error: 'YouTube no longer returns this channel.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Couldn’t reach the server. Check your connection.' };
  }
}
