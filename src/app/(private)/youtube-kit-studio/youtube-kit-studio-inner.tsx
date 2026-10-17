'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Flame,
  ChevronLeft,
  Loader2,
  FolderOpen,
  Film,
  Download,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { getProject, saveProject, getAllProjects } from '@/lib/store';
import { YouTubeLaunchKit } from '@/components/export/youtube-launch-kit';
import type { ProjectManifest } from '@/types';

function createDefaultProject(): ProjectManifest {
  const newId = 'yt-studio-' + Date.now().toString(36);
  return {
    projectId: newId,
    title: 'Standalone YouTube Project',
    aspectRatio: '16:9',
    rawScript: '',
    voicePresetId: '',
    audioChunks: [],
    totalDurationMs: 0,
    scenes: [],
    updatedAt: Date.now(),
  };
}

export default function YouTubeKitStudioInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const urlProjectId = searchParams.get('id') || searchParams.get('projectId') || '';

  const [project, setProject] = useState<ProjectManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [allProjects, setAllProjects] = useState<ProjectManifest[]>([]);

  // Load available projects and current project
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const projects = await getAllProjects();
      setAllProjects(projects);

      if (urlProjectId) {
        let p = await getProject(urlProjectId);
        if (!p) {
          // Retry briefly for any storage sync latency
          await new Promise((r) => setTimeout(r, 200));
          p = await getProject(urlProjectId);
        }
        if (p) {
          setProject(p);
          setLoading(false);
          return;
        }
      }

      // If no project specified or not found, fall back to the most recent project or create default
      if (projects.length > 0) {
        const latest = projects[0];
        setProject(latest);
        startTransition(() => {
          router.replace(`/youtube-kit-studio?id=${latest.projectId}`);
        });
      } else {
        const fallback = createDefaultProject();
        await saveProject(fallback);
        setProject(fallback);
        setAllProjects([fallback]);
        startTransition(() => {
          router.replace(`/youtube-kit-studio?id=${fallback.projectId}`);
        });
      }
    } catch (err) {
      console.error('[YouTubeKitStudio] Error loading project:', err);
      showToast('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [urlProjectId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Project update handler passed to YouTubeLaunchKit
  const handleUpdateProject = useCallback(async (updated: ProjectManifest) => {
    setProject(updated);
    try {
      await saveProject(updated);
      setAllProjects((prev) =>
        prev.map((p) => (p.projectId === updated.projectId ? updated : p))
      );
    } catch (err) {
      console.error('[YouTubeKitStudio] Error saving project update:', err);
    }
  }, []);

  // Handle creating a new project
  const handleCreateNewProject = () => {
    const newProj = createDefaultProject();
    saveProject(newProj).then(() => {
      setAllProjects((prev) => [newProj, ...prev]);
      setProject(newProj);
      startTransition(() => {
        router.push(`/youtube-kit-studio?id=${newProj.projectId}`);
      });
    });
  }
  // Handle switching to a different project from the dropdown
  const handleSelectProject = (projectId: string) => {


    const selected = allProjects.find((p) => p.projectId === projectId);
    if (selected) {
      setProject(selected);
      startTransition(() => {
        router.push(`/youtube-kit-studio?id=${selected.projectId}`);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-zinc-400" />
          <p className="text-sm font-medium text-zinc-400">Loading YouTube Kit Studio...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <Flame size={24} />
          </div>
          <h2 className="text-lg font-bold text-white">No Project Found</h2>
          <p className="text-sm text-zinc-400">
            Could not find the requested project. You can choose an existing project or create a new packaging session.
          </p>
          <button
            type="button"
            onClick={() => handleSelectProject('NEW_STANDALONE')}
            className="btn-primary text-sm px-4 py-2"
          >
            Create Standalone Packaging
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 flex flex-col">
      {/* ─── Studio Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-bg-border bg-bg-surface/80 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projects"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Back to Projects"
          >
            <ChevronLeft size={18} />
          </Link>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Flame size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide truncate">
                  YouTube Kit Studio
                </h1>
                <span className="text-2xs px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-mono font-medium border border-rose-500/30 shrink-0">
                  AI PACKAGING
                </span>
              </div>
              <p className="text-xxs text-zinc-400 truncate">
                Titles, thumbnails, description &amp; tags from your script
              </p>
            </div>
          </div>
        </div>

        {/* Project Selector & Cross-Studio Links */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={handleCreateNewProject} className="flex items-center bg-zinc-700/50 border border-zinc-700/50 px-2 py-1 rounded-lg gap-1.5 text-xs text-white transition-colors font-bold">
            <PlusCircle size={13} className="text-white shrink-0" />
            <span className="text-xs">New Standalone Kit</span>
          </button>
          {/* Project Switcher Dropdown */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs">
            <FolderOpen size={13} className="text-zinc-400 shrink-0" />
            <select
              aria-label="Active Project"
              value={project.projectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="bg-transparent text-zinc-200 font-medium text-xs focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[240px] truncate"
            >
              {allProjects.map((p) => (
                <option key={p.projectId} value={p.projectId} className="bg-zinc-900 text-zinc-200">
                  {p.title || 'Untitled Video'}
                </option>
              ))}

            </select>
          </div>

        </div>
      </header>

      {/* ─── Main YouTube Launch Kit Suite ───────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto animate-fade-in">
          <YouTubeLaunchKit
            project={project}
            onUpdateProject={handleUpdateProject}
            showToast={showToast}
          />
        </div>
      </main>
    </div>
  );
}
