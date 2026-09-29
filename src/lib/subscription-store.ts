/**
 * subscription-store.ts — Subscription, Credits, Dynamic Plans, Promo Codes & Affiliate Engine
 */

import type {
  SubscriptionPlan,
  CreditTopupPack,
  PromoCode,
  PaymentSubmission,
  UserSubscription,
  UserProfile,
  AffiliatePayoutRequest,
  AdminSettings,
  RevenueAnalytics,
  PlanTier,
  BillingCycle,
} from '@/types/subscription';
import { deductCreditsRemote, grantCreditsRemote, isSupabaseConfigured } from '@/lib/supabase-service';

// ─── Default Admin Settings ──────────────────────────────────────────────────

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  whatsappNumber: '01315055532',
  bkashNumber: '01617420663',
  nagadNumber: '01617420663',
  bankDetails: 'City Bank PLC | Hazrat AI Studio | A/C: 1503204928001 | Dhanmondi Branch',
  globalDiscountPercent: 0,
  globalDiscountActive: false,
  globalBannerText: '🎉 Launch Celebration: Get 50 Free Image Credits on any subscription plan!',
  globalBannerActive: true,
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    badge: 'Popular for Beginners',
    popular: false,
    priceMonthly: 1200,
    priceYearly: 5000,
    creditsPerMonth: 600,
    maxVideoDurationSec: 180,
    maxResolution: '1080p',
    features: [
      '600 Image Credits / month (~15-20 videos)',
      'Up to 3-minute video duration per project',
      '1080p Full HD crisp rendering',
      '100% Watermark-Free Export',
      'Bangla & English AI Voiceovers included',
      'AI Script-to-Scenes Director',
      'Standard rendering queue',
      'Standard customer support',
    ],
    isActive: true,
  },
  {
    id: 'CREATOR',
    name: 'Creator',
    badge: 'Most Popular',
    popular: true,
    priceMonthly: 1800,
    priceYearly: 12000,
    creditsPerMonth: 800,
    maxVideoDurationSec: 480,
    maxResolution: '1080p',
    features: [
      '800 Image Credits / month (~40-50 videos)',
      'Up to 8-minute video duration per project',
      '1080p Full HD crisp rendering',
      '100% Watermark-Free Export',
      'Bangla & English AI Voiceovers included',
      'Custom visual styles & character consistency',
      'Commercial monetization license (YouTube & FB)',
      'Fast rendering priority queue',
      'Priority WhatsApp VIP support',
    ],
    isActive: true,
  },
  {
    id: 'STUDIO',
    name: 'Studio Pro',
    badge: 'Full Power',
    popular: false,
    priceMonthly: 2500,
    priceYearly: 25000,
    creditsPerMonth: 1500,
    maxVideoDurationSec: 1200,
    maxResolution: '4k',
    features: [
      '1,500 Image Credits / month (~100+ videos)',
      'Up to 20-minute video duration',
      '4K Ultra HD pristine rendering',
      '100% Watermark-Free Export',
      'All AI Voiceovers & Audio FX included',
      'Instant VIP rendering queue',
      'Full commercial & agency monetization rights',
      'Dedicated 1-on-1 WhatsApp VIP manager',
    ],
    isActive: true,
  },
];

export const DEFAULT_TOPUP_PACKS: CreditTopupPack[] = [
  {
    id: 'topup_50',
    name: 'Quick Top-up',
    credits: 50,
    priceBDT: 50,
    perCreditBDT: 1.0,
  },
  {
    id: 'topup_100',
    name: 'Standard Boost',
    credits: 100,
    priceBDT: 100,
    popular: true,
    perCreditBDT: 1.0,
  },
  {
    id: 'topup_250',
    name: 'Power Pack',
    credits: 250,
    priceBDT: 200, // Discounted: ৳0.80 per credit
    perCreditBDT: 0.8,
  },
];

const DEFAULT_PROMO_CODES: PromoCode[] = [
  {
    code: 'EARLY50',
    type: 'PERCENTAGE',
    discountValue: 50,
    validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
    maxUses: 50,
    currentUses: 14,
    maxUsesPerUser: 1,
    description: 'Launch special: 50% flat discount for early adopters',
    isActive: true,
    commissionPercent: 15,
  },
  {
    code: 'LAUNCH20',
    type: 'PERCENTAGE',
    discountValue: 20,
    validUntil: Date.now() + 60 * 24 * 60 * 60 * 1000,
    maxUses: 500,
    currentUses: 38,
    maxUsesPerUser: 1,
    description: '20% off on all monthly and yearly subscription plans',
    isActive: true,
    commissionPercent: 15,
  },
  {
    code: 'FREE30',
    type: 'CREDIT_BONUS',
    discountValue: 0,
    bonusCredits: 30,
    validUntil: Date.now() + 90 * 24 * 60 * 60 * 1000,
    maxUses: 200,
    currentUses: 52,
    maxUsesPerUser: 1,
    description: 'Unlocks +30 free bonus credits for new creators',
    isActive: true,
  },
];

// Guest user profile fallback (no mock credits)
export const GUEST_USER_PROFILE: UserProfile = {
  id: 'guest',
  name: 'Guest Creator',
  email: '',
  phone: '',
  tier: 'TRIAL',
  creditsRemaining: 0,
  creditsUsed: 0,
  totalSpentBDT: 0,
  joinedAt: Date.now(),
  isBlocked: false,
  referralCode: '',
  referralCount: 0,
  referralEarningsBDT: 0,
  referralPendingBDT: 0,
  referralPaidBDT: 0,
};

const DEFAULT_USER_LIST: UserProfile[] = [];

const serverMemoryStore: Record<string, unknown> = {};

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return (serverMemoryStore[key] as T) ?? fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    serverMemoryStore[key] = value;
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { }
}

// ─── Admin Settings Operations ───────────────────────────────────────────────

export function getAdminSettings(): AdminSettings {
  const current = safeGet<AdminSettings>('admin_app_settings', DEFAULT_ADMIN_SETTINGS);
  // Auto-clean stale dummy numbers from user's localStorage
  if (
    current.whatsappNumber === '8801712345678' ||
    current.bkashNumber === '01712345678' ||
    current.nagadNumber === '01712345678'
  ) {
    const upgraded: AdminSettings = {
      ...current,
      whatsappNumber: current.whatsappNumber === '8801712345678' ? DEFAULT_ADMIN_SETTINGS.whatsappNumber : current.whatsappNumber,
      bkashNumber: current.bkashNumber === '01712345678' ? DEFAULT_ADMIN_SETTINGS.bkashNumber : current.bkashNumber,
      nagadNumber: current.nagadNumber === '01712345678' ? DEFAULT_ADMIN_SETTINGS.nagadNumber : current.nagadNumber,
    };
    saveAdminSettings(upgraded);
    return upgraded;
  }
  return current;
}

export function saveAdminSettings(settings: AdminSettings): void {
  safeSet('admin_app_settings', settings);
}

// ─── Dynamic Plans Operations ────────────────────────────────────────────────

export function getSubscriptionPlans(): SubscriptionPlan[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('custom_subscription_plans');
    } catch {}
  }
  return DEFAULT_SUBSCRIPTION_PLANS;
}

export function saveSubscriptionPlans(_plans: SubscriptionPlan[]): void {
  // Plans are managed and synced via Supabase DB
}

export function getTopupPacks(): CreditTopupPack[] {
  return safeGet<CreditTopupPack[]>('custom_topup_packs', DEFAULT_TOPUP_PACKS);
}

export function saveTopupPacks(packs: CreditTopupPack[]): void {
  safeSet('custom_topup_packs', packs);
}

// ─── User Profile & Registry Operations ──────────────────────────────────────

export function notifyCreditsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('credits_updated'));
  }
}

export function getAllUsers(): UserProfile[] {
  return safeGet<UserProfile[]>('all_registered_users', DEFAULT_USER_LIST);
}

export function saveAllUsers(users: UserProfile[]): void {
  safeSet('all_registered_users', users);
  notifyCreditsUpdated();
}

/** Set the currently authenticated Supabase user profile into cache */
export function setActiveUserProfile(profile: UserProfile | null, broadcast = true): void {
  if (typeof window === 'undefined') return;
  if (!profile) {
    localStorage.removeItem('active_user_profile');
  } else {
    safeSet('active_user_profile', profile);
  }
  if (broadcast) {
    notifyCreditsUpdated();
  }
}

/** Get currently authenticated profile, or null if unauthenticated */
export function getCurrentUserProfile(): UserProfile | null {
  return safeGet<UserProfile | null>('active_user_profile', null);
}

export function updateCurrentUserProfile(update: Partial<UserProfile>): void {
  const current = getCurrentUserProfile();
  if (!current) return;
  setActiveUserProfile({ ...current, ...update });
}

export function setUserBlockStatus(userId: string, isBlocked: boolean, reason?: string): boolean {
  const users = getAllUsers();
  const u = users.find((item) => item.id === userId);
  if (!u) return false;
  u.isBlocked = isBlocked;
  u.blockReason = isBlocked ? (reason || 'Blocked by admin for violating terms') : undefined;
  saveAllUsers(users);
  return true;
}

export function adjustUserCredits(userId: string, deltaCredits: number): boolean {
  const users = getAllUsers();
  const u = users.find((item) => item.id === userId);
  if (!u) return false;
  u.creditsRemaining = Math.max(0, u.creditsRemaining + deltaCredits);
  saveAllUsers(users);
  return true;
}

export function assignUserPromoCode(userId: string, promoCode: string): boolean {
  const users = getAllUsers();
  const u = users.find((item) => item.id === userId);
  if (!u) return false;
  u.assignedPromoCode = promoCode.toUpperCase();
  saveAllUsers(users);
  return true;
}

// ─── Current User Subscription & Anti-Abuse ─────────────────────────────────

export function getUserSubscription(): UserSubscription | null {
  const profile = getCurrentUserProfile();
  if (!profile) return null;

  return {
    tier: profile.tier,
    creditsRemaining: profile.creditsRemaining,
    creditsUsed: profile.creditsUsed,
    totalCreditsPurchased: profile.creditsRemaining + profile.creditsUsed,
    startDate: profile.joinedAt,
    expiresAt: profile.joinedAt + 30 * 24 * 60 * 60 * 1000,
    billingCycle: 'monthly',
    status: profile.isBlocked ? 'EXPIRED' : 'ACTIVE',
  };
}

export function hasEnoughCredits(requiredCredits: number): boolean {
  const profile = getCurrentUserProfile();
  if (!profile || profile.isBlocked) return false;
  return profile.creditsRemaining >= requiredCredits;
}

export function getUserCreditsRemaining(): number {
  const profile = getCurrentUserProfile();
  if (!profile || profile.isBlocked) return 0;
  return profile.creditsRemaining ?? 0;
}

export function deductUserCredits(amount: number, reason = 'image_generation'): boolean {
  const profile = getCurrentUserProfile();
  if (!profile || profile.isBlocked || profile.creditsRemaining < amount) {
    return false;
  }
  profile.creditsRemaining = Math.max(0, profile.creditsRemaining - amount);
  profile.creditsUsed += amount;
  setActiveUserProfile(profile);
  console.log(`[Subscription] Deducted ${amount} credits for "${reason}". Remaining: ${profile.creditsRemaining}`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('subscription_credits_updated', {
      detail: { creditsRemaining: profile.creditsRemaining, creditsUsed: profile.creditsUsed },
    }));
  }

  if (isSupabaseConfigured() && profile.id && profile.id !== 'guest') {
    deductCreditsRemote(profile.id, amount).catch(console.error);
  }

  return true;
}

export function grantUserCredits(amount: number, reason = 'credit_grant'): void {
  const profile = getCurrentUserProfile();
  if (!profile) return;
  profile.creditsRemaining += amount;
  setActiveUserProfile(profile);
  console.log(`[Subscription] Granted ${amount} credits ("${reason}"). New balance: ${profile.creditsRemaining}`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('subscription_credits_updated', {
      detail: { creditsRemaining: profile.creditsRemaining, creditsUsed: profile.creditsUsed },
    }));
  }

  if (isSupabaseConfigured() && profile.id && profile.id !== 'guest') {
    grantCreditsRemote(profile.id, amount).catch(console.error);
  }
}

// ─── Promo Codes ────────────────────────────────────────────────────────────

export function getAllPromoCodes(): PromoCode[] {
  return safeGet<PromoCode[]>('promo_codes_list', DEFAULT_PROMO_CODES);
}

export function savePromoCodes(codes: PromoCode[]): void {
  safeSet('promo_codes_list', codes);
}

export interface PromoValidationResult {
  valid: boolean;
  message: string;
  promo?: PromoCode;
  discountedPriceBDT?: number;
  bonusCredits?: number;
}

/** Check how many times a user (by userId or userEmail) has redeemed a specific promo code */
export function getUserPromoRedemptionCount(identifier: string, code: string): number {
  if (!identifier || !code) return 0;
  const cleanId = identifier.trim().toLowerCase();
  const cleanCode = code.trim().toUpperCase();
  const list = getAllPaymentSubmissions();
  return list.filter((p) => {
    const matchesUser =
      (p.userEmail && p.userEmail.toLowerCase() === cleanId) ||
      (p.userId && p.userId.toLowerCase() === cleanId);
    const matchesCode = p.promoCodeApplied?.toUpperCase() === cleanCode;
    const isValidStatus = p.status !== 'REJECTED';
    return matchesUser && matchesCode && isValidStatus;
  }).length;
}

/** Check if user has previously completed any approved orders */
export function getUserApprovedOrderCount(identifier: string): number {
  if (!identifier) return 0;
  const cleanId = identifier.trim().toLowerCase();
  const list = getAllPaymentSubmissions();
  return list.filter((p) => {
    const matchesUser =
      (p.userEmail && p.userEmail.toLowerCase() === cleanId) ||
      (p.userId && p.userId.toLowerCase() === cleanId);
    return matchesUser && p.status === 'APPROVED';
  }).length;
}

export function validateAndApplyPromoCode(
  inputCode: string,
  originalPriceBDT: number,
  userIdentifier?: string,
  planId?: PlanTier
): PromoValidationResult {
  const settings = getAdminSettings();
  const cleanCode = inputCode.trim().toUpperCase();

  const globalDiscountPercent = settings.globalDiscountActive ? (settings.globalDiscountPercent || 0) : 0;
  const globalDiscountedPrice = globalDiscountPercent > 0
    ? Math.max(0, Math.round(originalPriceBDT * (1 - globalDiscountPercent / 100)))
    : originalPriceBDT;

  if (!cleanCode) {
    return {
      valid: true,
      message: settings.globalDiscountActive && globalDiscountPercent > 0
        ? `Global sale active: ${globalDiscountPercent}% off`
        : '',
      discountedPriceBDT: globalDiscountedPrice,
    };
  }

  // Check user referral codes as well!
  const users = getAllUsers();
  const referralOwner = users.find((u) => u.referralCode?.toUpperCase() === cleanCode);
  if (referralOwner) {
    // Check if user is trying to use their own referral code
    if (userIdentifier) {
      const cleanId = userIdentifier.trim().toLowerCase();
      if (referralOwner.id.toLowerCase() === cleanId || referralOwner.email?.toLowerCase() === cleanId) {
        return { valid: false, message: 'You cannot use your own referral code.' };
      }

      const priorUses = getUserPromoRedemptionCount(userIdentifier, cleanCode);
      if (priorUses >= 1) {
        return { valid: false, message: 'You have already redeemed a referral discount on this account.' };
      }
    }

    // 20% discount for anyone using a user referral code
    const referralDiscountedPrice = Math.max(0, Math.round(originalPriceBDT * 0.8));
    // Best offer wins against global storewide discount
    const finalPrice = Math.min(referralDiscountedPrice, globalDiscountedPrice);

    return {
      valid: true,
      message: `Referral code by ${referralOwner.name}: 20% discount applied!`,
      discountedPriceBDT: finalPrice,
      bonusCredits: 15,
      promo: {
        code: cleanCode,
        type: 'PERCENTAGE',
        discountValue: 20,
        bonusCredits: 15,
        validUntil: Date.now() + 365 * 24 * 3600 * 1000,
        maxUses: 9999,
        currentUses: referralOwner.referralCount,
        maxUsesPerUser: 1,
        firstPurchaseOnly: true,
        description: `Referral discount from ${referralOwner.name}`,
        isActive: true,
        ownerUserId: referralOwner.id,
        commissionPercent: 15,
      },
    };
  }

  const allCodes = getAllPromoCodes();
  const promo = allCodes.find((p) => p.code.toUpperCase() === cleanCode);

  if (!promo) {
    return { valid: false, message: 'Invalid promo code. Please check spelling.' };
  }
  if (!promo.isActive) {
    return { valid: false, message: 'This promo code is currently disabled.' };
  }
  if (promo.validUntil < Date.now()) {
    return { valid: false, message: 'This promo code has expired.' };
  }
  if (promo.maxUses > 0 && promo.currentUses >= promo.maxUses) {
    return { valid: false, message: 'This promo code has reached its maximum global limit.' };
  }

  // Check plan tier eligibility if restricted
  if (promo.applicablePlans && promo.applicablePlans.length > 0 && planId && !promo.applicablePlans.includes(planId)) {
    return { valid: false, message: `This promo code is only valid for ${promo.applicablePlans.join(', ')} plans.` };
  }

  // Check per-user redemption limit (default 1 use per user account)
  const maxPerUser = promo.maxUsesPerUser ?? 1;
  if (userIdentifier) {
    const userUses = getUserPromoRedemptionCount(userIdentifier, cleanCode);
    if (userUses >= maxPerUser) {
      return { valid: false, message: `You have already redeemed this promo code (${maxPerUser} time limit reached).` };
    }
  }

  // Check first purchase only restriction
  if (promo.firstPurchaseOnly && userIdentifier) {
    const pastApproved = getUserApprovedOrderCount(userIdentifier);
    if (pastApproved > 0) {
      return { valid: false, message: 'This promo code is only valid for first-time customers.' };
    }
  }

  let promoCalculatedPrice = originalPriceBDT;
  let bonusCredits = 0;

  if (promo.type === 'PERCENTAGE') {
    const discountAmount = (originalPriceBDT * promo.discountValue) / 100;
    promoCalculatedPrice = Math.max(0, Math.round(originalPriceBDT - discountAmount));
  } else if (promo.type === 'FIXED') {
    promoCalculatedPrice = Math.max(0, originalPriceBDT - promo.discountValue);
  } else if (promo.type === 'CREDIT_BONUS') {
    bonusCredits = promo.bonusCredits || 0;
  }

  // Best offer wins rule: compare promo calculated price with storewide global discount
  const finalDiscountedPrice = Math.min(promoCalculatedPrice, globalDiscountedPrice);

  return {
    valid: true,
    message: promo.description || `${promo.code} applied successfully!`,
    promo,
    discountedPriceBDT: finalDiscountedPrice,
    bonusCredits,
  };
}

export function incrementPromoCodeUsage(code: string): void {
  const codes = getAllPromoCodes();
  const target = codes.find((p) => p.code.toUpperCase() === code.trim().toUpperCase());
  if (target) {
    target.currentUses += 1;
    savePromoCodes(codes);
  }

  // Also check referral user
  const users = getAllUsers();
  const refOwner = users.find((u) => u.referralCode?.toUpperCase() === code.trim().toUpperCase());
  if (refOwner) {
    refOwner.referralCount += 1;
    saveAllUsers(users);
  }
}

export function createNewPromoCode(newCode: PromoCode): void {
  const codes = getAllPromoCodes();
  const exists = codes.findIndex((c) => c.code.toUpperCase() === newCode.code.toUpperCase());
  if (exists >= 0) {
    codes[exists] = newCode;
  } else {
    codes.unshift(newCode);
  }
  savePromoCodes(codes);
}

export function deletePromoCode(code: string): void {
  const codes = getAllPromoCodes().filter((c) => c.code.toUpperCase() !== code.toUpperCase());
  savePromoCodes(codes);
}

// ─── Manual Payment Submissions (WhatsApp Assisted) ─────────────────────────

export function getAllPaymentSubmissions(): PaymentSubmission[] {
  return safeGet<PaymentSubmission[]>('payment_submissions_list', []);
}

export function savePaymentSubmissions(submissions: PaymentSubmission[]): void {
  safeSet('payment_submissions_list', submissions);
}

export function submitPaymentRequest(
  submission: Omit<PaymentSubmission, 'id' | 'status' | 'submittedAt'>
): PaymentSubmission {
  const newSubmission: PaymentSubmission = {
    ...submission,
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    status: 'PENDING',
    submittedAt: Date.now(),
  };

  const list = getAllPaymentSubmissions();
  list.unshift(newSubmission);
  savePaymentSubmissions(list);

  if (submission.promoCodeApplied) {
    incrementPromoCodeUsage(submission.promoCodeApplied);
  }

  return newSubmission;
}

/** Admin Action: Approve Payment Request */
export function approvePaymentRequest(submissionId: string, adminNote?: string): boolean {
  const list = getAllPaymentSubmissions();
  const sub = list.find((s) => s.id === submissionId);
  if (!sub || sub.status === 'APPROVED') return false;

  sub.status = 'APPROVED';
  sub.reviewedAt = Date.now();
  if (adminNote) sub.adminNote = adminNote;
  savePaymentSubmissions(list);

  // Grant plan / credits to the target user
  const users = getAllUsers();
  const targetUser = users.find((u) => u.id === sub.userId) || getCurrentUserProfile();

  if (targetUser) {
    if (sub.itemType === 'subscription' && sub.planId) {
      targetUser.tier = sub.planId;
      targetUser.creditsRemaining += sub.creditsToGrant;
      targetUser.totalSpentBDT += sub.discountedPriceBDT;
    } else if (sub.itemType === 'topup') {
      targetUser.creditsRemaining += sub.creditsToGrant;
      targetUser.totalSpentBDT += sub.discountedPriceBDT;
    }
    updateCurrentUserProfile(targetUser);
  }

  // If promo code belonged to an affiliate/referral, credit their pending earnings!
  if (sub.promoCodeApplied) {
    const code = sub.promoCodeApplied.toUpperCase();
    const refOwner = users.find((u) => u.referralCode?.toUpperCase() === code);
    if (refOwner) {
      const commission = Math.round(sub.discountedPriceBDT * 0.15); // 15% commission
      refOwner.referralEarningsBDT += commission;
      refOwner.referralPendingBDT += commission;
      saveAllUsers(users);
      console.log(`[Affiliate] Credited ৳${commission} commission to ${refOwner.name} for code ${code}`);
    }
  }

  return true;
}

export function rejectPaymentRequest(submissionId: string, reason?: string): boolean {
  const list = getAllPaymentSubmissions();
  const sub = list.find((s) => s.id === submissionId);
  if (!sub || sub.status === 'REJECTED') return false;

  sub.status = 'REJECTED';
  sub.reviewedAt = Date.now();
  sub.adminNote = reason || 'Payment could not be verified.';
  savePaymentSubmissions(list);

  return true;
}

// ─── WhatsApp Direct Link Generator ─────────────────────────────────────────

export function formatWhatsAppLink(number?: string, message?: string): string {
  const settings = getAdminSettings();
  const targetNumber = (number && number.trim()) ? number.trim() : settings.whatsappNumber;
  let rawNumber = targetNumber.replace(/[^0-9]/g, '');
  if (rawNumber.startsWith('01')) {
    rawNumber = '88' + rawNumber;
  }
  return message
    ? `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${rawNumber}`;
}

export function getWhatsAppVerificationUrl(
  senderPhone: string,
  amountBDT: number,
  itemName: string,
  userEmail: string,
  adminWhatsApp?: string
): string {
  const text = (
    `Hello Admin! I have sent ৳${amountBDT} via bKash/Nagad.\n` +
    `Phone Number: ${senderPhone}\n` +
    `Item: ${itemName}\n` +
    `My Account Email: ${userEmail}\n` +
    `Please verify and approve my credits/subscription!`
  );
  return formatWhatsAppLink(adminWhatsApp, text);
}

// ─── Affiliate Payout System ────────────────────────────────────────────────

export function getAllPayoutRequests(): AffiliatePayoutRequest[] {
  return safeGet<AffiliatePayoutRequest[]>('affiliate_payout_requests', []);
}

export function savePayoutRequests(requests: AffiliatePayoutRequest[]): void {
  safeSet('affiliate_payout_requests', requests);
}

export function submitPayoutRequest(
  userId: string,
  userEmail: string,
  amountBDT: number,
  paymentMethod: 'bkash' | 'nagad' | 'bank',
  accountNumber: string
): boolean {
  const users = getAllUsers();
  const u = users.find((item) => item.id === userId);
  if (!u || u.referralPendingBDT < amountBDT) return false;

  u.referralPendingBDT -= amountBDT;
  saveAllUsers(users);

  const req: AffiliatePayoutRequest = {
    id: `payout_${Date.now()}`,
    userId,
    userEmail,
    amountBDT,
    paymentMethod,
    accountNumber,
    requestedAt: Date.now(),
    status: 'PENDING',
  };

  const allReqs = getAllPayoutRequests();
  allReqs.unshift(req);
  savePayoutRequests(allReqs);
  return true;
}

export function approvePayoutRequest(payoutId: string, note?: string): boolean {
  const reqs = getAllPayoutRequests();
  const req = reqs.find((r) => r.id === payoutId);
  if (!req || req.status === 'PAID') return false;

  req.status = 'PAID';
  req.paidAt = Date.now();
  req.note = note || 'Paid via bKash/Nagad';
  savePayoutRequests(reqs);

  // Update user paid total
  const users = getAllUsers();
  const u = users.find((item) => item.id === req.userId);
  if (u) {
    u.referralPaidBDT += req.amountBDT;
    saveAllUsers(users);
  }

  return true;
}

// ─── Revenue Analytics ──────────────────────────────────────────────────────

export function getRevenueAnalytics(): RevenueAnalytics {
  const submissions = getAllPaymentSubmissions();
  const approved = submissions.filter((s) => s.status === 'APPROVED');
  const promoCodes = getAllPromoCodes();
  const users = getAllUsers();

  const totalRevenueBDT = approved.reduce((sum, s) => sum + s.discountedPriceBDT, 0);

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthlyRevenueBDT = approved
    .filter((s) => s.submittedAt >= currentMonthStart)
    .reduce((sum, s) => sum + s.discountedPriceBDT, 0);

  const pendingApprovals = submissions.filter((s) => s.status === 'PENDING').length;
  const activeSubscribers = users.filter((u) => u.tier !== 'TRIAL' && !u.isBlocked).length;
  const totalCreditsUsed = users.reduce((sum, u) => sum + u.creditsUsed, 0);

  const topPromoCodes = promoCodes.map((p) => {
    const uses = p.currentUses;
    const revenueBDT = approved
      .filter((s) => s.promoCodeApplied?.toUpperCase() === p.code.toUpperCase())
      .reduce((sum, s) => sum + s.discountedPriceBDT, 0);
    return { code: p.code, uses, revenueBDT };
  });

  return {
    totalRevenueBDT,
    monthlyRevenueBDT,
    activeSubscribers,
    pendingApprovals,
    totalCreditsUsed,
    totalImagesGenerated: totalCreditsUsed,
    topPromoCodes,
  };
}
