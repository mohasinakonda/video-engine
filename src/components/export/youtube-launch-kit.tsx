'use client';

import React from 'react';
import type { ProjectManifest } from '@/types';
import {
  LaunchKitProvider,
  useLaunchKit,
  ScriptInputCard,
  ErrorBanner,
  EmptyState,
  ScriptIntelligenceCard,
  CompetitorResearchCard,
  FeedMockupCard,
  TitleLabCard,
  ThumbnailStudioCard,
  ChaptersCard,
  SeoDescriptionCard,
  TagsCard,
} from './launch-kit';

interface YouTubeLaunchKitProps {
  project: ProjectManifest;
  onUpdateProject: (updated: ProjectManifest) => void;
  showToast: (msg: string) => void;
}

function YouTubeLaunchKitContent() {
  const { packaging } = useLaunchKit();

  return (
    <div className="space-y-6">
      {/* 1. Voice Script Input & Director Focus Card */}
      <ScriptInputCard />

      {/* Error Alert Banner */}
      <ErrorBanner />

      {/* Empty State when no packaging generated */}
      <EmptyState />

      {/* 2. Flagship Dual-Column Packaging Studio */}
      {packaging && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): Strategic Intelligence & Packaging Controls */}
          <div className="lg:col-span-7 space-y-6 min-w-0">
            {/* A. Script Intelligence & Hook Retention Diagnostic */}
            <ScriptIntelligenceCard />

            {/* B. Viral Titles Laboratory */}
            <TitleLabCard />

            {/* C. Style-Consistent Thumbnail Studio */}
            <ThumbnailStudioCard />

            {/* D. Live Market Competitor Research */}
            <CompetitorResearchCard />

            {/* E. Automated Timestamps & Chapters */}
            <ChaptersCard />

            {/* F. Complete SEO Description */}
            <SeoDescriptionCard />

            {/* G. Tags & Hashtags Cloud */}
            <TagsCard />
          </div>

          {/* Right Column (5 cols, sticky): Live YouTube Simulator & Master Launch Pack */}
          <div className="lg:col-span-5 sticky top-6 space-y-6 min-w-0">
            <FeedMockupCard />
          </div>
        </div>
      )}
    </div>
  );
}

export function YouTubeLaunchKit({
  project,
  onUpdateProject,
  showToast,
}: YouTubeLaunchKitProps) {
  return (
    <LaunchKitProvider
      project={project}
      onUpdateProject={onUpdateProject}
      showToast={showToast}
    >
      <YouTubeLaunchKitContent />
    </LaunchKitProvider>
  );
}
