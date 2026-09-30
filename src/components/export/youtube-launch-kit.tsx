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

      {/* 2. Packaging Content Sections */}
      {packaging && (
        <div className="space-y-6">
          {/* A. Script Intelligence & Subject Summary */}
          <ScriptIntelligenceCard />

          {/* B. Live Market Competitor Inspiration */}
          <CompetitorResearchCard />

          {/* C. Dynamic Feed Mockup Preview (16:9 or 9:16 Shorts) */}
          <FeedMockupCard />

          {/* D. Viral Titles */}
          <TitleLabCard />

          {/* E. Style-Consistent Thumbnail Studio */}
          <ThumbnailStudioCard />

          {/* F. Automated Timestamps & Chapters */}
          <ChaptersCard />

          {/* G. Complete SEO Description */}
          <SeoDescriptionCard />

          {/* H. Tags & Hashtags Cloud */}
          <TagsCard />
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
