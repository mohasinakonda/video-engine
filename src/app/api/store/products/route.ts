import { NextResponse } from 'next/server';
import { addProduct, listCategories, listProducts, requireMyStore } from '@/lib/store/repo';
import { revalidateBio } from '@/lib/store/revalidate';
import { requireAffiliate, storeErrorResponse } from '@/lib/store/route-helpers';

export const dynamic = 'force-dynamic';

/** GET /api/store/products?q=&tag=&cat=&asin= — the creator's products, shown and hidden. */
export async function GET(req: Request) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  const p = new URL(req.url).searchParams;
  try {
    const store = await requireMyStore(auth.user.id);
    const [products, categories] = await Promise.all([
      listProducts(store.id, {
        q: p.get('q')?.slice(0, 100) ?? '',
        tag: p.get('tag')?.slice(0, 40) ?? '',
        category: p.get('cat')?.slice(0, 40) ?? '',
        asin: p.get('asin')?.slice(0, 10) ?? '',
      }),
      listCategories(store.id),
    ]);
    return NextResponse.json({ products, categories });
  } catch (err) {
    return storeErrorResponse(err, 'list products');
  }
}

/**
 * POST /api/store/products — add a product (manual, or from Affiliate Intelligence). When its
 * ASIN is already in the store, only the new tags are added (`existed: true`).
 */
export async function POST(req: Request) {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  try {
    const store = await requireMyStore(auth.user.id);
    const result = await addProduct(store.id, await req.json().catch(() => ({})));
    void revalidateBio(store.handle);
    return NextResponse.json(result, { status: result.existed ? 200 : 201 });
  } catch (err) {
    return storeErrorResponse(err, 'add product');
  }
}
