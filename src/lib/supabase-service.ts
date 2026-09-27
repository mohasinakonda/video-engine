/**
 * supabase-service.ts — Bridge between Supabase Database/Auth and Application Store
 */

import { createClient } from '@/lib/supabase/client';
import type {
  UserProfile,
  SubscriptionPlan,
  CreditTopupPack,
  PromoCode,
  PaymentSubmission,
  AdminSettings,
} from '@/types/subscription';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.startsWith('http'));
}

/** Get Supabase Auth User Session */
export async function getSupabaseUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Sign in with Google OAuth */
export async function signInWithGoogle(redirectTo?: string) {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Credentials not configured in .env.local');
    return;
  }
  const supabase = createClient();
  const redirect = redirectTo || `${window.location.origin}/dashboard`;
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirect,
    },
  });
}

/** Sign out user */
export async function signOutUser() {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  return supabase.auth.signOut();
}

/** Fetch user profile from Supabase profiles table */
export async function fetchSupabaseProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.full_name || 'Creator',
    email: data.email,
    phone: data.phone || '',
    tier: data.tier,
    creditsRemaining: data.credits_remaining,
    creditsUsed: data.credits_used,
    totalSpentBDT: data.total_spent_bdt,
    joinedAt: new Date(data.created_at).getTime(),
    isBlocked: data.is_blocked,
    blockReason: data.block_reason,
    referralCode: data.referral_code,
    referralCount: data.referral_count,
    referralEarningsBDT: data.referral_earnings_bdt,
    referralPendingBDT: data.referral_pending_bdt,
    referralPaidBDT: data.referral_paid_bdt,
    assignedPromoCode: data.assigned_promo_code,
  };
}

/** Atomic credit deduction via Supabase RPC function */
export async function deductCreditsRemote(userId: string, amount: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error('[Supabase] Credit deduction error:', error);
    return false;
  }

  return Boolean(data);
}

/** Submit Payment to Supabase Payments Table */
export async function submitPaymentRemote(submission: PaymentSubmission) {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payments')
    .insert({
      id: submission.id,
      user_id: submission.userId === 'usr_me' ? null : submission.userId,
      user_email: submission.userEmail,
      plan_id: submission.planId,
      topup_id: submission.topupId,
      item_type: submission.itemType,
      billing_cycle: submission.billingCycle,
      original_price_bdt: submission.originalPriceBDT,
      discounted_price_bdt: submission.discountedPriceBDT,
      promo_code_applied: submission.promoCodeApplied,
      credits_to_grant: submission.creditsToGrant,
      payment_method: submission.paymentMethod,
      sender_number: submission.senderNumber,
      trx_id: submission.trxId,
      status: submission.status,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Submit payment error:', error);
    return null;
  }
  return data;
}

/** Upload Generated Image / Voiceover to Supabase Storage */
export async function uploadMediaToSupabaseStorage(
  bucket: 'scene-images' | 'audio-voiceovers',
  path: string,
  blob: Blob
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
  });

  if (error || !data) {
    console.error('[Supabase] Storage upload error:', error);
    return null;
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}
