import { NextResponse } from 'next/server';
import { z } from 'zod';
import { briefSchema } from '@/lib/youtube/create/brief';
import { bump, runCost } from '@/lib/youtube/create/bundle';
import { generatePackaging } from '@/lib/youtube/create/ai/packager';
import { isComplete, packagingSchema, statusAfterPackaging, type VideoPackaging } from '@/lib/youtube/create/packaging';
import { updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';
import { scriptSchema } from '@/lib/youtube/create/script';
import type { VideoProject } from '@/lib/youtube/create/types';
import { UserFacingError } from '@/lib/youtube/errors';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Context = { params: { id: string } };

const generateSchema = z.object({ notes: z.string().trim().max(1500).optional(), only: z.enum(['titles', 'thumbnails']).optional() });

const NOT_EDITABLE = 'Packaging can be made once the script is saved.';

/**
 * POST /api/create/projects/:id/packaging — the AI proposes titles, thumbnails and a description
 * (or, with `only`, new titles or new thumbnails alone)
 * (streamed; credits charged up front, refunded if nothing usable comes back). Chosen concepts
 * are kept; the status doesn't move until the user chooses and saves.
 */
export async function POST(req: Request, { params }: Context) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = generateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  let project: VideoProject;
  try {
    const found = await ownedProject(userId, params.id);
    if (found instanceof NextResponse) return found;
    project = found;
  } catch (err) {
    return projectErrorResponse(err, 'packaging');
  }

  // Everything that can be refused is checked before any credit is charged.
  if (!statusAfterPackaging(project.status, false)) return NextResponse.json({ error: NOT_EDITABLE, code: 'transition' }, { status: 409 });
  const brief = briefSchema.safeParse(project.brief);
  const script = scriptSchema.safeParse(project.script);
  if (!brief.success || !script.success) return NextResponse.json({ error: 'Save the brief and the script first.', code: 'script_missing' }, { status: 409 });
  const previous = packagingSchema.safeParse(project.packaging);

  return streamAnalysis<'connect' | 'packaging' | 'done'>({
    userId,
    feature: 'create',
    needsYouTube: false,
    label: 'create/packaging',
    // Included in the video's price while the allowance lasts.
    cost: (settings) => runCost(project, settings.create, 'packaging'),
    run: async ({ settings, onStage }) => {
      onStage('packaging');
      const packaging = await generatePackaging(brief.data, script.data, {
        notes: parsed.data.notes,
        models: settings.textModels,
        previous: previous.success ? previous.data : null,
        only: parsed.data.only,
      });
      if (!packaging) {
        const what = parsed.data.only === 'thumbnails' ? 'thumbnail ideas' : 'titles';
        throw new UserFacingError(`The AI couldn’t come up with usable ${what} right now. Your credits were returned; you can write your own or try again.`);
      }
      const updated = await updateProject(userId, project, { packaging, lastError: null, usage: bump(project, 'packaging') });
      return { project: updated };
    },
  });
}

/** PUT /api/create/projects/:id/packaging — save the user's choice and edits (free). */
export async function PUT(req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;

  const parsed = packagingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `${issue?.path.join('.') || 'packaging'}: ${issue?.message || 'invalid'}` }, { status: 400 });
  }

  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    const script = scriptSchema.safeParse(project.script);
    const nextStatus = statusAfterPackaging(project.status, isComplete(parsed.data));
    if (!nextStatus || !script.success) return NextResponse.json({ error: NOT_EDITABLE, code: 'transition' }, { status: 409 });
    // Saving counts as reviewed against the current script.
    const packaging: VideoPackaging = { ...parsed.data, scriptUpdatedAt: script.data.updatedAt, updatedAt: new Date().toISOString() };
    return NextResponse.json({ project: await updateProject(auth.user.id, project, { packaging, status: nextStatus, lastError: null }) });
  } catch (err) {
    return projectErrorResponse(err, 'packaging save');
  }
}
