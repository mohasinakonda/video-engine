import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/youtube/connection-service';
import { LINKABLE, rankCandidates } from '@/lib/youtube/create/publish';
import { fetchRecentUploads, linkedVideoIds } from '@/lib/youtube/create/published-videos';
import { ownedProject, projectErrorResponse, requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/create/projects/:id/publish-candidates — the connected channel's recent uploads,
 * ranked as likely matches for this project, with the best one suggested. Free; about 2 quota
 * units. Nothing is stored.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;
  try {
    const project = await ownedProject(auth.user.id, params.id);
    if (project instanceof NextResponse) return project;
    if (!LINKABLE.includes(project.status)) {
      return NextResponse.json({ error: 'A video can be linked once the project is packaged.', code: 'transition' }, { status: 409 });
    }
    const { accessToken, connection } = await getValidAccessToken(auth.user.id);
    const [uploads, linked] = await Promise.all([fetchRecentUploads(accessToken, connection.channelId), linkedVideoIds(auth.user.id)]);
    return NextResponse.json({ ...rankCandidates(project, uploads, linked), channelTitle: connection.title });
  } catch (err) {
    return projectErrorResponse(err, 'publish candidates');
  }
}
