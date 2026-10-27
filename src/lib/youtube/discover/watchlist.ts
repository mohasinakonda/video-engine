import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CHANNEL_ID_RE } from '../public-client';
import type { CompetitorGroup } from './types';

/**
 * The competitor watchlist: channel ids and the user's own label/group only. Uses the
 * session client, so Postgres RLS also limits every query to the signed-in user's rows.
 */

export interface WatchlistRow {
  channelId: string;
  label: string | null;
  group: CompetitorGroup;
  active: boolean;
  addedAt: string;
}

export const groupSchema = z.enum(['direct', 'adjacent', 'format']);
export const channelIdSchema = z.string().regex(CHANNEL_ID_RE, 'Invalid channel id');
export const labelSchema = z
  .string()
  .trim()
  .max(60)
  .transform((v) => v || null)
  .nullable();

export const updateSchema = z
  .object({ label: labelSchema.optional(), group: groupSchema.optional(), active: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/** POST body: one pasted link/@handle/id, or several channels ticked in discovery results. */
export const addCompetitorsSchema = z.union([
  z.object({ input: z.string().max(200), group: groupSchema.default('direct'), label: labelSchema.optional() }),
  z.object({ channels: z.array(z.object({ channelId: channelIdSchema, group: groupSchema })).min(1).max(25) }),
]);

export class WatchlistLimitError extends Error {
  constructor(public max: number) {
    super(`You can have up to ${max} competitors. Remove or pause one first.`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (r: any): WatchlistRow => ({
  channelId: r.channel_id,
  label: r.label,
  group: r.grouping,
  active: r.active,
  addedAt: r.added_at,
});

export async function listWatchlist(userId: string): Promise<WatchlistRow[]> {
  const { data, error } = await createClient()
    .from('discover_competitors')
    .select('channel_id, label, grouping, active, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: true });
  if (error) throw new Error(`Could not read competitors (${error.code})`);
  return (data || []).map(toRow);
}

/**
 * Adds channels (skipping ones already saved). Active channels may not pass `max`.
 * Returns the ids that were newly added.
 */
export async function addToWatchlist(
  userId: string,
  entries: { channelId: string; group: CompetitorGroup; label?: string | null }[],
  max: number
): Promise<string[]> {
  const existing = await listWatchlist(userId);
  const saved = new Set(existing.map((r) => r.channelId));
  const fresh = entries.filter((e, i) => !saved.has(e.channelId) && entries.findIndex((x) => x.channelId === e.channelId) === i);
  if (fresh.length === 0) return [];

  const activeCount = existing.filter((r) => r.active).length;
  if (activeCount + fresh.length > max) throw new WatchlistLimitError(max);

  const { error } = await createClient()
    .from('discover_competitors')
    .insert(fresh.map((e) => ({ user_id: userId, channel_id: e.channelId, grouping: e.group, label: e.label ?? null })));
  if (error) throw new Error(`Could not save competitors (${error.code})`);
  return fresh.map((e) => e.channelId);
}

export async function updateWatchlistEntry(
  userId: string,
  channelId: string,
  update: z.infer<typeof updateSchema>,
  max: number
): Promise<boolean> {
  if (update.active === true) {
    const rows = await listWatchlist(userId);
    const target = rows.find((r) => r.channelId === channelId);
    if (target && !target.active && rows.filter((r) => r.active).length >= max) throw new WatchlistLimitError(max);
  }
  const { data, error } = await createClient()
    .from('discover_competitors')
    .update({
      ...(update.label !== undefined && { label: update.label }),
      ...(update.group !== undefined && { grouping: update.group }),
      ...(update.active !== undefined && { active: update.active }),
    })
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .select('channel_id');
  if (error) throw new Error(`Could not update competitor (${error.code})`);
  return (data || []).length > 0;
}

export async function removeFromWatchlist(userId: string, channelId: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from('discover_competitors')
    .delete()
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .select('channel_id');
  if (error) throw new Error(`Could not remove competitor (${error.code})`);
  return (data || []).length > 0;
}
