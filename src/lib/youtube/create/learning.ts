/**
 * Learning records (docs/create-plan.md §2.3): what was decided and how it turned out, as
 * bucketed labels only. No view counts, CTRs or curves; raw numbers are always fetched fresh.
 */
import { getServiceClient } from '../db';
import { briefSchema } from './brief';
import type { Outcome } from './outcome';
import { packagingSchema } from './packaging';
import type { LearningRow } from './track-record';
import type { VideoProject } from './types';

const TABLE = 'learning_records';

/** The labels describing what was made, taken from the project. */
export function decisionLabels(project: Pick<VideoProject, 'title' | 'thesis' | 'brief' | 'packaging'>) {
  const brief = briefSchema.safeParse(project.brief);
  const packaging = packagingSchema.safeParse(project.packaging);
  const chosen = packaging.success && packaging.data.selectedTitle !== null ? packaging.data.titles[packaging.data.selectedTitle] : null;
  return {
    topic_label: (project.thesis?.topic ?? (brief.success ? brief.data.topic : project.title)).slice(0, 120),
    content_format: brief.success ? brief.data.format : project.thesis?.recommendedFormat ?? null,
    title_mechanism: chosen?.mechanism ?? null,
    thumbnail_mechanism: null,
    gap_types: project.thesis?.gapTypes ?? [],
    opportunity_confidence: project.thesis?.confidence ?? null,
  };
}

/** Saves (or refreshes) one checkpoint's labels for a linked video. */
export async function saveLearningRecord(
  userId: string,
  publishedVideoId: string,
  project: Pick<VideoProject, 'title' | 'thesis' | 'brief' | 'packaging'>,
  outcome: Outcome,
  baselineSample: number
): Promise<void> {
  const { error } = await getServiceClient()
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        published_video_id: publishedVideoId,
        checkpoint_days: outcome.days,
        ...decisionLabels(project),
        views_vs_baseline: outcome.views,
        ctr_vs_baseline: outcome.ctr,
        retention_vs_baseline: outcome.retention,
        bottleneck: outcome.bottleneck,
        thesis_verdict: outcome.verdict,
        baseline_sample: baselineSample,
        confidence: outcome.confidence,
      },
      { onConflict: 'published_video_id,checkpoint_days' }
    );
  if (error) throw new Error(`Could not save the learning record (${error.code})`);
}

/** Every learning record of the user, with its project for linking back. Labels only. */
export async function loadLearningRows(userId: string): Promise<LearningRow[]> {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(
      'published_video_id, checkpoint_days, topic_label, content_format, title_mechanism, views_vs_baseline, bottleneck, thesis_verdict, published_videos!inner(project_id, video_projects!inner(title))'
    )
    .eq('user_id', userId);
  if (error) throw new Error(`Could not read learning records (${error.code})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => {
    const link = Array.isArray(r.published_videos) ? r.published_videos[0] : r.published_videos;
    const project = Array.isArray(link?.video_projects) ? link.video_projects[0] : link?.video_projects;
    return {
      publishedVideoId: r.published_video_id,
      projectId: link?.project_id ?? '',
      projectTitle: project?.title ?? '',
      checkpointDays: r.checkpoint_days,
      topicLabel: r.topic_label,
      contentFormat: r.content_format,
      titleMechanism: r.title_mechanism,
      views: r.views_vs_baseline,
      bottleneck: r.bottleneck,
      verdict: r.thesis_verdict,
    };
  });
}
