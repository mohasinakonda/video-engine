import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mainLanguage } from '@/lib/youtube/discover/queries';
import { briefFromThesis, briefSchema, emptyBrief, type VideoBrief } from '@/lib/youtube/create/brief';
import { interpretBrief } from '@/lib/youtube/create/ai/brief-interpreter';
import { statusAfterSaving } from '@/lib/youtube/create/project-state';
import { updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';
import type { VideoProject } from '@/lib/youtube/create/types';
import { UserFacingError } from '@/lib/youtube/errors';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Context = { params: { id: string } };

/** The brief to start from: the saved one, or one built from the opportunity or the title. */
function baseBrief(project: VideoProject, language?: VideoBrief['language']): VideoBrief {
  const saved = briefSchema.safeParse(project.brief);
  if (saved.success) return language ? { ...saved.data, language } : saved.data;
  const lang = language ?? mainLanguage([project.thesis?.topic ?? project.title]);
  return project.thesis ? briefFromThesis(project.thesis, lang) : emptyBrief(project.title, lang);
}

const generateSchema = z.object({
  notes: z.string().trim().max(1500).optional(),
  language: z.enum(['English', 'Bangla']).optional(),
});

/**
 * POST /api/create/projects/:id/brief — the AI fills the empty parts of the brief (streamed;
 * credits charged up front, refunded if nothing usable comes back). Saved as the project's brief.
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
    return projectErrorResponse(err, 'brief');
  }
  const nextStatus = statusAfterSaving(project.status, 'brief');
  if (!nextStatus) return NextResponse.json({ error: 'This project’s brief can’t be changed any more.', code: 'transition' }, { status: 409 });

  return streamAnalysis<'connect' | 'brief' | 'done'>({
    userId,
    feature: 'create',
    needsYouTube: false,
    label: 'create/brief',
    cost: (settings) => settings.create.briefCreditCost,
    run: async ({ settings, onStage }) => {
      onStage('brief');
      const filled = await interpretBrief(baseBrief(project, parsed.data.language), { notes: parsed.data.notes, models: settings.textModels });
      if (!filled) throw new UserFacingError('The AI couldn’t write this brief right now. Your credits were returned; you can fill it in yourself or try again.');
      const updated = await updateProject(userId, project, { brief: filled, status: nextStatus, lastError: null });
      return { project: updated };
    },
  });
}

/** PUT /api/create/projects/:id/brief — save the user's edits (free). */
export async function PUT(req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;

  const parsed = briefSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `${issue?.path.join('.') || 'brief'}: ${issue?.message || 'invalid'}` }, { status: 400 });
  }

  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    const nextStatus = statusAfterSaving(project.status, 'brief');
    if (!nextStatus) return NextResponse.json({ error: 'This project’s brief can’t be changed any more.', code: 'transition' }, { status: 409 });
    const brief: VideoBrief = { ...parsed.data, updatedAt: new Date().toISOString() };
    return NextResponse.json({ project: await updateProject(auth.user.id, project, { brief, status: nextStatus, lastError: null }) });
  } catch (err) {
    return projectErrorResponse(err, 'brief save');
  }
}
