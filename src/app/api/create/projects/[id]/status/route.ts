import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * Status changes the user makes directly. Everything else (brief ready, script ready,
 * packaged) is set by the step that completes it.
 */
const bodySchema = z.object({ action: z.enum(['archive', 'unarchive']) });

/** POST /api/create/projects/:id/status */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    const target = parsed.data.action === 'archive' ? 'ARCHIVED' : project.archivedFrom;
    if (!target) return NextResponse.json({ error: 'This project can’t be restored.', code: 'transition' }, { status: 409 });
    return NextResponse.json({ project: await updateProject(auth.user.id, project, { status: target }) });
  } catch (err) {
    return projectErrorResponse(err, 'status');
  }
}
