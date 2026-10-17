'use client';

import React, { useState } from 'react';
import type { ProjectManifest } from '@/types';
import {
  LaunchKitProvider,
  useLaunchKit,
  ScriptInputCard,
  ErrorBanner,
  EmptyState,
  CompetitorResearchCard,
  FeedMockupCard,
  TitleLabCard,
  ThumbnailStudioCard,
  SeoDescriptionCard,
  TagsCard,

} from './launch-kit';

interface YouTubeLaunchKitProps {
  project: ProjectManifest;
  onUpdateProject: (updated: ProjectManifest) => void;
  showToast: (msg: string) => void;
}

type KitTab = 'titles' | 'thumbnails' | 'research' | 'description';

const KIT_TABS: { id: KitTab; label: string }[] = [
  { id: 'titles', label: 'Titles' },
  { id: 'thumbnails', label: 'Thumbnails' },
  { id: 'research', label: 'Research' },
  { id: 'description', label: 'Description & Tags' },
];

function YouTubeLaunchKitContent() {
  const { packaging } = useLaunchKit();
  const [tab, setTab] = useState<KitTab>('titles');

  return (
    <div className="space-y-6">
      {/* 1. Voice Script Input (collapses to a summary once a kit exists) */}
      <ScriptInputCard />

      {/* Error Alert Banner */}
      <ErrorBanner />

      {/* Empty State when no packaging generated */}
      <EmptyState />

      {/* 2. Packaging Studio */}
      {packaging && (
        <div >


          {/* Section tabs */}
          <div
            role="tablist"
            aria-label="Launch kit sections"
            className="sticky top-0 z-10 flex items-center gap-1 border-b border-bg-border bg-bg-base "
          >
            {KIT_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.id
                  ? 'border-white text-white font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-5">
            {/* Left (7 cols): the active section */}
            <div className="lg:col-span-7 space-y-6 min-w-0">
              {tab === 'titles' && <TitleLabCard />}
              {tab === 'thumbnails' && <ThumbnailStudioCard />}
              {tab === 'research' && <CompetitorResearchCard />}
              {tab === 'description' && (
                <>
                  <SeoDescriptionCard />
                  <TagsCard />
                </>
              )}
            </div>

            {/* Right (5 cols, sticky): live YouTube preview + launch pack */}
            <div className="lg:col-span-5 sticky top-20 space-y-6 min-w-0">
              <FeedMockupCard />
            </div>
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
