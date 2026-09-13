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
    id: 'dreamshaper',
    name: 'DreamShaper 8 LCM',
    description: 'Artistic, highly stylized, vibrant color fantasy & sci-fi art',
    isFree: true,
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

/**
 * 1. getPollinationsClient
 * Returns an OpenAI client instance pointing to Pollinations Unified Endpoint
 */
export function getPollinationsClient(apiKey?: string): OpenAI {
  let resolvedKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : "";

  if (!resolvedKey && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("pollinations-api-key");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "string" && parsed.trim().length > 0) {
          resolvedKey = parsed.trim();
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }

  if (!resolvedKey) resolvedKey = DEFAULT_API_KEY;

  return new OpenAI({
    baseURL: DEFAULT_BASE_URL,
    apiKey: resolvedKey,
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

  const systemInstruction = `You are an expert video director and script parser.
Your job is to parse a video narration script into a sequential list of visual scenes.
Each scene must represent roughly 3 to 4 seconds of narration (default ~3.5 seconds).
For every scene, output:
- narration: The exact segment of script words read aloud during this scene.
- visual_prompt: A detailed, highly descriptive prompt to generate a cinematic still image using an AI image generator.
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
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to breakdown script to scenes with Pollinations: ${message}`);
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

  const combinedPrompt = baseStyle && baseStyle.trim().length > 0
    ? `${prompt.trim()}, ${baseStyle.trim()}`
    : prompt.trim();

  let finalPrompt = combinedPrompt;
  if (options?.negativePrompt && options.negativePrompt.trim()) {
    finalPrompt += `, avoid: ${options.negativePrompt.trim()}`;
  }

  const encodedPrompt = encodeURIComponent(finalPrompt);
  const resolvedSeed = typeof seed === "number" && !isNaN(seed)
    ? seed
    : (typeof options?.seed === "number" && !isNaN(options.seed) ? options.seed : Math.floor(Math.random() * 1000000));

  const model = options?.model || "flux";
  const width = options?.width || (options?.aspectRatio === '9:16' ? 1080 : 1920);
  const height = options?.height || (options?.aspectRatio === '9:16' ? 1920 : 1080);
  const nologo = options?.nologo !== false;

  // Resolve API key if available
  let apiKey = options?.apiKey;
  if (!apiKey && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("pollinations-api-key");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "string" && parsed.trim().length > 0) apiKey = parsed.trim();
      }
    } catch {
      // ignore
    }
  }

  // 1. Primary endpoint: https://gen.pollinations.ai/image/{prompt}
  if (apiKey && apiKey.trim().length > 0) {
    const genUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=${nologo}&seed=${resolvedSeed}&quality=high`;
    try {
      const genResponse = await fetch(genUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      if (genResponse.ok) {
        return await genResponse.arrayBuffer();
      } else {
        console.warn(`gen.pollinations.ai returned ${genResponse.status}, falling back to free image endpoint.`);
      }
    } catch (genErr) {
      console.warn("gen.pollinations.ai request error, trying free endpoint fallback:", genErr);
    }
  }

  // 2. Free unauthenticated image endpoint fallback: https://image.pollinations.ai/prompt/{prompt}
  const freeUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=${nologo}&seed=${resolvedSeed}`;

  try {
    const response = await fetch(freeUrl, { method: "GET" });

    if (!response.ok) {
      // If specific model failed, retry with default 'flux'
      if (model !== 'flux') {
        const retryUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&seed=${resolvedSeed}`;
        const retryRes = await fetch(retryUrl, { method: "GET" });
        if (retryRes.ok) return await retryRes.arrayBuffer();
      }
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText.slice(0, 200)}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

  const requestedScenes = Math.max(1, Math.min(25, options?.sceneCount || 5));
  const aiClient = getPollinationsClient(options?.apiKey);

  const systemInstruction = `You are a visual director for an AI film and art studio.
Your task is to take a creative requirement, story, or description and generate exactly ${requestedScenes} distinct, sequential cinematic visual scenes.
Each scene must feature a vivid visual prompt describing characters, lighting, environment, camera angle, and style.
For every scene, output:
- narration: A brief narrative or caption line (1-2 sentences) summarizing what happens in this scene.
- visual_prompt: An exceptionally detailed, cinematic visual prompt ready for an AI image generator (Flux/Pollinations). Mention composition, lighting, style, colors, and camera framing.
- durationSec: 3.5

CRITICAL: Return ONLY a valid JSON array of ${requestedScenes} objects with keys "narration", "visual_prompt", "durationSec".
No conversational text, markdown introduction, or backticks outside the JSON.`;

  const userPrompt = `Create exactly ${requestedScenes} cinematic visual scenes for this requirement:\n\n"""\n${requirement.trim()}\n"""`;

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
    if (!Array.isArray(parsed)) {
      throw new Error("LLM output is not a JSON array of scenes.");
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
    // Graceful sentence partition fallback
    const lines = requirement.split(/(?<=[.!?\n])\s+/).filter((l) => l.trim().length > 3);
    const count = requestedScenes;
    return Array.from({ length: count }, (_, idx) => {
      const line = lines[idx % (lines.length || 1)] || `Visual Scene ${idx + 1}`;
      return {
        narration: line,
        visual_prompt: `Cinematic movie still, photorealistic 8k, dramatic lighting: ${line}`,
        durationSec: 3.5,
      };
    });
  }
}
