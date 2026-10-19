import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteProject, titleSchema, updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';

type Context = { params: { id: string } };

/** GET /api/create/projects/:id */
export async function GET(_req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    const project = await ownedProject(auth.user.id, params.id);
    return project instanceof NextResponse ? project : NextResponse.json({ project });
  } catch (err) {
    return projectErrorResponse(err, 'get');
  }
}

const patchSchema = z.object({ title: titleSchema });

/** PATCH /api/create/projects/:id — rename. Brief, script and packaging have their own routes. */
export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    return NextResponse.json({ project: await updateProject(auth.user.id, project, { title: parsed.data.title }) });
  } catch (err) {
    return projectErrorResponse(err, 'rename');
  }
}

/** DELETE /api/create/projects/:id — also removes its video link and learning records (cascade). */
export async function DELETE(_req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    await deleteProject(auth.user.id, project.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return projectErrorResponse(err, 'delete');
  }
}
