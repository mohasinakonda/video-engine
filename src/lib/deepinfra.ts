/**
 * deepinfra.ts — DeepInfra FLUX-1-schnell AI Image Generator
 *
 * Direct integration with DeepInfra inference API for:
 * Model: black-forest-labs/FLUX-1-schnell
 * High-speed (~200ms) generation with high visual fidelity.
 */

export interface DeepInfraImageOptions {
  model?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  width?: number;
  height?: number;
  seed?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  negativePrompt?: string;
  stylePrompt?: string;
  apiKey?: string;
}

export interface DeepInfraImageResult {
  base64Image: string;
  mimeType: string;
  arrayBuffer: ArrayBuffer;
  provider: 'deepinfra';
  model?: string;
  runtimeMs?: number;
  cost?: number;
}

/**
 * Standard optimal resolutions for FLUX and diffusion models
 */
export function getFluxDimensions(aspectRatio?: '16:9' | '9:16' | '1:1', customW?: number, customH?: number) {
  if (customW && customH) {
    return { width: customW, height: customH };
  }
  if (aspectRatio === '9:16') {
    return { width: 1080, height: 1920 };
  }
  if (aspectRatio === '1:1') {
    return { width: 1080, height: 1080 };
  }
  // Default: 16:9 widescreen Full HD
  return { width: 1920, height: 1080 };
}

/**
 * Executes text-to-image inference using DeepInfra (supports FLUX, SDXL, and custom models)
 */
export async function generateDeepInfraFluxImage(
  prompt: string,
  options: DeepInfraImageOptions = {}
): Promise<DeepInfraImageResult> {
  // Security: the DeepInfra key must NEVER be exposed via a NEXT_PUBLIC_ variable.
  // NEXT_PUBLIC_ values are inlined into the client JS bundle, and this module
  // is reachable from client components through lib/pollinations.ts.
  const apiKey =
    options.apiKey?.trim() ||
    process.env.DEEPINFRA_API_KEY?.trim() ||
    '';

  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY is not configured in environment variables.');
  }

  const modelId = (options.model && options.model.trim()) || 'black-forest-labs/FLUX-1-schnell';
  const { width, height } = getFluxDimensions(options.aspectRatio, options.width, options.height);

  let fullPrompt = prompt.trim();
  if (options.stylePrompt && options.stylePrompt.trim()) {
    const s = options.stylePrompt.trim();
    if (!fullPrompt.toLowerCase().includes(s.slice(0, 30).toLowerCase())) {
      fullPrompt = `${fullPrompt}. ${s}`;
    }
  }

  // Model-specific default steps and guidance scale
  const isDev = modelId.toLowerCase().includes('flux-1-dev') || modelId.toLowerCase().includes('/dev');
  const isTurbo = modelId.toLowerCase().includes('turbo') || modelId.toLowerCase().includes('lightning');

  let defaultSteps = 4;
  let defaultGuidance = 1.0;
  if (isDev) {
    defaultSteps = 28;
    defaultGuidance = 3.5;
  } else if (isTurbo) {
    defaultSteps = 1;
    defaultGuidance = 1.0;
  }

  const steps = typeof options.numInferenceSteps === 'number' ? options.numInferenceSteps : defaultSteps;
  const guidance = typeof options.guidanceScale === 'number' ? options.guidanceScale : defaultGuidance;

  const payload: Record<string, unknown> = {
    prompt: fullPrompt,
    width,
    height,
    num_inference_steps: steps,
    guidance_scale: guidance,
  };

  if (typeof options.seed === 'number' && !isNaN(options.seed)) {
    payload.seed = options.seed;
  }

  if (options.negativePrompt && options.negativePrompt.trim()) {
    payload.negative_prompt = options.negativePrompt.trim();
  }

  const endpointUrl = `https://api.deepinfra.com/v1/inference/${modelId}`;
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`DeepInfra ${modelId} HTTP ${response.status}: ${errorBody.slice(0, 250)}`);
  }

  const data = await response.json();
  if (!data.images || data.images.length === 0) {
    throw new Error('DeepInfra returned empty images array.');
  }

  const rawImage = data.images[0] as string;
  let base64Pure = rawImage;
  let mimeType = 'image/jpeg';

  if (rawImage.startsWith('data:')) {
    const parts = rawImage.split(',');
    base64Pure = parts[1] || '';
    const match = rawImage.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
  }

  const binaryString = atob(base64Pure);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fullBase64 = rawImage.startsWith('data:') ? rawImage : `data:${mimeType};base64,${base64Pure}`;

  return {
    base64Image: fullBase64,
    mimeType,
    arrayBuffer: bytes.buffer,
    provider: 'deepinfra',
    model: modelId,
    runtimeMs: data.inference_status?.runtime_ms,
    cost: data.inference_status?.cost,
  };
}

/** General alias for generateDeepInfraFluxImage */
export const generateDeepInfraImage = generateDeepInfraFluxImage;

