import { NextResponse } from 'next/server';
import { isHandleFree } from '@/lib/store/repo';
import { requireAffiliate, storeErrorResponse } from '@/lib/store/route-helpers';
import { handleProblem, normalizeHandle } from '@/lib/store/validation';

export const dynamic = 'force-dynamic';

/** GET /api/store/handle?h= — can this handle be used? */
export async function GET(req: Request) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  const handle = normalizeHandle(new URL(req.url).searchParams.get('h') ?? '');
  const problem = handleProblem(handle);
  if (problem) return NextResponse.json({ handle, available: false, problem });
  try {
    const available = await isHandleFree(handle);
    return NextResponse.json({ handle, available, problem: available ? null : 'This handle is taken.' });
  } catch (err) {
    return storeErrorResponse(err, 'handle');
  }
}
