import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getValidAccessToken } from '@/lib/youtube/connection-service';
import { updateProject } from '@/lib/youtube/create/projects';
import { LINKABLE, parseVideoId } from '@/lib/youtube/create/publish';
import { AlreadyLinkedError, createLink, deleteLink, fetchVideoForLink, getLink, linkedVideoIds, updateLinkFromVideo } from '@/lib/youtube/create/published-videos';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';

type Context = { params: { id: string } };

/**
 * GET /api/create/projects/:id/publish — the linked video, if any, with its current title and
 * privacy read live from YouTube (nothing about it is stored beyond the link).
 */
export async function GET(_req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    let link = await getLink(auth.user.id, project.id);
    if (!link) return NextResponse.json({ link: null, video: null });
    try {
      const { accessToken } = await getValidAccessToken(auth.user.id);
      const video = await fetchVideoForLink(accessToken, link.youtubeVideoId);
      if (video) link = await updateLinkFromVideo(auth.user.id, link, video);
      return NextResponse.json({ link, video });
    } catch {
      // YouTube unavailable or disconnected: the link still shows, without live details.
      return NextResponse.json({ link, video: null });
    }
  } catch (err) {
    return projectErrorResponse(err, 'publish read');
  }
}

const linkSchema = z.object({
  /** A video id from the suggestions, or any YouTube link pasted by the creator. */
  video: z.string().trim().min(1).max(300),
  method: z.enum(['suggested', 'picked', 'pasted']),
});

/**
 * POST /api/create/projects/:id/publish — link the creator's confirmed video. The server
 * re-checks with YouTube that the video is on the connected channel and not linked elsewhere.
 */
export async function POST(req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  const parsed = linkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const videoId = parseVideoId(parsed.data.video);
  if (!videoId) return NextResponse.json({ error: 'That doesn’t look like a YouTube video link.', code: 'bad_link' }, { status: 400 });
  const userId = auth.user.id;

  try {
    const project = await ownedProject(userId, params.id);
    if (project instanceof NextResponse) return project;
    if (!LINKABLE.includes(project.status)) {
      return NextResponse.json({ error: 'A video can be linked once the project is packaged, and only once.', code: 'transition' }, { status: 409 });
    }

    const { accessToken, connection } = await getValidAccessToken(userId);
    const video = await fetchVideoForLink(accessToken, videoId);
    if (!video || video.channelId !== connection.channelId) {
      return NextResponse.json({ error: 'That video isn’t on your connected channel.', code: 'not_owned' }, { status: 409 });
    }
    if ((await linkedVideoIds(userId)).has(videoId)) throw new AlreadyLinkedError();

    const link = await createLink(userId, { projectId: project.id, video, channelId: connection.channelId, method: parsed.data.method });
    try {
      const updated = await updateProject(userId, project, { status: 'PUBLISHED', lastError: null });
      return NextResponse.json({ project: updated, link, video });
    } catch (err) {
      // Keep the two in step: no link without a published project.
      await deleteLink(userId, project.id).catch(() => undefined);
      throw err;
    }
  } catch (err) {
    if (err instanceof AlreadyLinkedError) return NextResponse.json({ error: err.message, code: 'already_linked' }, { status: 409 });
    return projectErrorResponse(err, 'publish link');
  }
}

/** DELETE /api/create/projects/:id/publish — undo a link made by mistake (before measuring starts). */
export async function DELETE(_req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    if (project.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Only a video that isn’t being measured yet can be unlinked.', code: 'transition' }, { status: 409 });
    }
    const updated = await updateProject(auth.user.id, project, { status: 'PACKAGED' });
    await deleteLink(auth.user.id, project.id);
    return NextResponse.json({ project: updated });
  } catch (err) {
    return projectErrorResponse(err, 'publish unlink');
  }
}
