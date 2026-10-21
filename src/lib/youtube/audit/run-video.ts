/**
 * The full video audit pipeline (docs/audit-plan.md §2), shared by the video and compare routes:
 * fetch, rules, thumbnail, viewer themes and (optionally) the verdict and lessons.
 */
import { describeThumbnail, isAllowedThumbnailUrl, type ThumbnailFindings } from '../analysis/thumbnails';
import { UserFacingError } from '../errors';
import type { ChannelDoctorSettings } from '../settings';
import { viewerThemes, type ViewerThemes } from './ai/comments';
import { writeLessons } from './ai/lessons';
import { fetchAuditVideo, fetchChannelVideos, fetchCommentTexts } from './fetch';
import { detectReportLanguage, type ReportLanguage } from './language';
import { thumbnailFindings } from './thumbnail-audit';
import { auditVideo, sortFindings, type VideoAuditResult } from './video-audit';

export type AuditStage = 'video' | 'channel' | 'analyze' | 'thumbnail' | 'comments' | 'lessons';

export interface VideoAuditOutput extends VideoAuditResult {
  video: {
    id: string;
    title: string;
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    publishedAt: string;
    durationSec: number | null;
    views: number | null;
  };
  isOwn: boolean;
  thumbnail: ThumbnailFindings | null;
  viewers: ViewerThemes | null;
  verdict: string;
  lessons: string[];
  /** The title as a reusable shape, and a starting title for the creator's own video (AI; null without). */
  titleTemplate: string | null;
  myVersion: string | null;
  /** The language the written parts are in. */
  language: ReportLanguage;
}

export async function runVideoAudit(options: {
  accessToken: string;
  myChannelId: string;
  videoId: string;
  settings: ChannelDoctorSettings;
  /** Defaults to the language the video's channel works in. */
  language?: ReportLanguage;
  /** False when the caller writes its own conclusions (compare mode). */
  withLessons?: boolean;
  onStage?: (stage: AuditStage) => void;
}): Promise<VideoAuditOutput> {
  const { accessToken, settings } = options;
  const stage = options.onStage ?? (() => undefined);

  stage('video');
  const video = await fetchAuditVideo(accessToken, options.videoId);
  if (!video) throw new UserFacingError('YouTube didn’t return this video. It may be private, deleted or age-restricted. Your credits were returned.');
  if (video.liveOrUpcoming) throw new UserFacingError('This is a live stream or an upcoming premiere, so there’s nothing final to analyze yet. Your credits were returned.');

  stage('channel');
  const channelVideos = await fetchChannelVideos(accessToken, video.channelId, 50);
  const language =
    options.language ?? detectReportLanguage([video.title, video.description.slice(0, 500), ...channelVideos.slice(0, 20).map((v) => v.title)], [video.audioLanguage, video.metadataLanguage]);

  stage('analyze');
  const result = auditVideo(video, channelVideos, new Date());

  // Thumbnail: Shorts are mostly reached by swiping, not by choosing a thumbnail.
  stage('thumbnail');
  let thumbnail: ThumbnailFindings | null = null;
  if (result.format === 'short') result.limitations.push('Shorts are mostly found by swiping, so the thumbnail isn’t judged.');
  else if (isAllowedThumbnailUrl(video.thumbnailUrl)) {
    thumbnail = (await describeThumbnail(video.thumbnailUrl, settings.visionModels))?.findings ?? null;
    if (thumbnail) {
      result.findings.push(...thumbnailFindings(thumbnail, video.title));
      sortFindings(result.findings);
    } else result.limitations.push('The thumbnail couldn’t be read just now.');
  }

  // What viewers said (public comments, read with the server key; no names kept or sent).
  stage('comments');
  let viewers: ViewerThemes | null = null;
  const comments = await fetchCommentTexts(video.id, settings.audit.maxComments).catch(() => null);
  if (!comments?.available) result.limitations.push('Viewer comments aren’t read: comment reading isn’t set up.');
  else if (comments.disabled) result.limitations.push('Comments are turned off on this video.');
  else {
    viewers = await viewerThemes(comments.texts, { language, models: settings.textModels });
    if (!viewers) result.limitations.push('The comments couldn’t be grouped just now.');
  }

  let verdict = '';
  let lessons: string[] = [];
  let titleTemplate: string | null = null;
  let myVersion: string | null = null;
  if (options.withLessons !== false) {
    stage('lessons');
    ({ verdict, lessons, titleTemplate, myVersion } = await writeLessons({ label: result.performance.label, findings: result.findings, themes: viewers?.themes ?? [], language, models: settings.textModels, title: video.title, noDifference: (result.patterns?.neutral ?? []).map((p) => p.label) }));
  }

  return {
    video: {
      id: video.id,
      title: video.title,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      durationSec: video.durationSec,
      views: video.views,
    },
    // Your own video has deeper data (click rate, retention) in Channel Doctor's check-up.
    isOwn: video.channelId === options.myChannelId,
    ...result,
    thumbnail,
    viewers,
    verdict,
    lessons,
    titleTemplate,
    myVersion,
    language,
  };
}
