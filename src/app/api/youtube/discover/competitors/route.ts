import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchChannelsById } from '@/lib/youtube/data-client';
import { toPublicChannel } from '@/lib/youtube/discover/discovery';
import { googleErrorResponse, requireDiscover, tokenOrResponse } from '@/lib/youtube/discover/route-helpers';
import type { WatchlistEntry } from '@/lib/youtube/discover/types';
import {
  WatchlistLimitError,
  addCompetitorsSchema,
  addToWatchlist,
  groupSchema,
  listWatchlist,
} from '@/lib/youtube/discover/watchlist';
import { parseChannelInput, resolveChannelInput } from '@/lib/youtube/public-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/youtube/discover/competitors — the watchlist with public channel info fetched
 * fresh from YouTube (1 unit per 50 channels). Channel info is never stored.
 */
export async function GET() {
  const auth = await requireDiscover();
  if ('response' in auth) return auth.response;

  try {
    const rows = await listWatchlist(auth.user.id);
    const base = { competitors: [] as WatchlistEntry[], max: auth.settings.maxCompetitors };
    if (rows.length === 0) return NextResponse.json(base);

    const token = await tokenOrResponse(auth.user.id);
    if (token instanceof NextResponse) {
      // Still show the saved list; the page explains why channel details are missing.
      return NextResponse.json({ ...base, competitors: rows.map((r) => ({ ...r, channel: null })), channelInfo: 'unavailable' });
    }
    const channels = await fetchChannelsById(token.accessToken, rows.map((r) => r.channelId));
    const byId = new Map(channels.map((c) => [c.id, toPublicChannel(c)]));
    return NextResponse.json({ ...base, competitors: rows.map((r) => ({ ...r, channel: byId.get(r.channelId) ?? null })) });
  } catch (err) {
    return googleErrorResponse(err, 'discover/competitors GET');
  }
}

/** POST /api/youtube/discover/competitors — add by pasted link or from discovery results. */
export async function POST(req: Request) {
  const auth = await requireDiscover();
  if ('response' in auth) return auth.response;

  const parsed = addCompetitorsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const token = await tokenOrResponse(auth.user.id);
  if (token instanceof NextResponse) return token;

  try {
    let entries: { channelId: string; group: z.infer<typeof groupSchema>; label?: string | null }[];
    if ('input' in parsed.data) {
      const input = parseChannelInput(parsed.data.input);
      if (!input.ok) return NextResponse.json({ error: input.reason }, { status: 400 });
      const channel = await resolveChannelInput(token.accessToken, input.input);
      if (!channel) return NextResponse.json({ error: 'We couldn’t find that channel. It may be private or deleted.' }, { status: 404 });
      entries = [{ channelId: channel.id, group: parsed.data.group, label: parsed.data.label ?? null }];
    } else {
      // Only channels YouTube still returns can be saved.
      const found = new Set((await fetchChannelsById(token.accessToken, parsed.data.channels.map((c) => c.channelId))).map((c) => c.id));
      entries = parsed.data.channels.filter((c) => found.has(c.channelId));
    }

    if (entries.some((e) => e.channelId === token.connection.channelId)) {
      return NextResponse.json({ error: 'That’s your own channel. Add channels you compete with instead.' }, { status: 400 });
    }
    const added = await addToWatchlist(auth.user.id, entries, auth.settings.maxCompetitors);
    return NextResponse.json({ added, alreadySaved: entries.length - added.length });
  } catch (err) {
    if (err instanceof WatchlistLimitError) return NextResponse.json({ error: err.message, code: 'limit' }, { status: 409 });
    return googleErrorResponse(err, 'discover/competitors POST');
  }
}
