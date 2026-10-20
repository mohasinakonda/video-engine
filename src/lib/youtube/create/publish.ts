/**
 * Linking a published video to its project (docs/create-plan.md §10.1). Pure: parsing links,
 * ranking the channel's recent uploads against the project, and reading a video's state.
 * The app suggests; the creator confirms.
 */
import { packagingSchema } from './packaging';
import type { VideoProject } from './types';

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** A video id from a bare id or any common YouTube link (watch, youtu.be, shorts, live, embed). */
export function parseVideoId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export type Privacy = 'public' | 'unlisted' | 'private';

/** One of the channel's recent uploads, as YouTube reports it to the owner. */
export interface Upload {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  /** When it went (or goes) live: the schedule time for a scheduled video. */
  publishedAt: string;
  privacy: Privacy;
  /** Set for a scheduled video that isn't public yet. */
  scheduledFor: string | null;
}

export interface Candidate extends Upload {
  /** 0–1: how likely this is the project's video. */
  score: number;
}

/** Measurement starts only once the video is public. */
export const linkStatusFor = (u: Pick<Upload, 'privacy'>): 'tracking' | 'waiting_public' => (u.privacy === 'public' ? 'tracking' : 'waiting_public');

/** Letters and digits of any script, including Bangla vowel signs. */
const NON_WORD = new RegExp('[^\\p{L}\\p{M}\\p{N}\\s]', 'gu');

const stems = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(NON_WORD, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.slice(0, 5))
  );

/** Share of the shorter title's words found in the other (0–1). Survives small last-minute edits. */
export function titleSimilarity(a: string, b: string): number {
  const sa = stems(a);
  const sb = stems(b);
  if (!sa.size || !sb.size) return 0;
  const [small, large] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  let hits = 0;
  small.forEach((w) => large.has(w) && hits++);
  return hits / small.size;
}

/** The titles a project's video might go out under: the chosen one first, then the others and the project's own. */
export function projectTitles(project: Pick<VideoProject, 'title' | 'packaging'>): string[] {
  const p = packagingSchema.safeParse(project.packaging);
  if (!p.success) return [project.title];
  const chosen = p.data.selectedTitle !== null ? [p.data.titles[p.data.selectedTitle].title] : [];
  return Array.from(new Set([...chosen, ...p.data.titles.map((t) => t.title), project.title]));
}

/** Below this a video is listed but not suggested. */
export const SUGGEST_AT = 0.5;

/**
 * Ranks uploads for a project: mostly title similarity (the chosen title counts most), plus
 * whether it went out after the project started. Already-linked videos are left out.
 */
export function rankCandidates(project: Pick<VideoProject, 'title' | 'packaging' | 'createdAt'>, uploads: Upload[], linked: Set<string>): { candidates: Candidate[]; suggestion: string | null } {
  const titles = projectTitles(project);
  const started = new Date(project.createdAt).getTime();
  const candidates = uploads
    .filter((u) => !linked.has(u.videoId))
    .map((u) => {
      const sim = Math.max(...titles.map((t, i) => titleSimilarity(t, u.title) * (i === 0 ? 1 : 0.9)));
      const after = Number.isFinite(started) && new Date(u.publishedAt).getTime() >= started - 86_400_000 ? 1 : 0;
      return { ...u, score: Math.round((sim * 0.8 + after * 0.2) * 100) / 100 };
    })
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
  const best = candidates[0];
  return { candidates, suggestion: best && best.score >= SUGGEST_AT ? best.videoId : null };
}

/**
 * For the library reminder: new uploads (not linked) that clearly match a project waiting to be
 * published. Each video and each project appears at most once.
 */
export function findReminders(
  projects: Pick<VideoProject, 'id' | 'title' | 'packaging' | 'createdAt'>[],
  uploads: Upload[],
  linked: Set<string>,
  threshold = 0.6
): { projectId: string; projectTitle: string; video: Upload }[] {
  const pairs = projects.flatMap((p) => {
    const { candidates } = rankCandidates(p, uploads, linked);
    return candidates.filter((c) => c.score >= threshold).map((c) => ({ project: p, video: c }));
  });
  pairs.sort((a, b) => b.video.score - a.video.score);
  const usedProjects = new Set<string>();
  const usedVideos = new Set<string>();
  const out: { projectId: string; projectTitle: string; video: Upload }[] = [];
  for (const { project, video } of pairs) {
    if (usedProjects.has(project.id) || usedVideos.has(video.videoId)) continue;
    usedProjects.add(project.id);
    usedVideos.add(video.videoId);
    const { score: _score, ...upload } = video;
    out.push({ projectId: project.id, projectTitle: projectTitles(project)[0], video: upload });
  }
  return out;
}

/** Projects that can be linked to a published video. */
export const LINKABLE: VideoProject['status'][] = ['PACKAGED', 'IN_PRODUCTION'];
