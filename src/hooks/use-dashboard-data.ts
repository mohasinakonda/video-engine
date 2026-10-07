'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentUserProfile,
  getUserSubscription,
  getAllPaymentSubmissions,
  getAdminSettings,
} from '@/lib/subscription-store';
import {
  getSupabaseUser,
  ensureUserProfileRemote,
  fetchUserPaymentsRemote,
  fetchAdminSettingsRemote,
  isSupabaseConfigured,
} from '@/lib/supabase-service';
import {
  getAllProjects,
  deleteProject,
  BUILT_IN_STYLE_PRESETS,
  getStylePresets,
} from '@/lib/store';
import { getMediaBlobUrl, getStorageEstimate } from '@/lib/media-storage';
import type {
  UserProfile,
  UserSubscription,
  PaymentSubmission,
  AdminSettings,
} from '@/types/subscription';
import type { ProjectManifest, BaseStylePreset } from '@/types';

export interface UseDashboardDataReturn {
  profile: UserProfile | null;
  sub: UserSubscription | null;
  submissions: PaymentSubmission[];
  settings: AdminSettings | null;
  projects: ProjectManifest[];
  thumbnails: Record<string, string>;
  stylePresets: BaseStylePreset[];
  storageInfo: { usedMB: number; quotaMB: number };
  isLiveSupabase: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  deletingId: string | null;
  refreshData: () => Promise<void>;
  loadProjectsData: () => Promise<void>;
  deleteProjectItem: (projectId: string) => Promise<boolean>;
}

export function useDashboardData(): UseDashboardDataReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sub, setSub] = useState<UserSubscription | null>(null);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [stylePresets, setStylePresets] = useState<BaseStylePreset[]>(BUILT_IN_STYLE_PRESETS);
  const [storageInfo, setStorageInfo] = useState<{ usedMB: number; quotaMB: number }>({ usedMB: 0, quotaMB: 0 });
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjectsData = useCallback(async () => {
    try {
      const all = await getAllProjects();
      setProjects(all);

      const thumbs: Record<string, string> = {};
      await Promise.all(
        all.map(async (p) => {
          if (p.scenes && p.scenes.length > 0) {
            const firstScene = p.scenes.find((s) => s.imageUrl || s.status === 'IMAGE_READY') || p.scenes[0];
            if (firstScene) {
              const url = await getMediaBlobUrl(`scene_${p.projectId}_${firstScene.sceneId}`);
              if (url) {
                thumbs[p.projectId] = url;
              }
            }
          }
        })
      );
      setThumbnails(thumbs);

      const presets = await getStylePresets();
      if (presets && presets.length > 0) {
        setStylePresets(presets);
      }

      const storage = await getStorageEstimate();
      setStorageInfo(storage);
    } catch (err) {
      console.warn('Error loading projects in dashboard hook:', err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadProjectsData();

      if (isSupabaseConfigured()) {
        const authUser = await getSupabaseUser();
        if (authUser) {
          setIsLoggedIn(true);
          const remoteProf = await ensureUserProfileRemote(authUser);
          if (remoteProf) {
            setProfile(remoteProf);
            setIsLiveSupabase(true);

            const localSub = getUserSubscription();
            const expiresAt = remoteProf.subscriptionExpiresAt || (remoteProf.joinedAt + 30 * 24 * 3600 * 1000);
            const isSubExpired = remoteProf.tier !== 'TRIAL' && remoteProf.subscriptionExpiresAt ? Date.now() > remoteProf.subscriptionExpiresAt : false;
            setSub({
              tier: isSubExpired ? 'TRIAL' : remoteProf.tier,
              creditsRemaining: remoteProf.creditsRemaining,
              creditsUsed: remoteProf.creditsUsed,
              totalCreditsPurchased: remoteProf.creditsRemaining + remoteProf.creditsUsed,
              startDate: remoteProf.joinedAt,
              expiresAt,
              billingCycle: localSub?.billingCycle || 'monthly',
              status: remoteProf.isBlocked ? 'EXPIRED' : isSubExpired ? 'EXPIRED' : remoteProf.tier === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
            });

            const userPayments = await fetchUserPaymentsRemote(authUser.id, authUser.email);
            if (userPayments) {
              setSubmissions(userPayments);
            } else {
              setSubmissions(
                getAllPaymentSubmissions().filter(
                  (s) => s.userId === authUser.id || s.userEmail === authUser.email
                )
              );
            }

            const remoteSettings = await fetchAdminSettingsRemote();
            setSettings(remoteSettings || getAdminSettings());
            return;
          }
        }
      }

      // Guest / Local Fallback
      setIsLoggedIn(false);
      setIsLiveSupabase(false);
      const prof = getCurrentUserProfile() || null;
      setProfile(prof);
      const guestSub: UserSubscription = {
        tier: 'TRIAL',
        creditsRemaining: 0,
        creditsUsed: 0,
        totalCreditsPurchased: 0,
        startDate: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
        billingCycle: 'monthly',
        status: 'ACTIVE',
      };
      setSub(getUserSubscription() || guestSub);
      setSubmissions([]);
      setSettings(getAdminSettings());
    } catch (err) {
      console.warn('Dashboard fetch error in hook, falling back:', err);
      const prof = getCurrentUserProfile() || null;
      setProfile(prof);
      setSettings(getAdminSettings());
    } finally {
      setIsLoading(false);
    }
  }, [loadProjectsData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const deleteProjectItem = useCallback(
    async (projectId: string): Promise<boolean> => {
      setDeletingId(projectId);
      try {
        await deleteProject(projectId);
        await loadProjectsData();
        return true;
      } catch (err) {
        console.error('Failed to delete project in hook:', err);
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [loadProjectsData]
  );

  return {
    profile,
    sub,
    submissions,
    settings,
    projects,
    thumbnails,
    stylePresets,
    storageInfo,
    isLiveSupabase,
    isLoggedIn,
    isLoading,
    deletingId,
    refreshData,
    loadProjectsData,
    deleteProjectItem,
  };
}
