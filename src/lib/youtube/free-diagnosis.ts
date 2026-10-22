/**
 * Free Channel Doctor diagnoses on the Trial plan: a new user sees their own channel's problems
 * before paying. Counted per user and per channel (a new account on the same channel gets none),
 * in a table only the server can read or write.
 */
import { getServiceClient } from './db';

const TABLE = 'free_diagnosis_claims';

/** Free diagnoses this user has left (their channel may still have used them; the claim checks that). */
export async function freeDiagnosesLeft(userId: string, limit: number): Promise<number> {
  if (limit <= 0) return 0;
  const { count, error } = await getServiceClient().from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) return 0;
  return Math.max(0, limit - (count ?? 0));
}

/** Uses one free diagnosis for this user and channel. Returns the claim id, or null when none are left. */
export async function claimFreeDiagnosis(userId: string, channelId: string, limit: number): Promise<string | null> {
  const { data, error } = await getServiceClient().rpc('claim_free_diagnosis', { p_user_id: userId, p_channel_id: channelId, p_limit: limit });
  if (error) {
    console.error('[youtube] free diagnosis claim failed:', error.code);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

/** Gives a claim back when the diagnosis didn't produce a report. */
export async function releaseFreeDiagnosis(claimId: string): Promise<void> {
  const { error } = await getServiceClient().from(TABLE).delete().eq('id', claimId);
  if (error) console.error('[youtube] free diagnosis release failed:', error.code);
}
