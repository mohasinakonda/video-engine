import crypto from 'crypto';

export interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface CanvaAssetUploadResponse {
  job: {
    id: string;
    status: 'in_progress' | 'success' | 'failed';
    asset?: {
      id: string;
      name: string;
      created_at: number;
      updated_at: number;
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

export interface CanvaDesignResponse {
  design: {
    id: string;
    title: string;
    urls: {
      edit_url: string;
      view_url?: string;
    };
  };
}

export interface CanvaExportJobResponse {
  job: {
    id: string;
    status: 'in_progress' | 'success' | 'failed';
    urls?: string[];
    error?: {
      code: string;
      message: string;
    };
  };
}

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_AUTH_BASE = 'https://www.canva.com/api/oauth/authorize';

/**
 * Generate PKCE code verifier and code challenge for OAuth 2.0 PKCE flow
 */
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Construct Canva OAuth 2.0 authorization URL
 */
export function getCanvaAuthUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
  scopes: string[] = [
    'asset:write',
    'asset:read',
    'design:content:read',
    'design:content:write',
    'design:meta:read',
    'brandtemplate:content:read',
    'brandtemplate:meta:read',
  ]
): string {
  const params = new URLSearchParams({
    code_challenge_method: 's256',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    code_challenge: codeChallenge,
    state,
  });

  return `${CANVA_AUTH_BASE}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCanvaCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<CanvaTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${CANVA_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Canva Token exchange failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Refresh an expired Canva access token
 */
export async function refreshCanvaToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<CanvaTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(`${CANVA_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Canva Token refresh failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Upload an image asset to user's Canva library
 * Handles both public URLs and base64 data URLs
 */
export async function uploadAssetToCanva(
  accessToken: string,
  imageData: string,
  assetName: string
): Promise<string> {
  let imageBuffer: Buffer;
  let contentType = 'image/png';

  if (imageData.startsWith('data:')) {
    const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      contentType = matches[1];
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else {
      throw new Error('Invalid base64 image data URL format');
    }
  } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    const fetchRes = await fetch(imageData);
    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch image from URL: ${fetchRes.statusText}`);
    }
    const arrayBuffer = await fetchRes.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
    contentType = fetchRes.headers.get('content-type') || 'image/png';
  } else {
    imageBuffer = Buffer.from(imageData, 'base64');
  }

  // Canva Connect API binary upload with Asset-Upload-Metadata header
  const nameBase64 = Buffer.from((assetName || 'Thumbnail').slice(0, 50)).toString('base64');

  const uploadRes = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': JSON.stringify({ name_base64: nameBase64 }),
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Canva Asset upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadJob: CanvaAssetUploadResponse = await uploadRes.json();
  const jobId = uploadJob.job.id;

  // Poll for asset upload job completion (typically 1-3 seconds)
  let assetId = uploadJob.job.asset?.id;
  let attempts = 0;

  while (!assetId && attempts < 15) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pollRes = await fetch(`${CANVA_API_BASE}/asset-uploads/${jobId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (pollRes.ok) {
      const pollData: CanvaAssetUploadResponse = await pollRes.json();
      if (pollData.job.status === 'success' && pollData.job.asset?.id) {
        assetId = pollData.job.asset.id;
        break;
      }
      if (pollData.job.status === 'failed') {
        throw new Error(`Canva Asset upload job failed: ${pollData.job.error?.message || 'Unknown error'}`);
      }
    }
  }

  if (!assetId) {
    throw new Error('Timed out waiting for Canva asset upload completion');
  }

  return assetId;
}

/**
 * Create a new Canva Design pre-configured as YouTube Thumbnail (16:9 1280x720 / 1920x1080)
 * with the uploaded AI background asset linked.
 */
export async function createCanvaThumbnailDesign(
  accessToken: string,
  options: {
    title: string;
    assetId?: string;
    aspectRatio?: '16:9' | '9:16' | string;
  }
): Promise<{ designId: string; editUrl: string }> {
  const isVertical = options.aspectRatio === '9:16';
  const width = isVertical ? 1080 : 1280;
  const height = isVertical ? 1920 : 720;

  const payload: Record<string, any> = {
    title: options.title || 'YouTube Thumbnail',
    design_type: {
      type: 'custom',
      width,
      height,
    },
  };

  if (options.assetId) {
    payload.asset_id = options.assetId;
  }

  let res = await fetch(`${CANVA_API_BASE}/designs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const fallbackPayload: Record<string, any> = {
      title: options.title || 'YouTube Thumbnail',
      type: 'custom',
      width,
      height,
    };
    if (options.assetId) {
      fallbackPayload.asset_id = options.assetId;
    }
    const fallbackRes = await fetch(`${CANVA_API_BASE}/designs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fallbackPayload),
    });
    if (fallbackRes.ok) {
      res = fallbackRes;
    } else {
      const errText = await res.text();
      throw new Error(`Canva create design failed (${res.status}): ${errText}`);
    }
  }

  const data: CanvaDesignResponse = await res.json();
  return {
    designId: data.design.id,
    editUrl: data.design.urls.edit_url,
  };
}

export interface CanvaImageToDesignImportJobResponse {
  job: {
    id: string;
    status: 'in_progress' | 'success' | 'failed';
    result?: {
      design: {
        id: string;
        title?: string;
        urls: {
          edit_url: string;
          view_url?: string;
        };
      };
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

/**
 * Thrown when the user's Canva team does not have the Magic Layers
 * (`image_to_design_imports`) capability, so the image cannot be converted
 * into separate editable layers.
 */
export class CanvaCapabilityError extends Error {
  code = 'missing_capability';
  constructor(message: string) {
    super(message);
    this.name = 'CanvaCapabilityError';
  }
}

/**
 * Thrown when the user's Canva AI credit allowance is exhausted, so the
 * image-to-design conversion cannot run right now.
 */
export class CanvaCreditQuotaError extends Error {
  code = 'credit_quota_exceeded';
  constructor(message: string) {
    super(message);
    this.name = 'CanvaCreditQuotaError';
  }
}

const IMAGE_TO_DESIGN_IMPORTS_BASE = `${CANVA_API_BASE}/image-to-design-imports`;

/**
 * Convert an image asset already in the user's Canva account into a fully
 * editable Canva design using Magic Layers. Every element detected in the
 * image (text, shapes, graphics, background pieces) becomes a separate
 * editable layer in the resulting design.
 *
 * NOTE: This is a Canva preview API (subject to unannounced breaking
 * changes, and public integrations using it won't pass Canva's review).
 * It requires the `image_to_design_imports` capability on the user's Canva
 * team (Magic Layers permission) and consumes the user's AI credit
 * allowance per conversion. Callers should catch CanvaCapabilityError and
 * CanvaCreditQuotaError and fall back to the flat single-image design flow.
 */
export async function createEditableDesignFromImage(
  accessToken: string,
  options: {
    assetId: string;
    title?: string;
  }
): Promise<{ designId: string; editUrl: string }> {
  const createRes = await fetch(IMAGE_TO_DESIGN_IMPORTS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: { asset_id: options.assetId },
      title: options.title || 'YouTube Thumbnail',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    let errCode = '';
    let errMessage = errText;
    try {
      const errJson = JSON.parse(errText);
      errCode = errJson?.code || '';
      errMessage = errJson?.message || errText;
    } catch {
      // keep raw text
    }
    if (createRes.status === 403) {
      throw new CanvaCapabilityError(
        `Canva rejected the editable-layers import (403): ${errMessage}. ` +
          `The Canva team needs the Magic Layers (image_to_design_imports) capability enabled.`
      );
    }
    if (createRes.status === 429 && errCode === 'credit_quota_exceeded') {
      throw new CanvaCreditQuotaError(
        'Canva AI credit allowance exhausted — cannot convert the image into editable layers right now.'
      );
    }
    throw new Error(`Canva image-to-design import failed (${createRes.status}): ${errText}`);
  }

  const created: CanvaImageToDesignImportJobResponse = await createRes.json();
  const doneNow = extractImportDesign(created);
  if (doneNow) return doneNow;
  const jobId = created.job.id;

  // Poll until Magic Layers finishes. AI conversion can take a while.
  const maxAttempts = 40; // ~2 minutes at 3s intervals
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pollRes = await fetch(`${IMAGE_TO_DESIGN_IMPORTS_BASE}/${jobId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!pollRes.ok) continue;

    const pollData: CanvaImageToDesignImportJobResponse = await pollRes.json();
    const done = extractImportDesign(pollData);
    if (done) return done;
    if (pollData.job.status === 'failed') {
      throw new Error(
        `Canva image-to-design import failed: ${pollData.job.error?.message || pollData.job.error?.code || 'Unknown error'}`
      );
    }
  }

  throw new Error('Timed out waiting for Canva to convert the image into editable layers.');
}

function extractImportDesign(
  data: CanvaImageToDesignImportJobResponse
): { designId: string; editUrl: string } | null {
  if (data.job.status === 'success' && data.job.result?.design) {
    const design = data.job.result.design;
    return { designId: design.id, editUrl: design.urls.edit_url };
  }
  return null;
}

/**
 * Trigger export of completed Canva design to high-resolution PNG
 */
export async function exportCanvaDesign(
  accessToken: string,
  designId: string
): Promise<string> {
  const res = await fetch(`${CANVA_API_BASE}/exports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      design_id: designId,
      format: {
        type: 'png',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Canva export request failed (${res.status}): ${errText}`);
  }

  const exportInit: CanvaExportJobResponse = await res.json();
  const exportJobId = exportInit.job.id;

  // Poll until export is rendered
  let attempts = 0;
  while (attempts < 25) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const pollRes = await fetch(`${CANVA_API_BASE}/exports/${exportJobId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (pollRes.ok) {
      const jobData: CanvaExportJobResponse = await pollRes.json();
      if (jobData.job.status === 'success' && jobData.job.urls && jobData.job.urls.length > 0) {
        return jobData.job.urls[0];
      }
      if (jobData.job.status === 'failed') {
        throw new Error(`Canva design export failed: ${jobData.job.error?.message || 'Unknown error'}`);
      }
    }
  }

  throw new Error('Canva design export timed out. Please try again.');
}
