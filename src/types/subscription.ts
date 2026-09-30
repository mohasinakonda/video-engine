export type PlanTier = 'TRIAL' | 'STARTER' | 'CREATOR' | 'STUDIO';

export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  badge?: string;
  popular?: boolean;
  priceMonthly: number;
  priceYearly: number;
  creditsPerMonth: number;
  maxVideoDurationSec: number;
  maxResolution: '1080p' | '4k';
  features: string[];
  isActive?: boolean;
}

export interface CreditTopupPack {
  id: string;
  name: string;
  credits: number;
  priceBDT: number;
  popular?: boolean;
  perCreditBDT: number;
}

export type PromoDiscountType = 'PERCENTAGE' | 'FIXED' | 'CREDIT_BONUS';

export interface PromoCode {
  code: string;
  type: PromoDiscountType;
  discountValue: number; // e.g. 50 for 50%, or 200 for 200 BDT
  bonusCredits?: number;
  validUntil: number; // timestamp
  maxUses: number;
  currentUses: number;
  description: string;
  isActive: boolean;
  ownerUserId?: string; // If this promo code belongs to a specific user/affiliate
  commissionPercent?: number; // e.g. 15% commission to owner on each purchase
  maxUsesPerUser?: number; // Max times a single user/email can redeem (default: 1)
  firstPurchaseOnly?: boolean; // If true, only valid on user's first order
  applicablePlans?: PlanTier[]; // Restrict to specific plan tiers (e.g. ['CREATOR', 'STUDIO'])
}

export type PaymentMethod = 'bkash' | 'nagad' | 'bank';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentSubmission {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  planId?: PlanTier;
  topupId?: string;
  itemType: 'subscription' | 'topup';
  billingCycle?: BillingCycle;
  originalPriceBDT: number;
  discountedPriceBDT: number;
  promoCodeApplied?: string;
  creditsToGrant: number;
  paymentMethod: PaymentMethod;
  senderNumber: string;
  trxId?: string; // Optional now: phone number + WhatsApp verification is primary
  status: PaymentStatus;
  submittedAt: number;
  reviewedAt?: number;
  adminNote?: string;
}

export interface UserSubscription {
  tier: PlanTier;
  creditsRemaining: number;
  creditsUsed: number;
  totalCreditsPurchased: number;
  startDate: number;
  expiresAt: number;
  billingCycle: BillingCycle;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL';
  activePromoCode?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  tier: PlanTier;
  creditsRemaining: number;
  creditsUsed: number;
  totalSpentBDT: number;
  joinedAt: number;
  isBlocked: boolean;
  blockReason?: string;
  referralCode: string;
  referralCount: number; // how many people used their code
  referralEarningsBDT: number; // total commission earned
  referralPendingBDT: number; // pending payout
  referralPaidBDT: number; // paid out
  assignedPromoCode?: string;
  role?: 'admin' | 'user';
  subscriptionExpiresAt?: number;
}

export interface AffiliatePayoutRequest {
  id: string;
  userId: string;
  userEmail: string;
  amountBDT: number;
  paymentMethod: PaymentMethod;
  accountNumber: string;
  requestedAt: number;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  paidAt?: number;
  note?: string;
}

export interface AdminSettings {
  whatsappNumber: string; // e.g. 01315055532 or 8801315055532
  bkashNumber: string;
  nagadNumber: string;
  bankDetails: string;
  globalDiscountPercent: number; // 0-100
  globalDiscountActive: boolean;
  globalBannerText: string;
  globalBannerActive: boolean;
}

export interface RevenueAnalytics {
  totalRevenueBDT: number;
  monthlyRevenueBDT: number;
  activeSubscribers: number;
  pendingApprovals: number;
  totalCreditsUsed: number;
  totalImagesGenerated: number;
  topPromoCodes: { code: string; uses: number; revenueBDT: number }[];
}
