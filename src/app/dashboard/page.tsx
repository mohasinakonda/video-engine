'use client';

import React, { useState } from 'react';
import {
  FolderKanban,
  Palette,
  Share2,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard-data';

// Modular Dashboard Components
import DashboardHeader from '@/components/dashboard/dashboard-header';
import MetricCards from '@/components/dashboard/metric-cards';
import QuickLaunchSection from '@/components/dashboard/quick-launch-section';
import ProjectsTab from '@/components/dashboard/tabs/projects-tab';
import TemplatesTab from '@/components/dashboard/tabs/templates-tab';
import AffiliateTab from '@/components/dashboard/tabs/affiliate-tab';
import BillingTab from '@/components/dashboard/tabs/billing-tab';
import PayoutModal from '@/components/dashboard/payout-modal';

type DashboardTab = 'projects' | 'templates' | 'affiliate' | 'billing';

export default function UserDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Payout request modal states
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState(500);

  // Data fetching hook
  const {
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
    deleteProjectItem,
  } = useDashboardData();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyCode = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopiedCode(true);
    showToast('Promo code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this project and clean up its local cache?')) {
      return;
    }
    const ok = await deleteProjectItem(projectId);
    if (ok) {
      showToast('Project and media cache deleted successfully');
    }
  };

  if (!profile || !sub) {
    return (
      <div className="min-h-screen bg-bg-base text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <p className="text-zinc-500 text-xs font-medium">Loading Creator Studio...</p>
        </div>
      </div>
    );
  }

  // Creator Production Metrics
  const totalProjectsCount = projects.length;
  const completedProjectsCount = projects.filter(
    (p) =>
      p.finalVideoPath ||
      (p.scenes && p.scenes.length > 0 && p.scenes.every((s) => s.status === 'IMAGE_READY'))
  ).length;
  const totalDurationMs = projects.reduce((acc, p) => acc + (p.totalDurationMs || 0), 0);
  const totalMinutesProduced = (totalDurationMs / (1000 * 60)).toFixed(1);

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-8 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modular Header */}
        <DashboardHeader
          profile={profile}
          settings={settings}
          isLoggedIn={isLoggedIn}
          isLiveSupabase={isLiveSupabase}
          isLoading={isLoading}
          onRefresh={refreshData}
        />

        {/* 4 Creator Production Milestone Cards */}
        <MetricCards
          profile={profile}
          totalProjectsCount={totalProjectsCount}
          completedProjectsCount={completedProjectsCount}
          totalMinutesProduced={totalMinutesProduced}
          storageInfo={storageInfo}
          onNavigateTab={setActiveTab}
        />

        {/* 1-Click Creative Quick-Launchpad */}
        <QuickLaunchSection />

        {/* Tab Navigation Bar */}
        <div className="border-b border-zinc-800 flex items-center gap-2 sm:gap-6 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-3 pt-1 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'projects'
                ? 'border-white text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderKanban size={15} />
            <span>My Projects & Library</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
              {projects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 pt-1 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'templates'
                ? 'border-white text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette size={15} />
            <span>Visual Styles & Templates</span>
          </button>

          <button
            onClick={() => setActiveTab('affiliate')}
            className={`pb-3 pt-1 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'affiliate'
                ? 'border-white text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Share2 size={15} />
            <span>Affiliate & Earnings</span>
            {profile.referralPendingBDT >= 100 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ৳{profile.referralPendingBDT} Available
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3 pt-1 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'billing'
                ? 'border-white text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CreditCard size={15} />
            <span>Billing & bKash Orders</span>
            {submissions.some((s) => s.status === 'PENDING') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* ───────────── ACTIVE TAB CONTENT ───────────── */}
        {activeTab === 'projects' && (
          <ProjectsTab
            projects={projects}
            thumbnails={thumbnails}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            deletingId={deletingId}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesTab stylePresets={stylePresets} />
        )}

        {activeTab === 'affiliate' && (
          <AffiliateTab
            profile={profile}
            copiedCode={copiedCode}
            onCopyCode={handleCopyCode}
            onRequestPayoutClick={() => {
              setPayoutModalOpen(true);
            }}
          />
        )}

        {activeTab === 'billing' && (
          <BillingTab
            profile={profile}
            sub={sub}
            submissions={submissions}
            settings={settings}
            storageInfo={storageInfo}
          />
        )}
      </div>

      {/* Modular Payout Withdrawal Modal */}
      <PayoutModal
        profile={profile}
        isOpen={payoutModalOpen}
        onClose={() => setPayoutModalOpen(false)}
        pendingBDT={profile.referralPendingBDT}
        payoutMethod={payoutMethod}
        setPayoutMethod={setPayoutMethod}
        payoutAccount={payoutAccount}
        setPayoutAccount={setPayoutAccount}
        payoutAmount={payoutAmount}
        setPayoutAmount={setPayoutAmount}
        setPayoutModalOpen={setPayoutModalOpen}
        refreshData={refreshData}
        isLiveSupabase={isLiveSupabase}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
