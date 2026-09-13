"use client";

import OpenAI from "openai";

/**
 * Types & Interfaces
 */
export interface ScriptSceneBreakdown {
  narration: string;
  visual_prompt: string;
  durationSec: number;
}

export type SupportedTtsVoice =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";

export interface GenerateImageOptions {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  nologo?: boolean;
  apiKey?: string;
  negativePrompt?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface PollinationsImageModelOption {
  id: string;
  name: string;
  description: string;
  isFree: boolean;
}

export const POPULAR_POLLINATIONS_MODELS: PollinationsImageModelOption[] = [
  {
    id: 'flux',
    name: 'FLUX.1 Schnell (Recommended)',
    description: 'Ultra fast, crisp 1080p cinematic frames with exceptional realism',
    isFree: true,
  },
  {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo',
    description: 'High-speed photorealistic generation with sharp detail',
    isFree: true,
  },
  {
    id: 'lykon/dreamshaper-8-lcm',
    name: 'DreamShaper 8 LCM (API Key Required)',
    description: '300 RPM • Quest • 0.0001 pollen/gen • Ultra-fast LCM diffusion (enter.pollinations.ai/keys)',
    isFree: false,
  },
  {
    id: 'dreamshaper',
    name: 'DreamShaper (Legacy alias - API Key Required)',
    description: 'Artistic stylized fantasy & sci-fi art (enter.pollinations.ai/keys)',
    isFree: false,
  },
  {
    id: 'nanobanana-2-lite',
    name: 'Nano Banana 2 Lite (Gemini 3.1)',
    description: 'Google Gemini 3.1 Flash Lite multimodal image generator',
    isFree: true,
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    description: 'OpenAI realistic composition with clean lighting and framing',
    isFree: true,
  },
  {
    id: 'flux-2-klein-4b',
    name: 'FLUX.2 Klein 4B',
    description: 'Compact next-generation Black Forest Labs diffusion model',
    isFree: true,
  },
  {
    id: 'flux-2-pro',
    name: 'FLUX.2 Pro (API Key Required)',
    description: 'State of the art high-fidelity generation with maximum prompt adherence',
    isFree: false,
  },
];

const DEFAULT_BASE_URL = "https://gen.pollinations.ai/v1";
const DEFAULT_API_KEY = "pollinations";

export function getStoredPollinationsKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("pollinations-api-key");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed.trim();
    } catch {
      return raw.trim();
    }
  } catch {
    return "";
  }
  return "";
}

export function getStoredGlobalBaseStyle(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("global-base-style-prompt");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed.trim();
    } catch {
      return raw.trim();
    }
  } catch {
    return "";
  }
  return "";
}

export function getStoredGlobalNegativePrompt(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("global-negative-prompt");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed.trim();
    } catch {
      return raw.trim();
    }
  } catch {
    return "";
  }
  return "";
}

/**
 * 1. getPollinationsClient
 * Returns an OpenAI client instance pointing to Pollinations Unified Endpoint
 */
export function getPollinationsClient(apiKey?: string): OpenAI {
  let resolvedKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : "";

  // If a legacy Gemini key or placeholder was passed, discard it
  if (resolvedKey.startsWith("AIza") || resolvedKey.toLowerCase() === "pollinations") {
    resolvedKey = "";
  }

  if (!resolvedKey) {
    resolvedKey = getStoredPollinationsKey();
  }

  if (resolvedKey.startsWith("AIza") || resolvedKey.toLowerCase() === "pollinations") {
    resolvedKey = "";
  }

  if (resolvedKey) {
    return new OpenAI({
      baseURL: DEFAULT_BASE_URL,
      apiKey: resolvedKey,
      dangerouslyAllowBrowser: true,
    });
  }

  // When no key is available, explicitly omit Authorization header so Pollinations allows free-tier requests!
  return new OpenAI({
    baseURL: DEFAULT_BASE_URL,
    apiKey: "dummy",
    defaultHeaders: { Authorization: null as unknown as string },
    dangerouslyAllowBrowser: true,
  });
}

/**
 * 2. breakdownScriptToScenes
 * Uses Pollinations text completion to break down long scripts into ~3.5s sequential visual scenes.
 */
export async function breakdownScriptToScenes(
  script: string,
  client?: OpenAI
): Promise<ScriptSceneBreakdown[]> {
  if (!script || !script.trim()) {
    throw new Error("Cannot break down an empty script.");
  }

  const aiClient = client || getPollinationsClient();

  const systemInstruction = `You are an expert video director and cinematic visual artist.
Your job is to parse a video narration script into a sequential list of visual scenes.
Each scene must represent roughly 3 to 4 seconds of narration (default ~3.5 seconds).
For every scene, output:
- narration: The exact segment of script words read aloud during this scene.
- visual_prompt: A studio-grade, exceptionally detailed prompt for an AI image generator. Describe the subject's exact action, camera framing (e.g. cinematic wide shot, intimate medium close-up, atmospheric low angle), environment and rich background details, dramatic cinematic lighting (e.g. golden hour volumetric rays, moody chiaroscuro, neon rim light), and textures (photorealistic, 8k resolution, 35mm film look).
- durationSec: Estimated duration in seconds (around 3.0 to 4.5 seconds).

CRITICAL: Return ONLY a valid JSON array of objects with keys "narration", "visual_prompt", "durationSec".
Do not include any explanation, intro text, or conversational markdown outside the JSON.`;

  const userPrompt = `Break down the following narration script into scenes:\n\n"""\n${script.trim()}\n"""`;

  try {
    const response = await aiClient.chat.completions.create({
      model: "openai",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response returned from Pollinations text model.");
    }

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const cleanedJson = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const parsed = JSON.parse(cleanedJson);
    if (!Array.isArray(parsed)) {
      throw new Error("LLM output is not a JSON array of scenes.");
    }

    return parsed.map((item: Record<string, unknown>, index: number) => {
      const narration = typeof item.narration === "string" ? item.narration.trim() : "";
      const visualPrompt =
        typeof item.visual_prompt === "string"
          ? item.visual_prompt.trim()
          : typeof item.visualPrompt === "string"
            ? item.visualPrompt.trim()
            : `Cinematic frame representing scene ${index + 1}`;
      const durationSec =
        typeof item.durationSec === "number"
          ? item.durationSec
          : typeof item.duration_sec === "number"
            ? item.duration_sec
            : 3.5;

      return {
        narration,
        visual_prompt: visualPrompt,
        durationSec,
      };
    });
  } catch (error) {

    const sentences = script.split(/(?<=[.!?\n])\s+/).filter((s) => s.trim().length > 0);
    const sceneCount = Math.max(1, Math.min(30, Math.ceil(sentences.length / 2)));
    const chunkSize = Math.max(1, Math.ceil(sentences.length / sceneCount));

    return Array.from({ length: sceneCount }, (_, idx) => {
      const slice = sentences.slice(idx * chunkSize, (idx + 1) * chunkSize);
      const narration = slice.join(" ") || `Scene ${idx + 1}`;
      return {
        narration,
        visual_prompt: `Cinematic frame, ultra detailed 8k, dramatic lighting, camera depth: ${narration.slice(0, 120)}`,
        durationSec: 3.5,
      };
    });
  }
}

/**
 * Helper: fetchFreeWebTts
 * Reliable, free web-based TTS fallback (returns MP3 ArrayBuffer) with sentence chunking.
 */
export async function fetchFreeWebTts(text: string): Promise<ArrayBuffer> {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  let currentLen = 0;

  for (const w of words) {
    if (currentLen + w.length + 1 > 150 && currentWords.length > 0) {
      chunks.push(currentWords.join(" "));
      currentWords = [];
      currentLen = 0;
    }
    currentWords.push(w);
    currentLen += w.length + 1;
  }
  if (currentWords.length > 0) chunks.push(currentWords.join(" "));

  const uint8Buffers: Uint8Array[] = [];

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) {
      throw new Error(`Free web TTS HTTP error ${res.status}: ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    uint8Buffers.push(new Uint8Array(buf));
  }

  const totalLength = uint8Buffers.reduce((acc, b) => acc + b.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of uint8Buffers) {
    merged.set(b, offset);
    offset += b.length;
  }
  return merged.buffer;
}

/**
 * 3. generateVoiceChunk
 * Generates audio buffer via Pollinations TTS using model `openai-audio` (chat completions text endpoint),
 * falling back to dedicated speech models, and then free web TTS.
 */
export async function generateVoiceChunk(
  text: string,
  voice: SupportedTtsVoice | string = "alloy",
  apiKey?: string
): Promise<ArrayBuffer> {
  if (!text || !text.trim()) {
    throw new Error("TTS text cannot be empty.");
  }

  const client = getPollinationsClient(apiKey);
  const selectedVoice = (voice || "alloy") as SupportedTtsVoice;

  // 1. First attempt: Chat completions endpoint with modalities: ["text", "audio"]
  // Note: Pollinations "openai-audio" is an omni chat model handled on the text/chat completions endpoint.
  try {
    const completion = await client.chat.completions.create({
      model: "openai-audio",
      modalities: ["text", "audio"],
      audio: {
        voice: selectedVoice,
        format: "mp3",
      },
      messages: [
        {
          role: "user",
          content: text.trim(),
        },
      ],
    });

    const audioBase64 = completion.choices[0]?.message?.audio?.data;
    if (audioBase64) {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
  } catch (chatAudioErr) {
    console.warn("Pollinations openai-audio completion failed, attempting fallbacks:", chatAudioErr);
  }

  // 2. Second attempt: dedicated audio models on /v1/audio/speech
  const speechModels = ["hexgrad/kokoro-82m", "tts-1"];
  for (const model of speechModels) {
    try {
      const response = await client.audio.speech.create({
        model,
        voice: selectedVoice,
        input: text.trim(),
        response_format: "mp3",
      });

      return await response.arrayBuffer();
    } catch {
      // Continue to next fallback
    }
  }

  // 3. Third attempt: Free web TTS endpoint (100% free, zero cost, no key required)
  try {
    return await fetchFreeWebTts(text.trim());
  } catch (freeErr) {
    const message = freeErr instanceof Error ? freeErr.message : String(freeErr);
    throw new Error(`Audio generation failed across all available TTS providers: ${message}`);
  }
}

/**
 * 4. generateSceneImage
 * Fetches an image generated with Pollinations image API.
 * Follows docs: https://gen.pollinations.ai/docs#tag/image/GET/image/{prompt}
 * Uses gen.pollinations.ai with API key if available, falling back to image.pollinations.ai.
 */
export async function generateSceneImage(
  prompt: string,
  baseStyle?: string,
  seed?: number,
  options?: GenerateImageOptions
): Promise<ArrayBuffer> {
  if (!prompt || !prompt.trim()) {
    throw new Error("Image prompt cannot be empty.");
  }


  // Resolve Base Style (from arguments or stored global settings)
  const resolvedBaseStyle = (baseStyle && baseStyle.trim().length > 0)
    ? baseStyle.trim()
    : (getStoredGlobalBaseStyle() || "photorealistic, 8k resolution, cinematic lighting, masterpiece, hyper-detailed, sharp focus, 35mm lens");

  // Resolve Negative Prompt
  const resolvedNegative = (options?.negativePrompt && options.negativePrompt.trim().length > 0)
    ? options.negativePrompt.trim()
    : (getStoredGlobalNegativePrompt() || "blurry, low resolution, distorted faces, bad anatomy, deformed limbs, pixelated, noisy, artifacts, amateur, watermark, low quality, cartoon, anime");

  let finalPrompt = `${prompt.trim()}, ${resolvedBaseStyle}`;
  if (resolvedNegative) {
    finalPrompt += `, avoid: ${resolvedNegative}`;
  }

  const encodedPrompt = encodeURIComponent(finalPrompt);
  const resolvedSeed = typeof seed === "number" && !isNaN(seed)
    ? seed
    : (typeof options?.seed === "number" && !isNaN(options.seed) ? options.seed : Math.floor(Math.random() * 1000000));

  const model = options?.model || "flux";
  // Optimal native diffusion dimensions for maximum clarity and detail (prevents blurring/distortion)
  const isVertical = options?.aspectRatio === '9:16';
  const width = options?.width || (isVertical ? 720 : 1280);
  const height = options?.height || (isVertical ? 1280 : 720);
  const nologo = options?.nologo !== false;

  // Resolve API key if available
  let apiKey = options?.apiKey && typeof options.apiKey === 'string' && options.apiKey.trim().length > 0 ? options.apiKey.trim() : undefined;

  // If the passed apiKey is an old Gemini key (AIza...) or placeholder, discard it
  if (apiKey && (apiKey.startsWith("AIza") || apiKey.toLowerCase() === "pollinations")) {
    apiKey = undefined;
  }

  if (!apiKey) {
    const stored = getStoredPollinationsKey();
    if (stored && !stored.startsWith("AIza") && stored.toLowerCase() !== "pollinations") {
      apiKey = stored;
    }
  }

  console.log('[Pollinations Image Request]', {
    model,
    width,
    height,
    quality: 'hd',
    hasKey: !!apiKey,
    promptPreview: finalPrompt.slice(0, 70) + '...',
  });

  // Primary endpoint: https://gen.pollinations.ai/image/{prompt}
  // If the user has a valid API key, attach it via Header and query param
  const headers: Record<string, string> = {};
  let keyQuery = "";
  if (apiKey && apiKey.trim().length > 0) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    keyQuery = `&key=${encodeURIComponent(apiKey.trim())}`;
  }

  const primaryUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=${nologo}&seed=${resolvedSeed}&quality=hd${keyQuery}`;

  try {
    const response = await fetch(primaryUrl, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      return await response.arrayBuffer();
    }

    const errorStatus = response.status;
    const errorText = await response.text().catch(() => "");
    console.warn(`[Pollinations] Image model '${model}' returned HTTP ${errorStatus}: ${errorText.slice(0, 150)}`);

    // If a non-flux model fails (e.g. 401 Unauthorized for paid models like lykon/dreamshaper-8-lcm without key),
    // automatically fallback to free 'flux' model on gen.pollinations.ai
    if (model !== "flux") {
      console.info(`[Pollinations] Falling back to free 'flux' model on gen.pollinations.ai...`);
      const fallbackUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=${nologo}&seed=${resolvedSeed}&quality=hd`;
      const fallbackRes = await fetch(fallbackUrl, { method: "GET" });
      if (fallbackRes.ok) {
        return await fallbackRes.arrayBuffer();
      }
    }

    throw new Error(`HTTP ${errorStatus} ${response.statusText}: ${errorText.slice(0, 200)}`);
  } catch (error) {
    // If anything fails in the primary path and we haven't tried free flux yet
    if (model !== "flux") {
      try {
        console.info(`[Pollinations] Error caught, attempting last-resort free 'flux' fallback...`);
        const fallbackUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=${nologo}&seed=${resolvedSeed}`;
        const fallbackRes = await fetch(fallbackUrl, { method: "GET" });
        if (fallbackRes.ok) {
          return await fallbackRes.arrayBuffer();
        }
      } catch {
        // ignore and let original error throw
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[Pollinations] Image generation error:", message);
    throw new Error(`Failed to generate scene image from Pollinations: ${message}`);
  }
}

/**
 * 5. breakdownRequirementToImageScenes
 * Takes user creative requirements or story prompt and breaks them down into
 * sequential visual scenes ready for image generation, without requiring voice generation.
 */
export async function breakdownRequirementToImageScenes(
  requirement: string,
  options?: {
    sceneCount?: number;
    stylePrompt?: string;
    apiKey?: string;
  }
): Promise<ScriptSceneBreakdown[]> {
  if (!requirement || !requirement.trim()) {
    throw new Error("Requirement cannot be empty.");
  }

  const aiClient = getPollinationsClient(options?.apiKey);
  const countInstruction = typeof options?.sceneCount === "number" && options.sceneCount > 0
    ? `Create exactly ${options.sceneCount} distinct, sequential cinematic visual scenes.`
    : `Determine the natural number of sequential cinematic visual scenes based directly on the story progression, key moments, and narrative beats of the content.`;

  const systemInstruction = `You are a visual director for an AI film and art studio.
Your task is to take a creative requirement, story, or script and break it down into sequential visual scenes.
${countInstruction}
Each scene must feature a vivid visual prompt describing characters, lighting, environment, camera angle, and style.
For every scene, output:
- narration: A brief narrative or caption line (1-2 sentences) summarizing what happens in this scene.
- visual_prompt: A studio-grade, exceptionally detailed visual prompt for an AI image generator (Flux). Specifically describe subject pose/action, cinematic camera framing (e.g. wide cinematic landscape, dramatic over-the-shoulder, intimate macro close-up), environment with rich atmospheric lighting (e.g. golden hour volumetric light, foggy moody backlight, neon cyberpunk reflection), and textures (photorealistic 8k, masterwork, 35mm lens, sharp focus).
- durationSec: 3.5

CRITICAL: Return ONLY a valid JSON array of scene objects with keys "narration", "visual_prompt", "durationSec".
No conversational text, markdown introduction, or backticks outside the JSON.`;

  const userPrompt = `Break down this requirement into sequential cinematic visual scenes based on the story content:\n\n"""\n${requirement.trim()}\n"""`;

  try {
    const response = await aiClient.chat.completions.create({
      model: "openai",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response returned from Pollinations text model.");
    }

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const cleanedJson = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const parsed = JSON.parse(cleanedJson);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("LLM output is not a non-empty JSON array of scenes.");
    }

    return parsed.map((item: Record<string, unknown>, index: number) => {
      const narration = typeof item.narration === "string" ? item.narration.trim() : `Scene ${index + 1}`;
      const visualPrompt =
        typeof item.visual_prompt === "string"
          ? item.visual_prompt.trim()
          : typeof item.visualPrompt === "string"
            ? item.visualPrompt.trim()
            : `Cinematic frame for ${requirement.slice(0, 60)}`;
      const durationSec = typeof item.durationSec === "number" ? item.durationSec : 3.5;

      return {
        narration,
        visual_prompt: visualPrompt,
        durationSec,
      };
    });
  } catch (error) {
    console.warn("Pollinations requirement breakdown fallback:", error);
    // Graceful sentence partition fallback: dynamic scene count based on actual text
    const lines = requirement.split(/(?<=[.!?\n])\s+/).filter((l) => l.trim().length > 3);
    const count = typeof options?.sceneCount === "number" && options.sceneCount > 0
      ? options.sceneCount
      : Math.max(1, Math.min(25, Math.ceil(lines.length / 2)));
    const chunkSize = Math.max(1, Math.ceil(lines.length / count));

    return Array.from({ length: count }, (_, idx) => {
      const chunkText = lines.slice(idx * chunkSize, (idx + 1) * chunkSize).join(' ') || lines[idx] || `Visual Scene ${idx + 1}`;
      return {
        narration: chunkText,
        visual_prompt: `Cinematic movie still, photorealistic 8k, dramatic lighting: ${chunkText}`,
        durationSec: 3.5,
      };
    });
  }
}
