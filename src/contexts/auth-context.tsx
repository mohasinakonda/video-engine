'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchSupabaseProfile, isSupabaseConfigured } from '@/lib/supabase-service';
import { setActiveUserProfile } from '@/lib/subscription-store';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserSubscription } from '@/types/subscription';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  subscription: UserSubscription | null;
  isAdmin: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  subscription: null,
  isAdmin: false,
  isLoading: true,
  refresh: async () => {},
});

function deriveSubscription(profile: UserProfile): UserSubscription {
  const isTrial = profile.tier === 'TRIAL';
  const joinedTimestamp =
    typeof profile.joinedAt === 'number'
      ? profile.joinedAt
      : new Date(profile.joinedAt).getTime() || Date.now();

  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  let expiresAt: number;
  if (profile.subscriptionExpiresAt && typeof profile.subscriptionExpiresAt === 'number') {
    expiresAt = profile.subscriptionExpiresAt;
  } else if (isTrial) {
    expiresAt = joinedTimestamp + 365 * 24 * 60 * 60 * 1000;
  } else {
    expiresAt = joinedTimestamp + THIRTY_DAYS;
  }

  const isExpired = !isTrial && Date.now() > expiresAt;

  return {
    tier: isExpired ? 'TRIAL' : profile.tier,
    creditsRemaining: profile.creditsRemaining,
    creditsUsed: profile.creditsUsed,
    totalCreditsPurchased: profile.creditsRemaining + profile.creditsUsed,
    startDate: joinedTimestamp,
    expiresAt,
    billingCycle: 'monthly',
    status: profile.isBlocked ? 'EXPIRED' : isExpired ? 'EXPIRED' : isTrial ? 'TRIAL' : 'ACTIVE',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    subscription: null,
    isAdmin: false,
    isLoading: true,
  });

  const requestIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);

  const loadUserData = useCallback(async (forcedUser?: User | null) => {
    const currentReqId = ++requestIdRef.current;

    if (!isSupabaseConfigured()) {
      if (currentReqId === requestIdRef.current) {
        setState({
          user: null,
          profile: null,
          subscription: null,
          isAdmin: false,
          isLoading: false,
        });
        activeUserIdRef.current = null;
        setActiveUserProfile(null, false);
      }
      return;
    }

    try {
      const supabase = createClient();
      let activeUser = forcedUser;

      if (activeUser === undefined) {
        // Use cached session to avoid unnecessary network request to auth/v1/user
        const { data: { session } } = await supabase.auth.getSession();
        activeUser = session?.user ?? null;
      }

      if (currentReqId !== requestIdRef.current) return;

      if (!activeUser) {
        activeUserIdRef.current = null;
        setState({
          user: null,
          profile: null,
          subscription: null,
          isAdmin: false,
          isLoading: false,
        });
        setActiveUserProfile(null, false);
        return;
      }

      activeUserIdRef.current = activeUser.id;

      // Fetch profile & admin status in a single round-trip
      const profile = await fetchSupabaseProfile(activeUser.id);
      if (currentReqId !== requestIdRef.current) return;

      if (profile) {
        const sub = deriveSubscription(profile);
        const isAdmin = profile.role === 'admin';

        setState({
          user: activeUser,
          profile,
          subscription: sub,
          isAdmin,
          isLoading: false,
        });
        // Pass broadcast=false to prevent re-triggering credits_updated listener!
        setActiveUserProfile(profile, false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth_profile_loaded', { detail: profile }));
        }
      } else {
        setState({
          user: activeUser,
          profile: null,
          subscription: null,
          isAdmin: false,
          isLoading: false,
        });
        setActiveUserProfile(null, false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth_profile_loaded', { detail: null }));
        }
      }
    } catch (err) {
      console.warn('[AuthProvider] Error loading user data:', err);
      if (currentReqId === requestIdRef.current) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    loadUserData();

    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only reload when auth state changes meaningfully
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        loadUserData(session?.user ?? null);
      }
    });

    const handleCreditsUpdated = () => {
      // Refresh profile without re-fetching auth session if user is known
      loadUserData();
    };

    window.addEventListener('credits_updated', handleCreditsUpdated);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('credits_updated', handleCreditsUpdated);
    };
  }, [loadUserData]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
