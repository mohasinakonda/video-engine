import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { deductCreditsRemote, grantCreditsRemote } from '@/lib/supabase-service';
import { createProject, listProjects, titleSchema } from '@/lib/youtube/create/projects';
import { projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';
import { opportunityInputSchema, toThesis } from '@/lib/youtube/create/thesis';

export const dynamic = 'force-dynamic';

/** GET /api/create/projects — the signed-in user's projects, newest first. */
export async function GET() {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    return NextResponse.json({ projects: await listProjects(auth.user.id) });
  } catch (err) {
    return projectErrorResponse(err, 'list');
  }
}

const createSchema = z.discriminatedUnion('origin', [
  z.object({ origin: z.literal('manual'), title: titleSchema }),
  z.object({ origin: z.literal('opportunity'), opportunity: opportunityInputSchema }),
]);

/**
 * POST /api/create/projects — start a project from scratch or from a Discover opportunity.
 * The video's one price is charged here, up front, and refunded if the project can't be made.
 * From an opportunity, only the thesis (scores and labels) is kept; competitor data is dropped.
 */
export async function POST(req: Request) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 });

  try {
    const input =
      parsed.data.origin === 'manual'
        ? { origin: 'manual' as const, title: parsed.data.title, thesis: null }
        : {
            origin: 'opportunity' as const,
            title: (parsed.data.opportunity.recommendedAngle || parsed.data.opportunity.topic).slice(0, 200),
            thesis: toThesis(parsed.data.opportunity),
          };
    const cost = auth.settings.bundleCreditCost;
    // The user's session client: the RPC checks the balance atomically.
    if (cost > 0 && !(await deductCreditsRemote(auth.user.id, cost, createClient()))) {
      return NextResponse.json({ error: `Not enough credits. Starting a video costs ${cost} credits.`, code: 'credits' }, { status: 402 });
    }
    try {
      const project = await createProject(auth.user.id, { ...input, unlocked: true }, auth.settings.maxProjectsPerUser);
      return NextResponse.json({ project, charged: cost }, { status: 201 });
    } catch (err) {
      if (cost > 0) await grantCreditsRemote(auth.user.id, cost).catch(() => false);
      throw err;
    }
  } catch (err) {
    return projectErrorResponse(err, 'create');
  }
}
