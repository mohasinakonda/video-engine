import { NextResponse } from 'next/server';
import { requireDiscover } from '@/lib/youtube/discover/route-helpers';
import {
  WatchlistLimitError,
  channelIdSchema,
  removeFromWatchlist,
  updateSchema,
  updateWatchlistEntry,
} from '@/lib/youtube/discover/watchlist';

export const dynamic = 'force-dynamic';

type Context = { params: { channelId: string } };

/** PATCH /api/youtube/discover/competitors/:channelId — label, group or active. */
export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireDiscover();
  if ('response' in auth) return auth.response;
  const id = channelIdSchema.safeParse(params.channelId);
  const body = updateSchema.safeParse(await req.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  try {
    const updated = await updateWatchlistEntry(auth.user.id, id.data, body.data, auth.settings.maxCompetitors);
    return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    if (err instanceof WatchlistLimitError) return NextResponse.json({ error: err.message, code: 'limit' }, { status: 409 });
    console.error('[discover/competitors PATCH] failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not update this competitor.' }, { status: 500 });
  }
}

/** DELETE /api/youtube/discover/competitors/:channelId — remove from the watchlist. */
export async function DELETE(_req: Request, { params }: Context) {
  const auth = await requireDiscover();
  if ('response' in auth) return auth.response;
  const id = channelIdSchema.safeParse(params.channelId);
  if (!id.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  try {
    const removed = await removeFromWatchlist(auth.user.id, id.data);
    return removed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('[discover/competitors DELETE] failed:', (err as Error)?.message);
    return NextResponse.json({ error: 'Could not remove this competitor.' }, { status: 500 });
  }
}
