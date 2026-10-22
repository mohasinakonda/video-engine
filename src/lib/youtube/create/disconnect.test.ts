import { describe, expect, it, vi } from 'vitest';

/** Every write the disconnect makes, as "table:operation" with its filters. */
const writes: { table: string; op: string; filters: Record<string, unknown>; values?: unknown }[] = [];

function chain(table: string) {
  const entry = { table, op: 'select', filters: {} as Record<string, unknown>, values: undefined as unknown };
  const q = {
    select: () => q,
    delete: () => ((entry.op = 'delete'), writes.push(entry), q),
    update: (values: unknown) => ((entry.op = 'update'), (entry.values = values), writes.push(entry), q),
    eq: (k: string, v: unknown) => ((entry.filters[k] = v), q),
    in: (k: string, v: unknown) => ((entry.filters[k] = v), q),
    // The stored connection: no tokens left, so nothing is sent to Google.
    maybeSingle: async () => ({ data: { user_id: 'user-a', status: 'needs_reauth', channel_id: 'UC' + 'a'.repeat(22), access_token_enc: null, refresh_token_enc: null }, error: null }),
    then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
  };
  return q;
}

vi.mock('../db', () => ({ getServiceClient: () => ({ from: (table: string) => chain(table) }) }));

import { deleteConnection } from '../connection-service';

describe('disconnecting YouTube', () => {
  it('removes the watchlist for this user only, and never touches Create projects', async () => {
    await deleteConnection('user-a');
    const done = writes.map((w) => `${w.table}:${w.op}`);
    expect(done).toEqual(['youtube_connections:delete', 'discover_competitors:delete']);
    for (const w of writes) expect(w.filters.user_id).toBe('user-a');
  });
});
