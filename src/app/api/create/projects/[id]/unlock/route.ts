import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deductCreditsRemote, grantCreditsRemote } from '@/lib/supabase-service';
import { updateProject } from '@/lib/youtube/create/projects';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/create/projects/:id/unlock — pay the video's one price for a project made before
 * per-video pricing, so its AI runs are included from now on. Refunded if saving fails.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    if (project.unlockedAt) return NextResponse.json({ error: 'This video is already unlocked.', code: 'unlocked' }, { status: 409 });

    const cost = auth.settings.bundleCreditCost;
    if (cost > 0 && !(await deductCreditsRemote(auth.user.id, cost, createClient()))) {
      return NextResponse.json({ error: `Not enough credits. Unlocking costs ${cost} credits.`, code: 'credits' }, { status: 402 });
    }
    try {
      return NextResponse.json({ project: await updateProject(auth.user.id, project, { unlockedAt: new Date().toISOString() }), charged: cost });
    } catch (err) {
      if (cost > 0) await grantCreditsRemote(auth.user.id, cost).catch(() => false);
      throw err;
    }
  } catch (err) {
    return projectErrorResponse(err, 'unlock');
  }
}
