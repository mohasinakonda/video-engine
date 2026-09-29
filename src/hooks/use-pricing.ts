'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getSubscriptionPlans,
  getTopupPacks,
  getAdminSettings,
  getUserSubscription,
  getCurrentUserProfile,
  setActiveUserProfile,
  getAllPaymentSubmissions,
} from '@/lib/subscription-store';
import { createClient } from '@/lib/supabase/client';
import { fetchSupabaseProfile } from '@/lib/supabase-service';
import type { User } from '@supabase/supabase-js';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  PaymentSubmission,
  UserSubscription,
  UserProfile,
  AdminSettings,
} from '@/types/subscription';

export interface UsePricingPlansReturn {
  plans: SubscriptionPlan[];
  topupPacks: CreditTopupPack[];
  settings: AdminSettings | null;
  isLoading: boolean;
  error: string | null;
  refreshPlans: () => Promise<void>;
}

/**
 * Lightweight hook to fetch pricing plans, top-up packs, and admin settings (banners, discounts).
 * Useful for public components like OfferBanner and landing PricingSection.
 */
export function usePricingPlans(): UsePricingPlansReturn {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => getSubscriptionPlans());
  const [topupPacks, setTopupPacks] = useState<CreditTopupPack[]>(() => getTopupPacks());
  const [settings, setSettings] = useState<AdminSettings | null>(() => getAdminSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/admin/plan');
      if (res.ok) {
        const data = await res.json();
        if (data.plans && data.plans.length > 0) {
          const activePlans = data.plans.filter((p: SubscriptionPlan) => p.isActive !== false);
          setPlans(activePlans);
        }
        if (data.topupPacks && data.topupPacks.length > 0) {
          setTopupPacks(data.topupPacks);
        }
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load plans');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  return {
    plans,
    topupPacks,
    settings,
    isLoading,
    error,
    refreshPlans,
  };
}

export interface UsePricingOptions {
  initialUser?: User | null;
}

export interface UsePricingReturn {
  plans: SubscriptionPlan[];
  setPlans: React.Dispatch<React.SetStateAction<SubscriptionPlan[]>>;
  topupPacks: CreditTopupPack[];
  setTopupPacks: React.Dispatch<React.SetStateAction<CreditTopupPack[]>>;
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  userEmail: string;
  setUserEmail: React.Dispatch<React.SetStateAction<string>>;
  userSub: UserSubscription | null;
  setUserSub: React.Dispatch<React.SetStateAction<UserSubscription | null>>;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  submissions: PaymentSubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<PaymentSubmission[]>>;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

/**
 * Comprehensive hook for managing subscription plans, user quotas, payment history, and session sync.
 * Eliminates duplicate state and fetch logic across pricing views.
 */
export function usePricing({ initialUser }: UsePricingOptions = {}): UsePricingReturn {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => getSubscriptionPlans());
  const [topupPacks, setTopupPacks] = useState<CreditTopupPack[]>(() => getTopupPacks());
  const [settings, setSettings] = useState<AdminSettings | null>(() => getAdminSettings());
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(initialUser));
  const [userEmail, setUserEmail] = useState(initialUser?.email || '');
  const [userSub, setUserSub] = useState<UserSubscription | null>(() => getUserSubscription());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getCurrentUserProfile());
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>(() => getAllPaymentSubmissions());
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setIsLoading(true);

    // Initial sync from local storage defaults
    setPlans(getSubscriptionPlans());
    setTopupPacks(getTopupPacks());
    setSettings(getAdminSettings());
    setUserSub(getUserSubscription());
    setUserProfile(getCurrentUserProfile());
    setSubmissions(getAllPaymentSubmissions());

    // Fetch live plans and settings from API
    try {
      const res = await fetch('/api/admin/plan');
      if (res.ok) {
        const data = await res.json();
        if (data.plans && data.plans.length > 0) setPlans(data.plans);
        if (data.topupPacks && data.topupPacks.length > 0) setTopupPacks(data.topupPacks);
        if (data.settings) setSettings(data.settings);
      }
    } catch {
      // Fallback already populated
    }

    // Verify authentication via Supabase client session & fetch live profile
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        setUserEmail(session.user.email || '');

        try {
          const liveProfile = await fetchSupabaseProfile(session.user.id);
          if (liveProfile) {
            setUserProfile(liveProfile);
            setActiveUserProfile(liveProfile);
          }
        } catch { }

        try {
          const payRes = await fetch(
            `/api/payments?userId=${session.user.id}&userEmail=${encodeURIComponent(session.user.email || '')}`
          );
          if (payRes.ok) {
            const payData = await payRes.json();
            if (payData.success && payData.payments) {
              setSubmissions(payData.payments);
            }
          }
        } catch { }
      } else {
        setIsLoggedIn(Boolean(initialUser));
      }
    } catch {
      setIsLoggedIn(Boolean(initialUser));
    } finally {
      setIsLoading(false);
    }
  }, [initialUser]);

  useEffect(() => {
    refreshData();

    try {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setIsLoggedIn(true);
          setUserEmail(session.user.email || '');
        } else {
          setIsLoggedIn(false);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // Supabase listener silent fallback
    }
  }, [initialUser, refreshData]);

  return {
    plans,
    setPlans,
    topupPacks,
    setTopupPacks,
    settings,
    setSettings,
    isLoggedIn,
    setIsLoggedIn,
    userEmail,
    setUserEmail,
    userSub,
    setUserSub,
    userProfile,
    setUserProfile,
    submissions,
    setSubmissions,
    isLoading,
    refreshData,
  };
}
