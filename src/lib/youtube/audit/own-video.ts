/**
 * Extras for the creator's own video check-up (docs/audit-plan.md §4): packaging findings,
 * and what viewers say.
 * Read on demand like the rest of the check-up; nothing is stored.
 */
import { mainLanguage } from '../discover/queries';
import type { ThumbnailFindings } from '../analysis/thumbnails';
import { viewerThemes, type ViewerThemes } from './ai/comments';
import { fetchAuditVideo, fetchCommentTexts } from './fetch';
import { thumbnailFindings } from './thumbnail-audit';
import { auditVideo, sortFindings, type AuditFinding } from './video-audit';

export interface OwnVideoExtras {
  packaging: AuditFinding[];
  viewers: ViewerThemes | null;
  limitations: string[];
}

export async function ownVideoExtras(options: {
  accessToken: string;
  videoId: string;
  title: string;
  thumbnail: ThumbnailFindings | null;
  maxComments: number;
  textModels: string[];
}): Promise<OwnVideoExtras> {
  const limitations: string[] = [];
  const language = mainLanguage([options.title]);

  const [video, comments] = await Promise.all([
    fetchAuditVideo(options.accessToken, options.videoId).catch(() => null),
    fetchCommentTexts(options.videoId, options.maxComments).catch(() => null),
  ]);

  // Title and description rules (performance is already in the check-up, from Analytics).
  const packaging = video ? auditVideo(video, [], new Date()).findings.filter((f) => f.area === 'title' || f.area === 'metadata') : [];
  if (options.thumbnail) packaging.push(...thumbnailFindings(options.thumbnail, options.title));
  sortFindings(packaging);

  let viewers: ViewerThemes | null = null;
  if (!comments?.available) limitations.push('Viewer comments aren’t read: comment reading isn’t set up.');
  else if (comments.disabled) limitations.push('Comments are turned off on this video.');
  else viewers = await viewerThemes(comments.texts, { language, models: options.textModels });

  return { packaging, viewers, limitations };
}
