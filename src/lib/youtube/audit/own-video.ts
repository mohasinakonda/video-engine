/**
 * Extras for the creator's own video check-up (docs/audit-plan.md §4): packaging findings,
 * what viewers say, and, for a video made with Create, where in the script viewers left.
 * Read on demand like the rest of the check-up; nothing is stored.
 */
import { scriptForVideo } from '../create/published-videos';
import { scriptSchema, wordCount } from '../create/script';
import { mainLanguage } from '../discover/queries';
import type { ThumbnailFindings } from '../analysis/thumbnails';
import type { RetentionPoint } from '../types';
import { viewerThemes, type ViewerThemes } from './ai/comments';
import { fetchAuditVideo, fetchCommentTexts } from './fetch';
import { thumbnailFindings } from './thumbnail-audit';
import { scriptTimeline, type ScriptTimeline } from './timeline';
import { auditVideo, sortFindings, type AuditFinding } from './video-audit';

export interface OwnVideoExtras {
  packaging: AuditFinding[];
  viewers: ViewerThemes | null;
  script: { projectId: string; timeline: ScriptTimeline } | null;
  limitations: string[];
}

export async function ownVideoExtras(options: {
  userId: string;
  accessToken: string;
  videoId: string;
  title: string;
  durationSec: number | null;
  thumbnail: ThumbnailFindings | null;
  retention: RetentionPoint[] | null;
  maxComments: number;
  textModels: string[];
}): Promise<OwnVideoExtras> {
  const limitations: string[] = [];
  const language = mainLanguage([options.title]);

  const [video, comments, linked] = await Promise.all([
    fetchAuditVideo(options.accessToken, options.videoId).catch(() => null),
    fetchCommentTexts(options.videoId, options.maxComments).catch(() => null),
    scriptForVideo(options.userId, options.videoId).catch(() => null),
  ]);

  // Title and description rules (performance is already in the check-up, from Analytics).
  const packaging = video ? auditVideo(video, [], new Date()).findings.filter((f) => f.area === 'title' || f.area === 'metadata') : [];
  if (options.thumbnail) packaging.push(...thumbnailFindings(options.thumbnail, options.title));
  sortFindings(packaging);

  let viewers: ViewerThemes | null = null;
  if (!comments?.available) limitations.push('Viewer comments aren’t read: comment reading isn’t set up.');
  else if (comments.disabled) limitations.push('Comments are turned off on this video.');
  else viewers = await viewerThemes(comments.texts, { language, models: options.textModels });

  let script: OwnVideoExtras['script'] = null;
  const parsed = linked ? scriptSchema.safeParse(linked.script) : null;
  if (linked && parsed?.success && options.retention && options.durationSec) {
    const timeline = scriptTimeline(
      options.retention,
      options.durationSec,
      parsed.data.sections.map((s) => ({ id: s.id, heading: s.heading, words: wordCount(s.narration) }))
    );
    if (timeline) script = { projectId: linked.projectId, timeline };
  }

  return { packaging, viewers, script, limitations };
}
