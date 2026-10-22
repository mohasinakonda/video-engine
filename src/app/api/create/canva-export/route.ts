import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { exportCanvaDesign, refreshCanvaToken } from '@/lib/canva/client';
import { thumbnailConceptSchema } from '@/lib/youtube/create/packaging';
import { requireCreate } from '@/lib/youtube/create/route-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({ designId: thumbnailConceptSchema.shape.canvaDesignId.unwrap() });
const MAX_BYTES = 15 * 1024 * 1024;

/** Canva's access token from its cookie, refreshed when only the refresh token is left. */
async function canvaToken(): Promise<string | null> {
  const store = cookies();
  const access = store.get('canva_access_token')?.value;
  if (access) return access;
  const refresh = store.get('canva_refresh_token')?.value;
  const { CANVA_CLIENT_ID: id, CANVA_CLIENT_SECRET: secret } = process.env;
  if (!refresh || !id || !secret) return null;
  try {
    const t = await refreshCanvaToken(refresh, id, secret);
    store.set('canva_access_token', t.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: t.expires_in || 3600 * 4,
      path: '/',
    });
    return t.access_token;
  } catch {
    return null;
  }
}

/**
 * POST /api/create/canva-export — the finished Canva design as a PNG data URL. Canva's download
 * links expire within hours, so the image is passed straight back for the browser to keep;
 * nothing is stored here.
 */
export async function POST(req: Request) {
  const auth = await requireCreate();
  if ('response' in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const token = await canvaToken();
  if (!token) return NextResponse.json({ error: 'Connect Canva first.', code: 'canva_not_connected' }, { status: 401 });

  try {
    const url = new URL(await exportCanvaDesign(token, parsed.data.designId));
    // Only Canva's own download hosts.
    if (url.protocol !== 'https:' || !(url.hostname === 'canva.com' || url.hostname.endsWith('.canva.com'))) throw new Error('Unexpected export host');
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) throw new Error(`Download failed (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error('Exported image is too large');
    return NextResponse.json({ image: `data:${type};base64,${bytes.toString('base64')}` });
  } catch (err) {
    console.error('[create/canva-export]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Couldn’t bring the design back from Canva. Try again in a moment.' }, { status: 502 });
  }
}
