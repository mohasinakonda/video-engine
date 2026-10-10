import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exportCanvaDesign, refreshCanvaToken } from '@/lib/canva/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { designId } = body;

    if (!designId) {
      return NextResponse.json({ error: 'designId is required' }, { status: 400 });
    }

    const clientId = process.env.CANVA_CLIENT_ID;
    const clientSecret = process.env.CANVA_CLIENT_SECRET;
    const isConfigured = Boolean(clientId && clientSecret);

    const cookieStore = cookies();
    let accessToken = cookieStore.get('canva_access_token')?.value;
    const refreshToken = cookieStore.get('canva_refresh_token')?.value;

    if (!accessToken && refreshToken && isConfigured) {
      try {
        const refreshed = await refreshCanvaToken(refreshToken, clientId!, clientSecret!);
        accessToken = refreshed.access_token;
        cookieStore.set('canva_access_token', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: refreshed.expires_in || 3600 * 4,
          path: '/',
        });
      } catch (refreshErr) {
        console.warn('[Canva Export] Failed to refresh token:', refreshErr);
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Canva authentication required. Please connect your Canva account.' },
        { status: 401 }
      );
    }

    const exportedImageUrl = await exportCanvaDesign(accessToken, designId);

    return NextResponse.json({
      success: true,
      imageUrl: exportedImageUrl,
    });
  } catch (error: any) {
    console.error('[Canva Export Route Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export Canva design' },
      { status: 500 }
    );
  }
}
