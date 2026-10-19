import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ConfigError } from './config';

/**
 * Service-role client for the Channel Doctor tables, which have RLS on and no user policies.
 * Callers must always filter by the session user's id.
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new ConfigError('SUPABASE_SERVICE_ROLE_KEY is required for YouTube connections.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
