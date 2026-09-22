'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  FolderOpen,
  Clock,
  Mic2,
  Trash2,
  ChevronRight,
  Sparkles,
  Film,
  Images,
  Video,
} from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { getAllProjects, deleteProject } from '@/lib/store';
import type { ProjectManifest } from '@/types';

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllProjects();
      setProjects(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleDelete(e: React.MouseEvent, projectId: string) {
    e.stopPropagation();
    e.preventDefault();
    setDeletingId(projectId);
    await deleteProject(projectId);
    await loadProjects();
    setDeletingId(null);
  }

  const completedChunks = (p: ProjectManifest) =>
    p.audioChunks.filter((c) => c.status === 'COMPLETED').length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Projects</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage your audio & video generation projects</p>
            </div>
            <Link href="/project/new" className="btn-primary">
              <PlusCircle size={15} />
              New Project
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="grid grid-cols-1 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card skeleton h-28 rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-sm">
                <Sparkles size={28} className="text-zinc-300" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No Projects Yet</h2>
              <p className="text-zinc-400 text-sm text-center max-w-sm mb-6">
                Create your first project to start converting long-form scripts into professional video.
              </p>
              <Link href="/project/new" className="btn-primary">
                <PlusCircle size={15} />
                Create First Project
              </Link>
            </div>
          ) : (
            <div className="space-y-3 animate-slide-up">
              {projects.map((project, idx) => {
                const done = completedChunks(project);
                const total = project.audioChunks.length;
                const audioProgress = total > 0 ? Math.round((done / total) * 100) : 0;

                // Phase 2 scene stats
                const totalScenes = project.scenes?.length ?? 0;
                const imagesReady = project.scenes?.filter(
                  (s) => ['IMAGE_READY', 'GENERATING_MOTION', 'MOTION_READY'].includes(s.status)
                ).length ?? 0;
                const motionReady = project.scenes?.filter((s) => s.status === 'MOTION_READY').length ?? 0;
                const sceneProgress = totalScenes > 0 ? Math.round((imagesReady / totalScenes) * 100) : 0;

                const hasStoryboard = totalScenes > 0;

                return (
                  <div
                    key={project.projectId}
                    onClick={() =>
                      router.push(
                        hasStoryboard
                          ? `/storyboard?id=${project.projectId}`
                          : `/project/new?id=${project.projectId}`
                      )
                    }
                    className="card hover:border-zinc-700 hover:bg-zinc-850 cursor-pointer
                               transition-colors duration-150 group animate-slide-up"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center flex-shrink-0">
                        <Mic2 size={18} className="text-zinc-300" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-white text-sm truncate group-hover:text-zinc-200 transition-colors">
                            {project.title}
                          </h3>
                          {total > 0 && (
                            <span className={`text-xs px-2.5 py-0.5 rounded-md border font-medium ${
                              audioProgress === 100
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                                : audioProgress > 0
                                ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                            }`}>
                              {audioProgress === 100 ? '✓ Audio' : audioProgress > 0 ? 'Audio…' : 'Not Started'}
                            </span>
                          )}
                          {hasStoryboard && (
                            <span className={`text-xs px-2.5 py-0.5 rounded-md border font-medium ${
                              sceneProgress === 100
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                                : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                            }`}>
                              {sceneProgress === 100 ? '✓ Scenes' : `Scenes ${sceneProgress}%`}
                            </span>
                          )}
                          {project.finalVideoPath && (
                            <span className="text-xs px-2.5 py-0.5 rounded-md border bg-zinc-800 text-zinc-200 border-zinc-700 font-medium">
                              ✓ MP4 Ready
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <FolderOpen size={11} />
                            {total} chunk{total !== 1 ? 's' : ''}
                          </span>
                          {project.totalDurationMs > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatDuration(project.totalDurationMs)}
                            </span>
                          )}
                          {hasStoryboard && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Images size={11} />
                              {imagesReady}/{totalScenes} images
                            </span>
                          )}
                          {motionReady > 0 && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Video size={11} />
                              {motionReady} clips
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {timeAgo(project.updatedAt)}
                          </span>
                        </div>

                        {/* Audio progress bar */}
                        {total > 0 && (
                          <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden w-full max-w-xs">
                            <div
                              className="h-full bg-white rounded-full transition-all duration-300"
                              style={{ width: `${audioProgress}%` }}
                            />
                          </div>
                        )}

                        {/* Scene progress bar */}
                        {hasStoryboard && (
                          <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden w-full max-w-xs">
                            <div
                              className="h-full bg-zinc-400 rounded-full transition-all duration-300"
                              style={{ width: `${sceneProgress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Storyboard quick action */}
                        {(hasStoryboard || audioProgress === 100) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/storyboard?id=${project.projectId}`);
                            }}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                       bg-zinc-800/90 border border-zinc-700 text-zinc-200
                                       hover:bg-zinc-700 hover:text-white
                                       transition-colors duration-150"
                            title="Open Storyboard (Phase 2)"
                          >
                            <Film size={12} />
                            Storyboard
                          </button>
                        )}

                        {/* Export quick action */}
                        {(imagesReady > 0 || audioProgress === 100) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/export?id=${project.projectId}`);
                            }}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                       bg-zinc-800/90 border border-zinc-700 text-zinc-200
                                       hover:bg-zinc-700 hover:text-white
                                       transition-colors duration-150"
                            title="Final Export (Phase 3)"
                          >
                            <Video size={12} />
                            Export
                          </button>
                        )}

                        <button
                          onClick={(e) => handleDelete(e, project.projectId)}
                          disabled={deletingId === project.projectId}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400
                                     hover:text-red-400 hover:bg-red-950/40 transition-colors duration-150
                                     opacity-0 group-hover:opacity-100"
                          title="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
