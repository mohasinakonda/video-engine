/**
 * deepinfra.ts — DeepInfra FLUX-1-schnell AI Image Generator
 *
 * Direct integration with DeepInfra inference API for:
 * Model: black-forest-labs/FLUX-1-schnell
 * High-speed (~200ms) generation with high visual fidelity.
 */

export interface DeepInfraImageOptions {
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
  runtimeMs?: number;
  cost?: number;
}

/**
 * Standard optimal resolutions for FLUX-1-schnell
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
 * Executes text-to-image inference using DeepInfra FLUX-1-schnell
 */
export async function generateDeepInfraFluxImage(
  prompt: string,
  options: DeepInfraImageOptions = {}
): Promise<DeepInfraImageResult> {
  const apiKey =
    options.apiKey?.trim() ||
    process.env.DEEPINFRA_API_KEY?.trim() ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEEPINFRA_API_KEY?.trim() : '');

  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY is not configured in environment variables.');
  }

  const { width, height } = getFluxDimensions(options.aspectRatio, options.width, options.height);

  let fullPrompt = prompt.trim();
  if (options.stylePrompt && options.stylePrompt.trim()) {
    const s = options.stylePrompt.trim();
    if (!fullPrompt.toLowerCase().includes(s.slice(0, 30).toLowerCase())) {
      fullPrompt = `${fullPrompt}. ${s}`;
    }
  }

  // Enforce strict FLUX.1-schnell distillation bounds: 4 steps, guidance_scale: 1.0
  const steps = typeof options.numInferenceSteps === 'number' ? Math.min(options.numInferenceSteps, 4) : 4;
  const guidance = typeof options.guidanceScale === 'number' ? options.guidanceScale : 1.0;

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

  const response = await fetch('https://api.deepinfra.com/v1/inference/black-forest-labs/FLUX-1-schnell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`DeepInfra FLUX-1-schnell HTTP ${response.status}: ${errorBody.slice(0, 250)}`);
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
    runtimeMs: data.inference_status?.runtime_ms,
    cost: data.inference_status?.cost,
  };
}
