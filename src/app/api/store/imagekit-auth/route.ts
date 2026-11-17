import { createHmac, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getImagekitPrivateKey, requireMyStore } from '@/lib/store/repo';
import { requireAffiliate, storeErrorResponse } from '@/lib/store/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/store/imagekit-auth — a one-time signature so the browser can upload a product image
 * straight to the creator's own ImageKit (https://upload.imagekit.io/api/v1/files/upload).
 * The private key never leaves the server.
 */
export async function POST() {
  const auth = await requireAffiliate();
  if ('response' in auth) return auth.response;
  try {
    const store = await requireMyStore(auth.user.id);
    const privateKey = await getImagekitPrivateKey(store.id);
    if (!privateKey || !store.imagekitPublicKey || !store.imagekitUrlEndpoint) {
      return NextResponse.json({ error: 'Add your ImageKit keys in Store settings first, or paste an image link.', code: 'no_imagekit' }, { status: 409 });
    }
    const token = randomUUID();
    const expire = Math.floor(Date.now() / 1000) + 10 * 60;
    const signature = createHmac('sha1', privateKey)
      .update(token + expire)
      .digest('hex');
    return NextResponse.json({ token, expire, signature, publicKey: store.imagekitPublicKey, urlEndpoint: store.imagekitUrlEndpoint, folder: `/rendoza/${store.handle}` });
  } catch (err) {
    return storeErrorResponse(err, 'imagekit auth');
  }
}
