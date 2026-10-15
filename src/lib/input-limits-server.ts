import { effectiveTier, getScriptCharLimit } from '@/lib/input-limits';

/**
 * Script character limit for a signed-in user, read from their profile.
 * Falls back to the TRIAL limit when the profile can't be read.
 */
export async function getUserScriptCharLimit(supabase: any, userId: string): Promise<number> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, role, subscription_expires_at')
      .eq('id', userId)
      .single();
    return getScriptCharLimit(effectiveTier(profile), profile?.role === 'admin');
  } catch {
    return getScriptCharLimit('TRIAL');
  }
}
