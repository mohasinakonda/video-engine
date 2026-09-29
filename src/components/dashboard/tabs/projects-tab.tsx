'use client';

import React from 'react';
import Link from 'next/link';
import {
  Film,
  Search,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Sparkles,
  Zap,
  Download,
} from 'lucide-react';
import type { ProjectManifest } from '@/types';

interface ProjectsTabProps {
  projects: ProjectManifest[];
  thumbnails: Record<string, string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  deletingId: string | null;
  onDeleteProject: (e: React.MouseEvent, projectId: string) => void;
}

function formatDuration(ms: number): string {
  if (!ms) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(ts: number): string {
  if (!ts) return 'Recent';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProjectsTab({
  projects,
  thumbnails,
  searchQuery,
  onSearchChange,
  deletingId,
  onDeleteProject,
}: ProjectsTabProps) {
  const filteredProjects = projects.filter((p) =>
    (p.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Your Video Projects</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            All projects and generated scene images are saved securely in your browser's persistent IndexedDB storage.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
            <Film size={26} />
          </div>
          <div>
            <p className="text-base font-bold text-white">No Video Projects Found</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No project matches your search query. Try another keyword.'
                : 'You have not created any video projects yet. Start with an AI script or upload your own audio!'}
            </p>
          </div>
          <Link
            href="/project/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <PlusCircle size={15} />
            Start First Video Project
          </Link>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => {
            const totalScenes = p.scenes?.length || 0;
            const readyScenes =
              p.scenes?.filter((s) => s.status === 'IMAGE_READY' || s.imageUrl).length || 0;
            const percentReady = totalScenes > 0 ? Math.round((readyScenes / totalScenes) * 100) : 0;
            const isFullyReady = totalScenes > 0 && readyScenes === totalScenes;
            const isPartiallyReady = readyScenes > 0 && readyScenes < totalScenes;
            const thumbUrl = thumbnails[p.projectId];
            const remainingScenes = totalScenes - readyScenes;

            return (
              <div
                key={p.projectId}
                className="rounded-2xl bg-zinc-900 border border-zinc-800/80 overflow-hidden hover:border-zinc-700 transition-all flex flex-col group shadow-sm"
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-video bg-zinc-950 overflow-hidden flex items-center justify-center">
                  {thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-600">
                      <Film size={24} />
                      <span className="text-[10px]">No Thumbnail</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-semibold text-zinc-300 border border-white/10">
                      {p.exportSettings?.aspectRatio || '16:9'}
                    </span>
                    {p.totalDurationMs && p.totalDurationMs > 0 ? (
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-semibold text-zinc-300 border border-white/10">
                        {formatDuration(p.totalDurationMs)}
                      </span>
                    ) : null}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => onDeleteProject(e, p.projectId)}
                    disabled={deletingId === p.projectId}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 hover:bg-rose-500 text-zinc-400 hover:text-white transition-colors border border-white/10"
                    title="Delete Project & Free Disk Cache"
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Status Overlay Badge */}
                  <div className="absolute bottom-2.5 left-2.5">
                    {isFullyReady ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/90 text-zinc-950 shadow-md">
                        <CheckCircle2 size={11} />
                        Ready to Export ({readyScenes}/{totalScenes})
                      </span>
                    ) : isPartiallyReady ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-400 text-zinc-950 shadow-md animate-pulse">
                        <Sparkles size={11} />
                        Partial ({readyScenes}/{totalScenes} Ready)
                      </span>
                    ) : totalScenes > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {totalScenes} Scenes Queued
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Script Draft
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>{timeAgo(p.updatedAt)}</span>
                      {totalScenes > 0 && (
                        <span className="font-mono text-zinc-400">{percentReady}% Complete</span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-white line-clamp-1 mt-1 group-hover:text-amber-300 transition-colors">
                      {p.title || 'Untitled Video Project'}
                    </h3>
                    {p.rawScript && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {p.rawScript}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar for Partial Scenes */}
                  {totalScenes > 0 && (
                    <div className="space-y-1">
                      <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFullyReady ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${percentReady}%` }}
                        />
                      </div>
                      {isPartiallyReady && (
                        <p className="text-[10px] text-amber-400/90 font-medium">
                          ⚡ {remainingScenes} scenes waiting for generation
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                    {isPartiallyReady ? (
                      /* Resilient Midway Resume Button */
                      <Link
                        href={`/project/${p.projectId}/storyboard?autoGenerate=true`}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Zap size={14} className="fill-zinc-950" />
                        <span>Resume Generation ({remainingScenes} left)</span>
                      </Link>
                    ) : isFullyReady ? (
                      <>
                        <Link
                          href={`/project/${p.projectId}/storyboard`}
                          className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs text-center transition-colors"
                        >
                          View Scenes
                        </Link>
                        <Link
                          href={`/export?projectId=${p.projectId}`}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <Download size={13} />
                          <span>Export MP4</span>
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/project/new?id=${p.projectId}`}
                        className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs text-center transition-colors"
                      >
                        Open Studio & Storyboard &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
