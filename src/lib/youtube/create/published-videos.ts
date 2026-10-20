/**
 * Project ↔ YouTube video links, and reading the creator's own uploads to find them.
 * Only the link (ids, publish time, how it was linked) is stored; titles and thumbnails are
 * read live from YouTube when shown.
 */
import { YOUTUBE_DATA_API } from '../config';
import { fetchUploadIds } from '../data-client';
import { getServiceClient } from '../db';
import { GoogleApiError, googleJson } from '../google-fetch';
import { linkStatusFor, type Privacy, type Upload } from './publish';

const TABLE = 'published_videos';

export interface PublishedLink {
  id: string;
  projectId: string;
  youtubeVideoId: string;
  channelId: string;
  publishedAt: string;
  linkMethod: 'suggested' | 'picked' | 'pasted';
  status: 'waiting_public' | 'tracking' | 'complete' | 'unavailable';
  createdAt: string;
}

/** The video is already linked to another project. */
export class AlreadyLinkedError extends Error {
  constructor() {
    super('This video is already linked to another project.');
  }
}

/** How many recent uploads are offered as matches. */
export const RECENT_UPLOADS = 15;

interface VideoItem {
  id: string;
  snippet?: { channelId?: string; title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> };
  status?: { privacyStatus?: string; publishAt?: string };
}

const VIDEO_FIELDS = 'items(id,snippet(channelId,title,publishedAt,thumbnails/medium/url),status(privacyStatus,publishAt))';

function toUpload(item: VideoItem): Upload & { channelId: string | null } {
  const privacy = (['public', 'unlisted', 'private'].includes(item.status?.privacyStatus ?? '') ? item.status?.privacyStatus : 'private') as Privacy;
  const scheduledFor = privacy !== 'public' && item.status?.publishAt ? item.status.publishAt : null;
  return {
    videoId: item.id,
    channelId: item.snippet?.channelId ?? null,
    title: item.snippet?.title ?? '',
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
    publishedAt: scheduledFor ?? item.snippet?.publishedAt ?? new Date().toISOString(),
    privacy,
    scheduledFor,
  };
}

async function fetchVideos(accessToken: string, ids: string[]): Promise<(Upload & { channelId: string | null })[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ part: 'snippet,status', id: ids.join(','), fields: VIDEO_FIELDS });
  const data = await googleJson<{ items?: VideoItem[] }>(`${YOUTUBE_DATA_API}/videos?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data.items ?? []).map(toUpload).sort((a, b) => (order.get(a.videoId) ?? 0) - (order.get(b.videoId) ?? 0));
}

/**
 * The channel's newest uploads, including private, unlisted and scheduled ones (the owner is
 * authorized). About 2 quota units: one uploads-playlist page and one videos.list, no search.
 */
export async function fetchRecentUploads(accessToken: string, channelId: string, max = RECENT_UPLOADS): Promise<Upload[]> {
  // Every channel's uploads playlist is its id with "UC" replaced by "UU".
  let ids: string[];
  try {
    ids = await fetchUploadIds(accessToken, `UU${channelId.slice(2)}`, max);
  } catch (err) {
    // A channel with no uploads has no uploads playlist yet.
    if (err instanceof GoogleApiError && err.kind === 'not_found') return [];
    throw err;
  }
  return (await fetchVideos(accessToken, ids)).filter((v) => v.channelId === channelId);
}

/** One video as the owner sees it, for re-checking before a link (1 unit). Null if YouTube doesn't return it. */
export async function fetchVideoForLink(accessToken: string, videoId: string): Promise<(Upload & { channelId: string | null }) | null> {
  return (await fetchVideos(accessToken, [videoId]))[0] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toLink = (r: any): PublishedLink => ({
  id: r.id,
  projectId: r.project_id,
  youtubeVideoId: r.youtube_video_id,
  channelId: r.channel_id,
  publishedAt: r.published_at,
  linkMethod: r.link_method,
  status: r.status,
  createdAt: r.created_at,
});

const COLUMNS = 'id, project_id, youtube_video_id, channel_id, published_at, link_method, status, created_at';

export async function getLink(userId: string, projectId: string): Promise<PublishedLink | null> {
  const { data, error } = await getServiceClient().from(TABLE).select(COLUMNS).eq('user_id', userId).eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data ? toLink(data) : null;
}

/** Video ids the user has already linked to a project. */
export async function linkedVideoIds(userId: string): Promise<Set<string>> {
  const { data, error } = await getServiceClient().from(TABLE).select('youtube_video_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { youtube_video_id: string }) => r.youtube_video_id));
}

export async function createLink(
  userId: string,
  input: { projectId: string; video: Upload; channelId: string; method: PublishedLink['linkMethod'] }
): Promise<PublishedLink> {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .insert({
      user_id: userId,
      project_id: input.projectId,
      youtube_video_id: input.video.videoId,
      channel_id: input.channelId,
      published_at: input.video.publishedAt,
      link_method: input.method,
      status: linkStatusFor(input.video),
    })
    .select(COLUMNS)
    .single();
  // Unique (user, video) or (project): linked elsewhere, or this project was linked in another tab.
  if (error?.code === '23505') throw new AlreadyLinkedError();
  if (error) throw error;
  return toLink(data);
}

export async function deleteLink(userId: string, projectId: string): Promise<void> {
  const { error } = await getServiceClient().from(TABLE).delete().eq('user_id', userId).eq('project_id', projectId);
  if (error) throw error;
}

/** Keeps the link's state in step with YouTube (a scheduled video going public). */
export async function updateLinkFromVideo(userId: string, link: PublishedLink, video: Upload): Promise<PublishedLink> {
  const status = link.status === 'complete' || link.status === 'unavailable' ? link.status : linkStatusFor(video);
  if (status === link.status && video.publishedAt === link.publishedAt) return link;
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ status, published_at: video.publishedAt })
    .eq('user_id', userId)
    .eq('id', link.id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toLink(data);
}

/** The Create script behind one of the user's videos, if it was made with Create and linked. */
export async function scriptForVideo(userId: string, videoId: string): Promise<{ projectId: string; script: unknown } | null> {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select('project_id, video_projects!inner(script)')
    .eq('user_id', userId)
    .eq('youtube_video_id', videoId)
    .maybeSingle();
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = (data as any).video_projects;
  return { projectId: data.project_id, script: (Array.isArray(project) ? project[0] : project)?.script ?? null };
}
