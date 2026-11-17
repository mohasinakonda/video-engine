import { NextResponse } from 'next/server';
import { createStore, getMyStore, listCategories, updateStore } from '@/lib/store/repo';
import { revalidateBio } from '@/lib/store/revalidate';
import { requireAffiliate, storeErrorResponse } from '@/lib/store/route-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/store — the signed-in user's store (null until they pick a handle) and its categories. */
export async function GET() {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  try {
    const store = await getMyStore(auth.user.id);
    return NextResponse.json({ store, categories: store ? await listCategories(store.id) : [] });
  } catch (err) {
    return storeErrorResponse(err, 'get');
  }
}

/** POST /api/store — create the store: { handle, displayName }. One per user; the handle can't be changed later. */
export async function POST(req: Request) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  try {
    const store = await createStore(auth.user.id, await req.json().catch(() => ({})));
    return NextResponse.json({ store }, { status: 201 });
  } catch (err) {
    return storeErrorResponse(err, 'create');
  }
}

/** PATCH /api/store — profile, links, Amazon store ID, marketplace, ImageKit keys. */
export async function PATCH(req: Request) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  try {
    const store = await updateStore(auth.user.id, await req.json().catch(() => ({})));
    void revalidateBio(store.handle);
    return NextResponse.json({ store });
  } catch (err) {
    return storeErrorResponse(err, 'update');
  }
}
