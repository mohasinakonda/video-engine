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
import type { BaseStylePreset } from '@/types';
import { SUB_STYLES_CATALOG } from '@/lib/style-taxonomy';

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

// In-memory cache for admin role check to prevent repetitive network requests
let cachedAdminUserId: string | null = null;
let cachedIsAdmin: boolean | null = null;

/** Check if currently logged in user has admin privileges (cached per session) */
export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  try {
    const user = await getSupabaseUser();
    if (!user) {
      cachedAdminUserId = null;
      cachedIsAdmin = null;
      return false;
    }

    if (cachedAdminUserId === user.id && cachedIsAdmin !== null) {
      return cachedIsAdmin;
    }

    const profile = await fetchSupabaseProfile(user.id);
    const isAdmin = profile?.role === 'admin';

    cachedAdminUserId = user.id;
    cachedIsAdmin = isAdmin;

    return isAdmin;
  } catch {
    return false;
  }
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
  cachedAdminUserId = null;
  cachedIsAdmin = null;
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
    avatarUrl: data.avatar_url || undefined,
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
    role: data.role || 'user',
    subscriptionExpiresAt: data.subscription_expires_at ? new Date(data.subscription_expires_at).getTime() : undefined,
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

/** Atomic credit grant via Supabase RPC function */
export async function grantCreditsRemote(userId: string, amount: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = createClient();
  const { error } = await supabase.rpc('grant_credits', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error('[Supabase] Credit grant error:', error);
    return false;
  }

  return true;
}

/** Submit Payment to Supabase Payments Table */
export async function submitPaymentRemote(submission: PaymentSubmission) {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validUserId = submission.userId && UUID_REGEX.test(submission.userId) ? submission.userId : null;

  const { data, error } = await supabase
    .from('payments')
    .insert({
      id: submission.id,
      user_id: validUserId,
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

/** Fetch Subscription Plans from Supabase */
export async function fetchPlansRemote(clientOverride?: any): Promise<SubscriptionPlan[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = clientOverride || createClient();
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('price_monthly', { ascending: true });

    if (error || !data || data.length === 0) return null;

    return (data as any[]).map((row: any) => ({
      id: row.id,
      name: row.name,
      badge: row.badge,
      popular: row.popular,
      priceMonthly: row.price_monthly,
      priceQuarterly: row.price_quarterly ?? (row.price_yearly ? Math.round(row.price_yearly / 4) : Math.round(row.price_monthly * 3 * 0.9)),
      priceYearly: row.price_yearly,
      creditsPerMonth: row.credits_per_month,
      maxVideoDurationSec: row.max_video_duration_sec,
      maxResolution: row.max_resolution,
      features: Array.isArray(row.features) ? row.features : JSON.parse(row.features || '[]'),
      isActive: row.is_active,
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch plans:', err);
    return null;
  }
}

/** Save / Upsert Subscription Plans to Supabase */
export async function savePlansRemote(plans: SubscriptionPlan[], clientOverride?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = clientOverride || createClient();
    const rows = plans.map((p) => ({
      id: p.id,
      name: p.name,
      badge: p.badge || null,
      popular: Boolean(p.popular),
      price_monthly: p.priceMonthly,
      price_quarterly: p.priceQuarterly ?? (p.priceYearly ? Math.round(p.priceYearly / 4) : Math.round(p.priceMonthly * 3 * 0.9)),
      price_yearly: p.priceYearly ?? (p.priceQuarterly ? p.priceQuarterly * 4 : p.priceMonthly * 10),
      credits_per_month: p.creditsPerMonth,
      max_video_duration_sec: p.maxVideoDurationSec,
      max_resolution: p.maxResolution,
      features: p.features,
      is_active: p.isActive !== false,
    }));

    const { error } = await supabase.from('plans').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Failed to save plans:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error saving plans:', err);
    return false;
  }
}

/** Fetch Top-up Packs from Supabase */
export async function fetchTopupPacksRemote(clientOverride?: any): Promise<CreditTopupPack[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = clientOverride || createClient();
    const { data, error } = await supabase
      .from('topup_packs')
      .select('*')
      .order('price_bdt', { ascending: true });

    if (error || !data || data.length === 0) return null;

    return (data as any[]).map((row: any) => ({
      id: row.id,
      name: row.name,
      credits: row.credits,
      priceBDT: row.price_bdt,
      perCreditBDT: Number(row.per_credit_bdt),
      popular: row.popular,
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch topup packs:', err);
    return null;
  }
}

/** Save Topup Packs to Supabase */
export async function saveTopupPacksRemote(packs: CreditTopupPack[], clientOverride?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = clientOverride || createClient();
    const rows = packs.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      price_bdt: p.priceBDT,
      per_credit_bdt: p.perCreditBDT,
      popular: Boolean(p.popular),
    }));

    const { error } = await supabase.from('topup_packs').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Failed to save topup packs:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error saving topup packs:', err);
    return false;
  }
}

/** Delete Topup Pack from Supabase */
export async function deleteTopupPackRemote(id: string, clientOverride?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = clientOverride || createClient();
    const { error } = await supabase.from('topup_packs').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.error('[Supabase] Error deleting topup pack:', err);
    return false;
  }
}

/** Fetch Admin Settings from Supabase */
export async function fetchAdminSettingsRemote(clientOverride?: any): Promise<AdminSettings | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = clientOverride || createClient();
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) return null;

    return {
      whatsappNumber: data.whatsapp_number,
      bkashNumber: data.bkash_number,
      nagadNumber: data.nagad_number,
      bankDetails: data.bank_details,
      globalDiscountPercent: data.global_discount_percent,
      globalDiscountActive: data.global_discount_active,
      globalBannerText: data.global_banner_text,
      globalBannerActive: data.global_banner_active,
    };
  } catch (err) {
    console.error('[Supabase] Failed to fetch admin settings:', err);
    return null;
  }
}

/** Save Admin Settings to Supabase */
export async function saveAdminSettingsRemote(settings: AdminSettings, clientOverride?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = clientOverride || createClient();
    const { error } = await supabase.from('admin_settings').upsert({
      id: 1,
      whatsapp_number: settings.whatsappNumber,
      bkash_number: settings.bkashNumber,
      nagad_number: settings.nagadNumber,
      bank_details: settings.bankDetails,
      global_discount_percent: settings.globalDiscountPercent,
      global_discount_active: settings.globalDiscountActive,
      global_banner_text: settings.globalBannerText,
      global_banner_active: settings.globalBannerActive,
    });

    if (error) {
      console.error('[Supabase] Failed to save admin settings:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error saving admin settings:', err);
    return false;
  }
}

/** Fetch Promo Codes from Supabase */
export async function fetchPromoCodesRemote(): Promise<PromoCode[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('code', { ascending: true });

    if (error || !data || data.length === 0) return null;

    return data.map((row) => ({
      code: row.code,
      type: row.type,
      discountValue: row.discount_value,
      bonusCredits: row.bonus_credits,
      validUntil: new Date(row.valid_until).getTime(),
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      description: row.description,
      isActive: row.is_active,
      ownerUserId: row.owner_user_id,
      commissionPercent: row.commission_percent,
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch promo codes:', err);
    return null;
  }
}

/** Create or Update Promo Code in Supabase */
export async function createPromoCodeRemote(promo: PromoCode, client?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = client || createClient();
    const { error } = await supabase.from('promo_codes').upsert({
      code: promo.code,
      type: promo.type,
      discount_value: promo.discountValue,
      bonus_credits: promo.bonusCredits || 0,
      valid_until: new Date(promo.validUntil).toISOString(),
      max_uses: promo.maxUses,
      current_uses: promo.currentUses,
      description: promo.description,
      is_active: promo.isActive,
      owner_user_id: promo.ownerUserId || null,
      commission_percent: promo.commissionPercent || 15,
    });

    if (error) {
      console.error('[Supabase] Failed to create promo code:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error creating promo code:', err);
    return false;
  }
}

/** Delete Promo Code from Supabase */
export async function deletePromoCodeRemote(code: string, client?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = client || createClient();
    const { error } = await supabase.from('promo_codes').delete().eq('code', code);
    return !error;
  } catch (err) {
    console.error('[Supabase] Error deleting promo code:', err);
    return false;
  }
}

/** Fetch all Payment Submissions from Supabase */
export async function fetchPaymentsRemote(client?: any): Promise<PaymentSubmission[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = client || createClient();
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error || !data) return null;

    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id || 'usr_unknown',
      userEmail: row.user_email,
      planId: row.plan_id,
      topupId: row.topup_id,
      itemType: row.item_type,
      billingCycle: row.billing_cycle,
      originalPriceBDT: row.original_price_bdt,
      discountedPriceBDT: row.discounted_price_bdt,
      promoCodeApplied: row.promo_code_applied,
      creditsToGrant: row.credits_to_grant,
      paymentMethod: row.payment_method,
      senderNumber: row.sender_number,
      trxId: row.trx_id,
      status: row.status,
      submittedAt: new Date(row.submitted_at).getTime(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
      adminNote: row.admin_note,
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch payments:', err);
    return null;
  }
}

/** Approve Payment in Supabase, update status and credit user */
export async function approvePaymentRemote(submissionId: string, adminNote?: string, client?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = client || createClient();

    // 1. Fetch the submission details
    const { data: sub, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !sub) return false;

    // 2. Mark submission as APPROVED
    const { error: updateErr } = await supabase
      .from('payments')
      .update({
        status: 'APPROVED',
        reviewed_at: new Date().toISOString(),
        admin_note: adminNote || 'Approved by admin',
      })
      .eq('id', submissionId);

    if (updateErr) return false;

    // 3. Credit user in profiles table if userId exists
    if (sub.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sub.user_id)
        .single();

      if (profile) {
        const updatePayload: Record<string, unknown> = {
          credits_remaining: (profile.credits_remaining || 0) + (sub.credits_to_grant || 0),
          total_spent_bdt: (profile.total_spent_bdt || 0) + (sub.discounted_price_bdt || 0),
          updated_at: new Date().toISOString(),
        };

        if (sub.item_type === 'subscription' && sub.plan_id) {
          updatePayload.tier = sub.plan_id;
          const durationDays = sub.billing_cycle === 'yearly' ? 365 : 30;
          updatePayload.subscription_expires_at = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        }

        await supabase.from('profiles').update(updatePayload).eq('id', sub.user_id);
      }
    }

    // 4. Credit affiliate commission if promo code belonged to a referrer
    if (sub.promo_code_applied) {
      await creditAffiliateCommissionRemote(
        sub.promo_code_applied,
        sub.discounted_price_bdt || 0
      );
    }

    return true;
  } catch (err) {
    console.error('[Supabase] Error approving payment:', err);
    return false;
  }
}

/** Reject Payment in Supabase */
export async function rejectPaymentRemote(submissionId: string, reason: string, client?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = client || createClient();
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'REJECTED',
        reviewed_at: new Date().toISOString(),
        admin_note: reason || 'Payment rejected by admin',
      })
      .eq('id', submissionId);

    return !error;
  } catch (err) {
    console.error('[Supabase] Error rejecting payment:', err);
    return false;
  }
}

/** Fetch all User Profiles from Supabase */
export async function fetchAllProfilesRemote(client?: any): Promise<UserProfile[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = client || createClient();

    // Ensure any newly authenticated users without a profile are synced
    try {
      await supabase.rpc('sync_missing_profiles');
    } catch {
      // RPC might not be present in older schema; ignore safely
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((row: any) => ({
      id: row.id,
      name: row.full_name || 'Creator',
      email: row.email,
      phone: row.phone || '',
      avatarUrl: row.avatar_url || undefined,
      tier: row.tier || 'TRIAL',
      creditsRemaining: row.credits_remaining ?? 30,
      creditsUsed: row.credits_used ?? 0,
      totalSpentBDT: row.total_spent_bdt ?? 0,
      joinedAt: new Date(row.created_at).getTime(),
      isBlocked: Boolean(row.is_blocked),
      blockReason: row.block_reason,
      referralCode: row.referral_code,
      referralCount: row.referral_count ?? 0,
      referralEarningsBDT: row.referral_earnings_bdt ?? 0,
      referralPendingBDT: row.referral_pending_bdt ?? 0,
      referralPaidBDT: row.referral_paid_bdt ?? 0,
      assignedPromoCode: row.assigned_promo_code,
      role: row.role || 'user',
      subscriptionExpiresAt: row.subscription_expires_at ? new Date(row.subscription_expires_at).getTime() : undefined,
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch profiles:', err);
    return null;
  }
}

/** Update User Profile in Supabase (block/unblock, credits, promo) */
export async function updateProfileRemote(userId: string, updates: Partial<UserProfile>, client?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = client || createClient();
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.isBlocked !== undefined) payload.is_blocked = updates.isBlocked;
    if (updates.blockReason !== undefined) payload.block_reason = updates.blockReason;
    if (updates.creditsRemaining !== undefined) payload.credits_remaining = updates.creditsRemaining;
    if (updates.tier !== undefined) payload.tier = updates.tier;
    if (updates.assignedPromoCode !== undefined) payload.assigned_promo_code = updates.assignedPromoCode;
    if (updates.role !== undefined) payload.role = updates.role;

    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    return !error;
  } catch (err) {
    console.error('[Supabase] Error updating profile:', err);
    return false;
  }
}

/** Fetch Payment Submissions for a specific user from Supabase */
export async function fetchUserPaymentsRemote(userId?: string, userEmail?: string): Promise<PaymentSubmission[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    let query = supabase.from('payments').select('*');

    if (userId && userEmail) {
      query = query.or(`user_id.eq.${userId},user_email.eq.${userEmail}`);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (userEmail) {
      query = query.eq('user_email', userEmail);
    }

    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error || !data) return null;

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id || 'usr_me',
      userEmail: row.user_email,
      planId: row.plan_id,
      topupId: row.topup_id,
      itemType: row.item_type,
      billingCycle: row.billing_cycle,
      originalPriceBDT: row.original_price_bdt,
      discountedPriceBDT: row.discounted_price_bdt,
      promoCodeApplied: row.promo_code_applied,
      creditsToGrant: row.credits_to_grant,
      paymentMethod: row.payment_method,
      senderNumber: row.sender_number,
      trxId: row.trx_id,
      status: row.status,
      submittedAt: new Date(row.submitted_at).getTime(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
      adminNote: row.admin_note,
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch user payments:', err);
    return null;
  }
}

/** Ensure user profile exists in Supabase, creating or fetching it */
export async function ensureUserProfileRemote(authUser: { id: string; email?: string; user_metadata?: Record<string, any> }): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const existing = await fetchSupabaseProfile(authUser.id);
    if (existing) return existing;

    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Creator';
    const referralCode = `CREATOR_${authUser.id.slice(0, 6).toUpperCase()}`;

    await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        email: authUser.email || '',
        full_name: name,
        credits_remaining: 50,
        credits_used: 0,
        tier: 'TRIAL',
        referral_code: referralCode,
        referral_count: 0,
        referral_earnings_bdt: 0,
        referral_pending_bdt: 0,
        referral_paid_bdt: 0,
      });

    return await fetchSupabaseProfile(authUser.id);
  } catch (err) {
    console.error('[Supabase] Error ensuring user profile:', err);
    return null;
  }
}

/** Submit Payout Request to Supabase */
export async function submitPayoutRemote(
  userId: string,
  userEmail: string,
  amountBDT: number,
  paymentMethod: 'bkash' | 'nagad' | 'bank',
  accountNumber: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createClient();
    const id = `payout_${Date.now()}`;
    const { error } = await supabase.from('affiliate_payouts').insert({
      id,
      user_id: userId,
      user_email: userEmail,
      amount_bdt: amountBDT,
      payment_method: paymentMethod,
      account_number: accountNumber,
      status: 'PENDING',
    });

    if (error) {
      console.error('[Supabase] Failed to insert affiliate payout:', error);
      return false;
    }

    const profile = await fetchSupabaseProfile(userId);
    if (profile) {
      const nextPending = Math.max(0, profile.referralPendingBDT - amountBDT);
      await supabase.from('profiles').update({ referral_pending_bdt: nextPending }).eq('id', userId);
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error submitting payout:', err);
    return false;
  }
}

/** Atomically increment promo code current_uses in Supabase */
export async function incrementPromoUsageRemote(code: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !code) return false;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('increment_promo_usage', {
      p_code: code.trim().toUpperCase(),
    });
    if (error) {
      console.warn('[Supabase] increment_promo_usage error:', error);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn('[Supabase] increment_promo_usage exception:', err);
    return false;
  }
}

/** Atomically credit affiliate commission in Supabase */
export async function creditAffiliateCommissionRemote(
  referralCode: string,
  orderAmountBDT: number,
  commissionPercent = 15
): Promise<boolean> {
  if (!isSupabaseConfigured() || !referralCode) return false;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('credit_affiliate_commission', {
      p_referral_code: referralCode.trim().toUpperCase(),
      p_order_amount_bdt: orderAmountBDT,
      p_commission_percent: commissionPercent,
    });
    if (error) {
      console.warn('[Supabase] credit_affiliate_commission error:', error);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn('[Supabase] credit_affiliate_commission exception:', err);
    return false;
  }
}

// ─── ART STYLES & TAXONOMY REMOTE API ──────────────────────────────────────────

/**
 * Fetch all art styles from Supabase.
 * If includeInactive is false, only active styles are returned.
 */
export async function fetchArtStylesRemote(includeInactive = false): Promise<BaseStylePreset[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    let query = supabase
      .from('art_styles')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error || !data) return null;

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      familyId: row.family_id,
      tag: row.tag || '',
      description: row.description || '',
      stylePrompt: row.style_prompt,
      negativePrompt: row.negative_prompt || undefined,
      thumbnailUrl: row.thumbnail_url || undefined,
      aspectRatio: (row.aspect_ratio as '16:9' | '9:16' | '1:1') || '16:9',
      isDefault: Boolean(row.is_default),
      isActive: Boolean(row.is_active),
      sortOrder: row.sort_order ?? 100,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    }));
  } catch (err) {
    console.error('[Supabase] Failed to fetch art styles:', err);
    return null;
  }
}

/** Upsert an art style (create or update) in Supabase */
export async function upsertArtStyleRemote(style: BaseStylePreset): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createClient();
    const payload = {
      id: style.id,
      name: style.name,
      family_id: style.familyId || 'cinematic',
      tag: style.tag || null,
      description: style.description || null,
      style_prompt: style.stylePrompt,
      negative_prompt: style.negativePrompt || null,
      thumbnail_url: style.thumbnailUrl || null,
      aspect_ratio: style.aspectRatio || '16:9',
      is_default: Boolean(style.isDefault),
      is_active: style.isActive !== false,
      sort_order: style.sortOrder ?? 100,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('art_styles').upsert(payload);
    if (error) {
      console.error('[Supabase] Failed to upsert art style:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error upserting art style:', err);
    return false;
  }
}

/** Toggle active/inactive status of an art style */
export async function toggleArtStyleActiveRemote(id: string, isActive: boolean): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('art_styles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[Supabase] Failed to toggle art style:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error toggling art style:', err);
    return false;
  }
}

/** Delete an art style from Supabase */
export async function deleteArtStyleRemote(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createClient();
    const { error } = await supabase.from('art_styles').delete().eq('id', id);
    if (error) {
      console.error('[Supabase] Failed to delete art style:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Error deleting art style:', err);
    return false;
  }
}

/** Seed / Sync Default 30+ Catalog into Supabase art_styles table */
export async function seedDefaultArtStylesRemote(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, count: 0, error: 'Supabase credentials not configured' };
  }
  try {
    const supabase = createClient();
    const rows = SUB_STYLES_CATALOG.map((item, index) => ({
      id: item.id,
      name: item.name,
      family_id: item.familyId,
      tag: item.tag,
      description: item.description,
      style_prompt: item.stylePrompt,
      negative_prompt: item.negativePrompt || null,
      thumbnail_url: item.thumbnailUrl,
      aspect_ratio: '16:9',
      is_default: index === 0,
      is_active: true,
      sort_order: (index + 1) * 10,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('art_styles').upsert(rows);
    if (error) {
      console.error('[Supabase] Failed to seed default art styles:', error);
      return { success: false, count: 0, error: error.message };
    }
    return { success: true, count: rows.length };
  } catch (err: any) {
    console.error('[Supabase] Error seeding default art styles:', err);
    return { success: false, count: 0, error: err?.message || 'Unknown error' };
  }
}



