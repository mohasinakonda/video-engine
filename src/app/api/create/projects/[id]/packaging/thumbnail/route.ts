import { NextResponse } from 'next/server';
import { z } from 'zod';
import { packagingSchema, thumbnailConceptSchema, type VideoPackaging } from '@/lib/youtube/create/packaging';
import { updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';

type Context = { params: { id: string } };

const linkSchema = z.object({
  index: z.number().int().min(0).max(5),
  /** Guards against the list having changed since the page loaded. */
  mainSubject: z.string().max(200),
  imageId: thumbnailConceptSchema.shape.imageId.nullable(),
  canvaDesignId: thumbnailConceptSchema.shape.canvaDesignId.nullable(),
});

/**
 * PATCH /api/create/projects/:id/packaging/thumbnail — links a thumbnail idea to its image
 * (kept in the browser) and its Canva design. Only ids are stored; nothing else changes, so the
 * project's status and review state stay as they are.
 */
export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;

  const parsed = linkSchema.partial({ imageId: true, canvaDesignId: true }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { index, mainSubject, imageId, canvaDesignId } = parsed.data;

  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    const saved = packagingSchema.safeParse(project.packaging);
    const concept = saved.success ? saved.data.thumbnails[index] : undefined;
    if (!saved.success || !concept || concept.mainSubject !== mainSubject) {
      return NextResponse.json({ error: 'This thumbnail idea changed. Reload the page and try again.', code: 'stale' }, { status: 409 });
    }
    const next = { ...concept };
    if (imageId !== undefined) {
      if (imageId === null) delete next.imageId;
      else next.imageId = imageId;
    }
    if (canvaDesignId !== undefined) {
      if (canvaDesignId === null) delete next.canvaDesignId;
      else next.canvaDesignId = canvaDesignId;
    }
    const packaging: VideoPackaging = { ...saved.data, thumbnails: saved.data.thumbnails.map((t, i) => (i === index ? next : t)) };
    return NextResponse.json({ project: await updateProject(auth.user.id, project, { packaging }) });
  } catch (err) {
    return projectErrorResponse(err, 'thumbnail link');
  }
}
