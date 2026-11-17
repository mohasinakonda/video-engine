/**
 * Tells the bio app (bio.rendoza.com) that a store changed, so its page refreshes now instead of
 * when its cache runs out. Best effort: a failure is logged and never blocks the save.
 */
export async function revalidateBio(handle: string): Promise<void> {
  const url = process.env.BIO_REVALIDATE_URL;
  const secret = process.env.BIO_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ handle }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn('[store] bio revalidate failed:', (err as Error)?.name);
  }
}
