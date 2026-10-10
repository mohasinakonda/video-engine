import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  uploadAssetToCanva,
  createCanvaThumbnailDesign,
  refreshCanvaToken,
} from '@/lib/canva/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, title, textOverlayHint, aspectRatio } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL or base64 is required' }, { status: 400 });
    }

    const clientId = process.env.CANVA_CLIENT_ID;
    const clientSecret = process.env.CANVA_CLIENT_SECRET;
    const isConfigured = Boolean(clientId && clientSecret);

    const cookieStore = cookies();
    let accessToken = cookieStore.get('canva_access_token')?.value;
    const refreshToken = cookieStore.get('canva_refresh_token')?.value;

    // If access token is missing but refresh token exists, attempt refresh
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
        console.warn('[Canva] Failed to refresh token:', refreshErr);
      }
    }

    // If user has not authenticated Canva yet
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        isConnected: false,
        isConfigured,
        message: isConfigured
          ? 'Canva account not connected. Please authorize Canva first.'
          : 'Canva API credentials not yet configured.',
      });
    }

    // 1. Upload the generated background image to Canva assets
    const cleanTitle = (title || 'YouTube Thumbnail Background').replace(/[^a-zA-Z0-9 _-]/g, '');
    const assetId = await uploadAssetToCanva(accessToken, imageUrl, cleanTitle);

    // 2. Create the YouTube thumbnail design in Canva with the uploaded asset
    const designResult = await createCanvaThumbnailDesign(accessToken, {
      title: title ? `${title} (Thumbnail)` : 'YouTube Thumbnail',
      assetId,
      aspectRatio: aspectRatio || '16:9',
    });

    return NextResponse.json({
      success: true,
      isConnected: true,
      designId: designResult.designId,
      editUrl: designResult.editUrl,
      assetId,
      textOverlayHint: textOverlayHint || '',
    });
  } catch (error: any) {
    console.error('[Canva Create Design Route Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create Canva design' },
      { status: 500 }
    );
  }
}
