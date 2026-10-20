import { NextResponse } from 'next/server';
import { z } from 'zod';
import { saveLearningRecord } from '@/lib/youtube/create/learning';
import { checkpointStates, measureVideo } from '@/lib/youtube/create/measure';
import { THESIS_MIN_DAYS, classify } from '@/lib/youtube/create/outcome';
import { updateProject } from '@/lib/youtube/create/projects';
import { fetchVideoForLink, getLink, updateLinkFromVideo } from '@/lib/youtube/create/published-videos';
import { ownedProject, projectErrorResponse } from '@/lib/youtube/create/route-helpers';
import type { ProjectStatus, VideoProject } from '@/lib/youtube/create/types';
import { UserFacingError } from '@/lib/youtube/errors';
import { requireUser } from '@/lib/youtube/route-auth';
import { getChannelDoctorSettings } from '@/lib/youtube/settings';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Context = { params: { id: string } };

const MEASURABLE: ProjectStatus[] = ['PUBLISHED', 'ANALYZING', 'LEARNED'];

/** finish: the creator closes measuring early (allowed once a 7-day checkpoint exists). */
const bodySchema = z.object({ finish: z.boolean().optional() });

/**
 * POST /api/create/projects/:id/performance — measure the linked video at every checkpoint
 * that has data (streamed; credits charged up front, refunded on failure). Numbers are returned,
 * never stored; only the labels are saved as learning records from day 7.
 */
export async function POST(req: Request, { params }: Context) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  let project: VideoProject;
  let link: Awaited<ReturnType<typeof getLink>>;
  try {
    const found = await ownedProject(userId, params.id);
    if (found instanceof NextResponse) return found;
    project = found;
    if (!MEASURABLE.includes(project.status)) return NextResponse.json({ error: 'Link the published video first.', code: 'transition' }, { status: 409 });
    link = await getLink(userId, project.id);
    if (!link) return NextResponse.json({ error: 'Link the published video first.', code: 'not_linked' }, { status: 409 });
    if (link.status === 'unavailable') return NextResponse.json({ error: 'This video is no longer available on YouTube.', code: 'unavailable' }, { status: 409 });
  } catch (err) {
    return projectErrorResponse(err, 'performance');
  }

  // Nothing to measure yet: say when, without charging.
  const settings = await getChannelDoctorSettings();
  const states = checkpointStates(link.publishedAt, settings.create.checkpointDays, new Date());
  if (link.status === 'tracking' && !states.some((s) => s.ready)) {
    return NextResponse.json({ error: `The first numbers arrive on ${states[0]?.readyOn}. YouTube reports with a delay of a few days.`, code: 'too_early', checkpoints: states }, { status: 409 });
  }
  const linked = link;

  return streamAnalysis<'connect' | 'measure' | 'done'>({
    userId,
    feature: 'create',
    label: 'create/performance',
    cost: (s) => s.create.performanceCreditCost,
    run: async ({ token, settings, onStage }) => {
      onStage('measure');
      const video = await fetchVideoForLink(token.accessToken, linked.youtubeVideoId);
      if (!video || video.channelId !== token.connection.channelId) throw new UserFacingError('This video is no longer available on your channel. Your credits were returned.');
      const link = await updateLinkFromVideo(userId, linked, video);
      if (link.status === 'waiting_public') throw new UserFacingError('Tracking starts when the video goes public. Your credits were returned.');
      if (!checkpointStates(link.publishedAt, settings.create.checkpointDays, new Date()).some((s) => s.ready)) {
        throw new UserFacingError('The first numbers aren’t in yet. Your credits were returned.');
      }

      const result = await measureVideo({
        accessToken: token.accessToken,
        channelId: token.connection.channelId,
        reportingJobId: token.reportingJobId,
        reportingStartedAt: token.connection.reportingStartedAt,
        videoId: link.youtubeVideoId,
        publishedAt: link.publishedAt,
        checkpoints: settings.create.checkpointDays,
      });
      const outcomes = result.measurements.map((m) => classify(m, project.thesis));

      // Labels only, from day 7: earlier checkpoints are too noisy to learn from.
      for (let i = 0; i < outcomes.length; i++) {
        if (outcomes[i].days >= THESIS_MIN_DAYS) await saveLearningRecord(userId, link.id, project, outcomes[i], result.measurements[i].baselineSample);
      }

      // PUBLISHED → ANALYZING on the first measurement; LEARNED once every checkpoint is in,
      // or when the creator closes it after day 7.
      const allDone = result.checkpoints.every((c) => c.ready);
      const learned = allDone || (parsed.data.finish === true && outcomes.some((o) => o.days >= THESIS_MIN_DAYS));
      let current = project;
      if (current.status === 'PUBLISHED') current = await updateProject(userId, current, { status: 'ANALYZING', lastError: null });
      if (learned && current.status === 'ANALYZING') current = await updateProject(userId, current, { status: 'LEARNED' });

      return { project: current, video, ...result, outcomes };
    },
  });
}
