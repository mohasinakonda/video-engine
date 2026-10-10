import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  uploadAssetToCanva,
  createCanvaThumbnailDesign,
  createEditableDesignFromImage,
  refreshCanvaToken,
  CanvaCapabilityError,
  CanvaCreditQuotaError,
} from '@/lib/canva/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, title, textOverlayHint, aspectRatio, editableLayers } = body;

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
    const designTitle = title ? `${title} (Thumbnail)` : 'YouTube Thumbnail';

    // 2. Prefer the Magic Layers image-to-design import so every element of
    // the thumbnail becomes a separate editable layer in Canva. Falls back
    // to the flat single-image design when the capability/credits are missing.
    let fallbackNotice: string | null = null;
    if (editableLayers !== false) {
      try {
        const editable = await createEditableDesignFromImage(accessToken, {
          assetId,
          title: designTitle,
        });
        return NextResponse.json({
          success: true,
          isConnected: true,
          method: 'editable-layers',
          designId: editable.designId,
          editUrl: editable.editUrl,
          assetId,
          textOverlayHint: textOverlayHint || '',
        });
      } catch (layerErr) {
        if (
          layerErr instanceof CanvaCapabilityError ||
          layerErr instanceof CanvaCreditQuotaError
        ) {
          console.warn('[Canva] Editable-layers import unavailable, falling back to flat design:', layerErr.message);
          fallbackNotice =
            'Editable layers are unavailable for this Canva account (Magic Layers permission or AI credits). ' +
            'Enable Magic Layers on the Canva team to edit every element as its own layer.';
        } else {
          throw layerErr;
        }
      }
    }

    // 3. Fallback: create the YouTube thumbnail design with the uploaded
    // asset as a single flat image (movable/resizable/replaceable, but not
    // separable into editable layers).
    const designResult = await createCanvaThumbnailDesign(accessToken, {
      title: designTitle,
      assetId,
      aspectRatio: aspectRatio || '16:9',
    });

    return NextResponse.json({
      success: true,
      isConnected: true,
      method: 'flat-image',
      notice: fallbackNotice,
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
