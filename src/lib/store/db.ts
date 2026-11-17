import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ConfigError } from '../youtube/config';

/**
 * Service-role client for the store database (its own Supabase project, see
 * rendoza-bio/supabase/migrations). Server only: every caller must check that the store
 * belongs to the signed-in rendoza user before reading or writing it.
 */
let client: SupabaseClient | null = null;

export function getStoreClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.STORE_SUPABASE_URL;
  const key = process.env.STORE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ConfigError('STORE_SUPABASE_URL and STORE_SUPABASE_SERVICE_ROLE_KEY are required for the Store.');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
