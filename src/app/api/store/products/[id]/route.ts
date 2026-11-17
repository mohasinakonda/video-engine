import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteProduct, requireMyStore, updateProduct } from '@/lib/store/repo';
import { revalidateBio } from '@/lib/store/revalidate';
import { requireAffiliate, storeErrorResponse } from '@/lib/store/route-helpers';

export const dynamic = 'force-dynamic';

type Context = { params: { id: string } };
const idSchema = z.string().uuid();

/** PATCH /api/store/products/:id — edit, hide or reorder one of the creator's products. */
export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const store = await requireMyStore(auth.user.id);
    const product = await updateProduct(store.id, params.id, await req.json().catch(() => ({})));
    void revalidateBio(store.handle);
    return NextResponse.json({ product });
  } catch (err) {
    return storeErrorResponse(err, 'update product');
  }
}

/** DELETE /api/store/products/:id */
export async function DELETE(_req: Request, { params }: Context) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const store = await requireMyStore(auth.user.id);
    await deleteProduct(store.id, params.id);
    void revalidateBio(store.handle);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return storeErrorResponse(err, 'delete product');
  }
}
