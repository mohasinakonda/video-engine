'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Clock,
  Mic2,
  Trash2,
  ChevronRight,
  Sparkles,
  Film,
  Images,
  Video,
  LogOut,
  User,
  Zap,
} from 'lucide-react';
import { getAllProjects, deleteProject } from '@/lib/store';
import { signOutUser } from '@/lib/supabase-service';
import { useAuth } from '@/contexts/auth-context';
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

interface UserDashboardViewProps {
  user?: {
    id?: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  } | null;
}

export default function UserDashboardView({ user }: UserDashboardViewProps) {
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

  async function handleSignOut() {
    await signOutUser();
    router.refresh();
  }

  const completedChunks = (p: ProjectManifest) =>
    p.audioChunks.filter((c) => c.status === 'COMPLETED').length;

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Creator';

  const { subscription: sub } = useAuth();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-base">
      {/* Header */}
        <header className="px-8 py-5 border-b border-bg-border bg-bg-surface/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Studio Projects</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Logged in as <strong className="text-zinc-200">{displayName}</strong> {user?.email && `(${user.email})`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {sub && (
                <Link
                  href="/pricing"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors shadow-sm group"
                  title="View Credits & Usage Summary"
                >
                  <Zap size={14} className="text-amber-400 fill-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-white">{sub.creditsRemaining} Credits</span>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {sub.tier}
                  </span>
                </Link>
              )}
              <Link href="/project/new" className="btn-primary">
                <PlusCircle size={15} />
                New Project
              </Link>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-700/60 transition-colors"
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>
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
              <p className="text-zinc-400 text-sm text-center max-w-sm mb-6 leading-relaxed">
                Create your first project to start converting long-form scripts into professional video.
              </p>
              <Link href="/project/new" className="btn-primary">
                <PlusCircle size={15} />
                Create First Project
              </Link>
            </div>
          ) : (
            <div className="space-y-3 animate-slide-up">
              {projects.map((project) => {
                const done = completedChunks(project);
                const total = project.audioChunks.length;
                const audioProgress = total > 0 ? Math.round((done / total) * 100) : 0;

                const sceneCount = project.scenes?.length ?? 0;
                const imagesReady =
                  project.scenes?.filter((s) => s.status === 'IMAGE_READY' || s.status === 'MOTION_READY').length ?? 0;

                return (
                  <div
                    key={project.projectId}
                    onClick={() => router.push(`/project/new?id=${project.projectId}`)}
                    className="group card p-5 hover:border-zinc-700/80 cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-sm">
                          <Film size={18} className="text-zinc-300" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white group-hover:text-zinc-200 transition-colors truncate">
                            {project.title || 'Untitled Project'}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 flex-wrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock size={12} className="text-zinc-500" />
                              {formatDuration(project.totalDurationMs)}
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Mic2 size={12} className="text-zinc-500" />
                              {total} parts
                            </span>
                            {sceneCount > 0 && (
                              <>
                                <span className="text-zinc-600">·</span>
                                <span className="flex items-center gap-1 font-mono text-zinc-300">
                                  <Images size={12} className="text-zinc-500" />
                                  {imagesReady}/{sceneCount} scenes
                                </span>
                              </>
                            )}
                            <span className="text-zinc-600">·</span>
                            <span className="font-mono text-zinc-500">{timeAgo(project.updatedAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: status badges + actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-mono font-semibold">
                            {audioProgress === 100 ? (
                              <span className="text-emerald-400 font-bold">Audio Ready</span>
                            ) : audioProgress > 0 ? (
                              <span className="text-amber-400">{audioProgress}% Audio</span>
                            ) : (
                              <span className="text-zinc-500">Draft</span>
                            )}
                          </div>
                          {total > 0 && (
                            <div className="w-20 bg-zinc-800 rounded-full h-1 mt-1 overflow-hidden">
                              <div
                                className="bg-white h-full transition-all duration-300"
                                style={{ width: `${audioProgress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {audioProgress === 100 && (
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
    </div>
  );
}
