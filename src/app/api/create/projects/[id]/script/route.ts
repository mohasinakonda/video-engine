import { NextResponse } from 'next/server';
import { z } from 'zod';
import { briefSchema, missingForScript, type VideoBrief } from '@/lib/youtube/create/brief';
import { bump, runCost } from '@/lib/youtube/create/bundle';
import { rewriteSection, writeScript } from '@/lib/youtube/create/ai/script-writer';
import { statusAfterSaving } from '@/lib/youtube/create/project-state';
import { updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';
import { AI_MAX_MINUTES, AI_MIN_MINUTES, defaultMinutes, scriptSchema, type VideoScript } from '@/lib/youtube/create/script';
import type { VideoProject } from '@/lib/youtube/create/types';
import { UserFacingError } from '@/lib/youtube/errors';
import { requireUser } from '@/lib/youtube/route-auth';
import { streamAnalysis } from '@/lib/youtube/stream-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Context = { params: { id: string } };

const generateSchema = z.object({
  targetMinutes: z.number().int().min(AI_MIN_MINUTES).max(AI_MAX_MINUTES).optional(),
  notes: z.string().trim().max(1500).optional(),
  /** Rewrite only this part (half price); otherwise the whole script is written. */
  sectionId: z.string().min(1).max(40).optional(),
});

/**
 * POST /api/create/projects/:id/script — the AI writes the script, or rewrites one part
 * (streamed; credits charged up front, refunded if nothing usable comes back).
 */
export async function POST(req: Request, { params }: Context) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const userId = auth.user.id;

  const parsed = generateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { sectionId, notes } = parsed.data;

  let project: VideoProject;
  try {
    const found = await ownedProject(userId, params.id);
    if (found instanceof NextResponse) return found;
    project = found;
  } catch (err) {
    return projectErrorResponse(err, 'script');
  }

  // Everything that can be refused is checked before any credit is charged.
  const nextStatus = statusAfterSaving(project.status, 'script');
  if (!nextStatus) return NextResponse.json({ error: 'This project’s script can’t be changed now.', code: 'transition' }, { status: 409 });
  const brief = briefSchema.safeParse(project.brief);
  if (!brief.success) return NextResponse.json({ error: 'Write the brief first.', code: 'brief_missing' }, { status: 409 });
  const missing = missingForScript(brief.data);
  if (missing.length) return NextResponse.json({ error: `Add to the brief first: ${missing.join(', ')}.`, code: 'brief_incomplete' }, { status: 409 });

  let current: VideoScript | null = null;
  if (sectionId) {
    const saved = scriptSchema.safeParse(project.script);
    if (!saved.success || !saved.data.sections.some((s) => s.id === sectionId)) {
      return NextResponse.json({ error: 'That part of the script wasn’t found. Reload the page.', code: 'section_missing' }, { status: 409 });
    }
    current = saved.data;
  }
  const targetMinutes = parsed.data.targetMinutes ?? defaultMinutes(brief.data.format);
  const usageKey = sectionId ? 'section' : 'script';

  return streamAnalysis<'connect' | 'script' | 'done'>({
    userId,
    feature: 'create',
    needsYouTube: false,
    label: sectionId ? 'create/script-section' : 'create/script',
    // Included in the video's price while the allowance lasts.
    cost: (settings) => runCost(project, settings.create, usageKey),
    run: async ({ settings, onStage }) => {
      onStage('script');
      const options = { notes, models: settings.textModels };
      const script = current && sectionId ? await rewriteSection(brief.data, current, sectionId, options) : await writeScript(brief.data, { ...options, targetMinutes });
      if (!script) throw new UserFacingError('The AI couldn’t write this right now. Your credits were returned; you can write it yourself or try again.');
      const updated = await updateProject(userId, project, { script, status: nextStatus, lastError: null, usage: bump(project, usageKey) });
      return { project: updated };
    },
  });
}

/** PUT /api/create/projects/:id/script — save the user's edits (free). Saving counts as reviewed against the current brief. */
export async function PUT(req: Request, { params }: Context) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;

  const parsed = scriptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `${issue?.path.join('.') || 'script'}: ${issue?.message || 'invalid'}` }, { status: 400 });
  }

  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    const nextStatus = statusAfterSaving(project.status, 'script');
    if (!nextStatus) return NextResponse.json({ error: 'This project’s script can’t be changed now.', code: 'transition' }, { status: 409 });
    const brief = briefSchema.safeParse(project.brief);
    if (!brief.success) return NextResponse.json({ error: 'Write the brief first.', code: 'brief_missing' }, { status: 409 });
    const script: VideoScript = {
      ...parsed.data,
      sections: parsed.data.sections.map((s) => ({ ...s, needsWriting: s.needsWriting && !s.narration.trim() })),
      briefUpdatedAt: (brief.data as VideoBrief).updatedAt,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ project: await updateProject(auth.user.id, project, { script, status: nextStatus, lastError: null }) });
  } catch (err) {
    return projectErrorResponse(err, 'script save');
  }
}
