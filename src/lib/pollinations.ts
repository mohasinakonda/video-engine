"use client";

import OpenAI from "openai";
import type { ShotType, PacingProfile } from "@/types";

/**
 * Types & Interfaces
 */
export interface ScriptSceneBreakdown {
  narration: string;
  visual_prompt: string;
  durationSec: number;
  shot_type?: ShotType;
  b_roll_focus?: string;
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

export function getStoredPollinationsImageModel(): string {
  if (typeof window === "undefined") return "flux";
  try {
    const raw = localStorage.getItem("pollinations-image-model");
    if (!raw) return "flux";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed.trim() || "flux";
    } catch {
      return raw.trim() || "flux";
    }
  } catch {
    return "flux";
  }
  return "flux";
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
 * Uses Pollinations text completion to break down scripts into dynamic sequential visual scenes (2.0s - 6.5s variable).
 */
export async function breakdownScriptToScenes(
  script: string,
  client?: OpenAI,
  targetDurationSec?: number,
  options?: {
    pacingProfile?: PacingProfile;
    stylePrompt?: string;
  }
): Promise<ScriptSceneBreakdown[]> {
  if (!script || !script.trim()) {
    throw new Error("Cannot break down an empty script.");
  }

  const aiClient = client || getPollinationsClient();

  const VALID_SHOT_TYPES: ShotType[] = [
    'AERIAL_GEOMETRY',
    'MACRO_TEXTURE',
    'CULTURAL_HUMAN',
    'HISTORICAL_HERITAGE',
    'ATMOSPHERIC_MOOD',
    'WIDE_ESTABLISHING',
  ];

  const pacing = options?.pacingProfile || 'balanced';
  const paceConfig = {
    fast: { avgSec: 2.8, minSec: 1.8, maxSec: 3.8, desc: 'Fast, punchy cutaways (1.8s - 3.8s)' },
    balanced: { avgSec: 4.0, minSec: 2.2, maxSec: 5.5, desc: 'Dynamic natural pacing (2.2s - 5.5s)' },
    cinematic: { avgSec: 5.5, minSec: 3.5, maxSec: 7.5, desc: 'Cinematic, atmospheric rhythm (3.5s - 7.5s)' },
  }[pacing];

  const estimatedSceneCount = targetDurationSec && targetDurationSec > 0
    ? Math.max(1, Math.round(targetDurationSec / paceConfig.avgSec))
    : undefined;

  const durationGuidance = targetDurationSec && targetDurationSec > 0
    ? `Target total narration audio duration is ~${Math.round(targetDurationSec)} seconds. Generate approximately ${estimatedSceneCount} sequential scenes with natural variable lengths (${paceConfig.desc}) so that visual scene transitions span the entire ${Math.round(targetDurationSec)}-second narration smoothly.`
    : `Each scene represents roughly ${paceConfig.minSec} to ${paceConfig.maxSec} seconds of narration based on sentence length and shot emotion.`;

  const systemInstruction = `You are an elite documentary film director and visual auteur (in the league of BBC Earth, National Geographic, and IMAX).
Your job is to parse a video narration script into a sequential list of cinematographically rich visual scenes.
${durationGuidance}

CINEMATIC PACING & UNIVERSAL B-ROLL MANDATE:
Do NOT produce repetitive or literal visuals that depict only the primary subject from the same angle.
First, dynamically analyze the core subject, ecosystem, or theme of the content (e.g. Sea, Desert, Mountain, Rainforest, Metropolis, Ancient Civilization, Deep Space, Technology, etc.).
Then, as an expert director, cut dynamically across scales and perspectives, interleaving 6 universal B-roll lenses tailored directly to that specific world:

1. "AERIAL_GEOMETRY": Grand scale bird's-eye (90° top-down drone or orbital satellite) revealing geometric patterns, natural contours, and vast topological scale (e.g., dune ridges in deserts, swell breaks in oceans, jagged ridgelines in mountains, canopy fractals in forests, street grid networks in cities).
2. "MACRO_TEXTURE": Extreme tactile close-ups of micro details native to this environment (e.g., individual shifting sand grains, sea foam bubbles & salt crystals, glacial ice facets, moss spores & dew, weathered wood grain, microcircuit traces, stone carvings).
3. "CULTURAL_HUMAN": The human and living heartbeat connected to this world — native dwellers, explorers, artisans, workers, or inhabitants interacting authentically with the environment (e.g., nomads brewing tea in desert tents, pearl divers, mountain climbers adjusting gear, monks in cliffside shrines, street artisans).
4. "HISTORICAL_HERITAGE": Deep time, archaeology, and historical memory — ancient monuments, weathered ruins, fossil layers, petroglyphs, ancestral relics, or enduring architecture shaped by centuries.
5. "ATMOSPHERIC_MOOD": Dramatic elemental weather and lighting transitions — shifting mirages, blizzards, rolling ocean fog, dust storms, sunbeams cutting through haze, twilight silhouettes, or native wildlife in the elements.
6. "WIDE_ESTABLISHING": Majestic, expansive panoramic vista that anchors the viewer into the broader landscape and atmosphere.

CRITICAL PACING & VARIABLE DURATION RULES:
- Images must NEVER have uniform durations (e.g. all 4s). Durations MUST dynamically vary based on spoken syllables and shot style:
  * Short punchy clauses, quick action, or MACRO_TEXTURE: ${paceConfig.minSec}s - ${(paceConfig.minSec + 1.2).toFixed(1)}s
  * Medium narrative exposition or CULTURAL_HUMAN / HISTORICAL_HERITAGE: ${(paceConfig.avgSec - 0.5).toFixed(1)}s - ${(paceConfig.avgSec + 0.8).toFixed(1)}s
  * Wide panoramic vistas, AERIAL_GEOMETRY, or ATMOSPHERIC_MOOD: ${(paceConfig.avgSec + 0.8).toFixed(1)}s - ${paceConfig.maxSec}s
- Rule: Estimate durationSec based on the spoken length of narration (approx 2.3 - 2.8 words per second) plus pause weight.
- Never repeat the same shot_type twice in a row. Maintain an engaging, rhythmic visual montage.

For every scene, output:
- narration: The exact segment of script words read aloud during this scene.
- visual_prompt: A studio-grade, exceptionally detailed prompt for an AI image generator (Flux/SDXL). Describe camera framing (e.g. 90-degree bird's-eye drone shot, extreme tactile macro close-up, intimate medium close-up, low-angle telephoto), subject action/elements, rich atmospheric lighting, and environment textures (photorealistic 8k, masterwork, 35mm film look).
- durationSec: Estimated duration in seconds (between ${paceConfig.minSec} and ${paceConfig.maxSec}).
- shot_type: One of "AERIAL_GEOMETRY", "MACRO_TEXTURE", "CULTURAL_HUMAN", "HISTORICAL_HERITAGE", "ATMOSPHERIC_MOOD", "WIDE_ESTABLISHING".
- b_roll_focus: A concise 3-7 word description of the specific visual motif featured (e.g., "Wind-rippled sand dune geometry", "Bedouin tea ceremony by fire", "Extreme macro sea salt crystals").

CRITICAL: Return ONLY a valid JSON array of objects with keys "narration", "visual_prompt", "durationSec", "shot_type", "b_roll_focus".
Do not include any explanation, intro text, or conversational markdown outside the JSON.`;

  const userPrompt = `Break down the following narration script into scenes with diverse B-roll cutaways${targetDurationSec && targetDurationSec > 0 ? ` spanning approximately ${Math.round(targetDurationSec)} seconds` : ''}:\n\n"""\n${script.trim()}\n"""`;

  try {
    const response = await aiClient.chat.completions.create({
      model: "openai",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.35,
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

      const rawShotType = (typeof item.shot_type === "string" ? item.shot_type : typeof item.shotType === "string" ? item.shotType : "") as ShotType;
      const shot_type: ShotType = VALID_SHOT_TYPES.includes(rawShotType)
        ? rawShotType
        : VALID_SHOT_TYPES[index % VALID_SHOT_TYPES.length];

      // Calculate realistic variable duration based on spoken words if LLM gave uniform or invalid duration
      const wordCount = narration.split(/\s+/).filter(Boolean).length;
      const naturalDur = wordCount > 0
        ? Math.max(paceConfig.minSec, Math.min(paceConfig.maxSec, parseFloat((wordCount / 2.5).toFixed(1))))
        : paceConfig.avgSec;

      let durationSec =
        typeof item.durationSec === "number" && item.durationSec >= 1.0
          ? Math.max(1.5, Math.min(10.0, item.durationSec))
          : typeof item.duration_sec === "number" && item.duration_sec >= 1.0
            ? Math.max(1.5, Math.min(10.0, item.duration_sec))
            : naturalDur;

      // Adjust slightly by shot type pacing
      if (shot_type === 'MACRO_TEXTURE') {
        durationSec = Math.max(paceConfig.minSec, parseFloat((durationSec * 0.85).toFixed(1)));
      } else if (shot_type === 'WIDE_ESTABLISHING' || shot_type === 'ATMOSPHERIC_MOOD') {
        durationSec = Math.min(paceConfig.maxSec, parseFloat((durationSec * 1.15).toFixed(1)));
      }

      const b_roll_focus =
        typeof item.b_roll_focus === "string" && item.b_roll_focus.trim()
          ? item.b_roll_focus.trim()
          : typeof item.bRollFocus === "string" && item.bRollFocus.trim()
            ? item.bRollFocus.trim()
            : shot_type.replace('_', ' ').toLowerCase();

      return {
        narration,
        visual_prompt: visualPrompt,
        durationSec,
        shot_type,
        b_roll_focus,
      };
    });
  } catch (error) {
    console.warn("Pollinations scene breakdown error, using dynamic sentence partition:", error);
    const sentences = script.split(/(?<=[.!?\n])\s+/).filter((s) => s.trim().length > 0);
    const targetCount = targetDurationSec && targetDurationSec > 0
      ? Math.max(1, Math.round(targetDurationSec / paceConfig.avgSec))
      : Math.max(1, Math.ceil(sentences.length / 2));
    const sceneCount = Math.max(1, Math.min(sentences.length, targetCount));
    const chunkSize = Math.max(1, Math.ceil(sentences.length / sceneCount));

    return Array.from({ length: sceneCount }, (_, idx) => {
      const slice = sentences.slice(idx * chunkSize, (idx + 1) * chunkSize);
      const narration = slice.join(" ") || `Scene ${idx + 1}`;
      const shot_type = VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];
      const words = narration.split(/\s+/).filter(Boolean).length;
      const shotFactor = shot_type === 'MACRO_TEXTURE' ? 0.85 : shot_type === 'WIDE_ESTABLISHING' ? 1.25 : 1.0;
      const dur = Math.max(
        paceConfig.minSec,
        Math.min(paceConfig.maxSec, parseFloat(((Math.max(4, words) / 2.5) * shotFactor).toFixed(1)))
      );

      return {
        narration,
        visual_prompt: `Cinematic ${shot_type.replace('_', ' ').toLowerCase()} shot, ultra detailed 8k, dramatic lighting, camera depth: ${narration.slice(0, 120)}`,
        durationSec: dur,
        shot_type,
        b_roll_focus: shot_type.replace('_', ' ').toLowerCase(),
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
 * Helper to assemble a clean final prompt without duplicating base style
 * or adding conflicting tokens.
 */
export function assembleFinalImagePrompt(
  prompt: string,
  baseStyle?: string,
  negativePrompt?: string
): string {
  const trimmedPrompt = (prompt || "").trim().replace(/\.+$/, "");
  const resolvedBaseStyle = (baseStyle && baseStyle.trim().length > 0)
    ? baseStyle.trim().replace(/\.+$/, "")
    : (getStoredGlobalBaseStyle() || "photorealistic, 8k resolution, cinematic lighting, masterpiece, hyper-detailed, sharp focus, 35mm lens");

  const resolvedNegative = (negativePrompt && negativePrompt.trim().length > 0)
    ? negativePrompt.trim()
    : (getStoredGlobalNegativePrompt() || "blurry, low resolution, distorted faces, bad anatomy, deformed limbs, pixelated, noisy, artifacts, amateur, watermark, low quality, cartoon, anime");

  let finalPrompt = trimmedPrompt;

  // Only append base style if it is not already present in the prompt
  if (resolvedBaseStyle) {
    const styleSnippet = resolvedBaseStyle.toLowerCase().slice(0, 35);
    if (!trimmedPrompt.toLowerCase().includes(styleSnippet)) {
      finalPrompt = `${trimmedPrompt}. ${resolvedBaseStyle}`;
    }
  }

  // Append negative prompt if avoid constraint isn't already included
  if (resolvedNegative && !finalPrompt.toLowerCase().includes("avoid:")) {
    finalPrompt += `, avoid: ${resolvedNegative}`;
  }

  return finalPrompt;
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

  // Assemble clean final prompt with guaranteed base style and negative constraints
  const finalPrompt = assembleFinalImagePrompt(prompt, baseStyle, options?.negativePrompt);
  const encodedPrompt = encodeURIComponent(finalPrompt);

  const resolvedSeed = typeof seed === "number" && !isNaN(seed)
    ? seed
    : (typeof options?.seed === "number" && !isNaN(options.seed) ? options.seed : Math.floor(Math.random() * 1000000));

  const model = options?.model || getStoredPollinationsImageModel();
  // MANDATORY MINIMUM RESOLUTION: Full HD (1920x1080 landscape, or 1080x1920 vertical)
  // Never generate images below 1920x1080.
  const isVertical = options?.aspectRatio === '9:16';
  const minWidth = isVertical ? 1080 : 1920;
  const minHeight = isVertical ? 1920 : 1080;
  const width = Math.max(minWidth, options?.width || minWidth);
  const height = Math.max(minHeight, options?.height || minHeight);
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

  const headers: Record<string, string> = {};

  let primaryUrl = "";
  if (apiKey && apiKey.trim().length > 0) {
    const cleanKey = apiKey.trim();
    headers["Authorization"] = `Bearer ${cleanKey}`;
    primaryUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=${nologo}&seed=${resolvedSeed}&quality=hd&key=${encodeURIComponent(cleanKey)}`;
  } else {
    // Official free endpoint that works without any authorization
    primaryUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&nologo=${nologo}&seed=${resolvedSeed}`;
  }

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


    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=${nologo}&seed=${resolvedSeed}`;
    const fallbackRes = await fetch(fallbackUrl, { method: "GET", headers });
    if (fallbackRes.ok) {
      return await fallbackRes.arrayBuffer();
    }

    throw new Error(`HTTP ${errorStatus} ${response.statusText}: ${errorText.slice(0, 200)}`);
  } catch (error) {
    // Last-resort fallback to free public endpoint with standard dimensions
    try {

      const lastResortUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;
      const lastResortRes = await fetch(lastResortUrl, { method: "GET", headers });
      if (lastResortRes.ok) {
        return await lastResortRes.arrayBuffer();
      }
    } catch {
      // ignore and let original error throw
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate scene image from Pollinations: ${message}`);
  }
}

/**
 * Splits long script text into natural semantic chunks (~120–160 words each),
 * respecting paragraph and sentence boundaries.
 */
export function splitIntoPacingChunks(text: string, targetWords = 140): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWords = 0;

  for (const para of paragraphs) {
    const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean).length;
      if (currentWords + words > targetWords && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
        currentWords = 0;
      }
      currentChunk.push(sentence);
      currentWords += words;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

/**
 * 5. breakdownRequirementToImageScenes
 * Takes user creative requirements or story prompt and breaks them down into
 * sequential visual scenes ready for image generation, without requiring voice generation.
 * Supports auto-batching for long scripts (e.g. 23+ minutes).
 */
export async function breakdownRequirementToImageScenes(
  requirement: string,
  options?: {
    sceneCount?: number;
    targetDurationSec?: number;
    stylePrompt?: string;
    apiKey?: string;
    pacingProfile?: PacingProfile;
    onProgress?: (msg: string) => void;
  }
): Promise<ScriptSceneBreakdown[]> {
  if (!requirement || !requirement.trim()) {
    throw new Error("Requirement cannot be empty.");
  }

  const words = requirement.trim().split(/\s+/).filter(Boolean).length;
  const isLongScript = !options?.sceneCount && (words > 180 || (options?.targetDurationSec && options.targetDurationSec > 90));

  // Multi-chunk batching for long scripts to prevent token truncation & enforce rich scene count
  if (isLongScript) {
    const batches = splitIntoPacingChunks(requirement, 140);
    options?.onProgress?.(`Divided into ${batches.length} sequential story batches for high-density visual extraction…`);

    const totalTargetSec = options?.targetDurationSec || Math.max(15, Math.round((words / 135) * 60));
    const allScenes: ScriptSceneBreakdown[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batchText = batches[i];
      const batchWords = batchText.split(/\s+/).filter(Boolean).length;
      const batchDurationSec = totalTargetSec > 0 ? (batchWords / words) * totalTargetSec : undefined;

      options?.onProgress?.(
        `Extracting scenes: Batch ${i + 1} of ${batches.length} (${allScenes.length} scenes created so far)…`
      );

      try {
        const batchScenes = await breakdownRequirementToImageScenesSingle(batchText, {
          ...options,
          targetDurationSec: batchDurationSec,
        });
        allScenes.push(...batchScenes);
      } catch (err) {
        console.warn(`Batch ${i + 1} extraction error, falling back to local partition:`, err);
        const fallbackBatch = await breakdownRequirementToImageScenesSingle(batchText, {
          ...options,
          targetDurationSec: batchDurationSec,
        });
        allScenes.push(...fallbackBatch);
      }
    }

    options?.onProgress?.(`Successfully generated ${allScenes.length} diverse scenes across ${batches.length} batches.`);
    return allScenes;
  }

  return breakdownRequirementToImageScenesSingle(requirement, options);
}

/** Single-batch scene breakdown */
async function breakdownRequirementToImageScenesSingle(
  requirement: string,
  options?: {
    sceneCount?: number;
    targetDurationSec?: number;
    stylePrompt?: string;
    apiKey?: string;
    pacingProfile?: PacingProfile;
  }
): Promise<ScriptSceneBreakdown[]> {
  const aiClient = getPollinationsClient(options?.apiKey);
  const targetDurationSec = options?.targetDurationSec;

  const pacing = options?.pacingProfile || 'balanced';
  const paceConfig = {
    fast: { avgSec: 2.8, minSec: 1.8, maxSec: 3.8, desc: 'Fast, punchy cutaways (1.8s - 3.8s)' },
    balanced: { avgSec: 4.0, minSec: 2.2, maxSec: 5.5, desc: 'Dynamic natural pacing (2.2s - 5.5s)' },
    cinematic: { avgSec: 5.5, minSec: 3.5, maxSec: 7.5, desc: 'Cinematic, atmospheric rhythm (3.5s - 7.5s)' },
  }[pacing];

  const estimatedScenes = targetDurationSec && targetDurationSec > 0
    ? Math.max(1, Math.round(targetDurationSec / paceConfig.avgSec))
    : undefined;

  const countInstruction = typeof options?.sceneCount === "number" && options.sceneCount > 0
    ? `Create exactly ${options.sceneCount} distinct, sequential cinematic visual scenes.`
    : targetDurationSec && targetDurationSec > 0
      ? `Generate approximately ${estimatedScenes} sequential scenes with dynamic variable lengths (${paceConfig.desc}) so that the visual timeline covers ~${Math.round(targetDurationSec)} seconds smoothly.`
      : `Determine the natural number of sequential cinematic visual scenes based directly on the story progression, key moments, and narrative beats of the content.`;

  const VALID_SHOT_TYPES: ShotType[] = [
    'AERIAL_GEOMETRY',
    'MACRO_TEXTURE',
    'CULTURAL_HUMAN',
    'HISTORICAL_HERITAGE',
    'ATMOSPHERIC_MOOD',
    'WIDE_ESTABLISHING',
  ];

  const systemInstruction = `You are an elite visual director for an AI film and documentary studio.
Your task is to take a creative requirement, story, or script and break it down into sequential, cinematographically diverse visual scenes.
${countInstruction}
${targetDurationSec && targetDurationSec > 0 ? `Target total video duration is ~${Math.round(targetDurationSec)} seconds.` : ''}

CINEMATIC PACING & UNIVERSAL B-ROLL MANDATE:
Do NOT produce repetitive or literal visuals. A professional documentary cuts dynamically between scales and perspectives:
First, analyze the core subject, ecosystem, or theme of the story (e.g. Sea, Desert, Mountain, Rainforest, Metropolis, Ancient Civilization, Deep Space, Technology, etc.).
Then, as an elite visual director, interleave 6 universal B-roll lenses tailored directly to that specific world:

1. "AERIAL_GEOMETRY": Grand scale bird's-eye (90° top-down drone or orbital satellite) revealing geometric patterns, natural contours, and vast topological scale (e.g., dune ridges in deserts, swell breaks in oceans, knife-edge mountain ridges, canopy fractals in forests, street grid networks in cities).
2. "MACRO_TEXTURE": Extreme tactile close-ups of micro details native to this environment (e.g., individual shifting sand grains, sea foam bubbles & salt crystals, glacial ice facets, moss spores & dew, weathered wood grain, microcircuit traces, stone carvings).
3. "CULTURAL_HUMAN": The human and living heartbeat connected to this world — native dwellers, explorers, artisans, workers, or inhabitants interacting authentically with the environment (e.g., nomads brewing tea in desert tents, pearl divers, mountain climbers adjusting gear, monks in cliffside shrines, street artisans).
4. "HISTORICAL_HERITAGE": Deep time, archaeology, and historical memory — ancient monuments, weathered ruins, fossil layers, petroglyphs, ancestral relics, or enduring architecture shaped by centuries.
5. "ATMOSPHERIC_MOOD": Dramatic elemental weather and lighting transitions — shifting mirages, blizzards, rolling ocean fog, dust storms, sunbeams cutting through haze, twilight silhouettes, or native wildlife in the elements.
6. "WIDE_ESTABLISHING": Majestic panoramic establishing shots that orient the viewer to the broader landscape.

CRITICAL PACING & VARIABLE DURATION RULES:
- Durations must NEVER be uniform! They must vary dynamically:
  * Short action, punchy lines, or MACRO_TEXTURE: ${paceConfig.minSec}s - ${(paceConfig.minSec + 1.2).toFixed(1)}s
  * Medium action or CULTURAL_HUMAN / HISTORICAL_HERITAGE: ${(paceConfig.avgSec - 0.5).toFixed(1)}s - ${(paceConfig.avgSec + 0.8).toFixed(1)}s
  * Panoramic scenery, AERIAL_GEOMETRY, or ATMOSPHERIC_MOOD: ${(paceConfig.avgSec + 0.8).toFixed(1)}s - ${paceConfig.maxSec}s
- Never use the same shot_type consecutively. Maintain visual rhythm.

For every scene, output:
- narration: A brief narrative or caption line (1-2 sentences) summarizing what happens in this scene.
- visual_prompt: A studio-grade, exceptionally detailed visual prompt for an AI image generator (Flux). Specifically describe subject pose/action, composition, atmospheric lighting, and rich textures${options?.stylePrompt ? ` aligned with the target visual style: "${options.stylePrompt.slice(0, 150)}..."` : ' (photorealistic 8k, masterwork, 35mm lens, sharp focus)'}.
- durationSec: Estimated duration in seconds (${paceConfig.minSec}s - ${paceConfig.maxSec}s).
- shot_type: One of "AERIAL_GEOMETRY", "MACRO_TEXTURE", "CULTURAL_HUMAN", "HISTORICAL_HERITAGE", "ATMOSPHERIC_MOOD", "WIDE_ESTABLISHING".
- b_roll_focus: A concise 3-7 word description of the specific B-roll focal motif.

CRITICAL: Return ONLY a valid JSON array of scene objects with keys "narration", "visual_prompt", "durationSec", "shot_type", "b_roll_focus".
No conversational text, markdown introduction, or backticks outside the JSON.`;

  const userPrompt = `Break down this requirement into sequential cinematic visual scenes with diverse B-roll perspectives${targetDurationSec && targetDurationSec > 0 ? ` covering approximately ${Math.round(targetDurationSec)} seconds total` : ''}:\n\n"""\n${requirement.trim()}\n"""`;

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

      const rawShotType = (typeof item.shot_type === "string" ? item.shot_type : typeof item.shotType === "string" ? item.shotType : "") as ShotType;
      const shot_type: ShotType = VALID_SHOT_TYPES.includes(rawShotType)
        ? rawShotType
        : VALID_SHOT_TYPES[index % VALID_SHOT_TYPES.length];

      const wordCount = narration.split(/\s+/).filter(Boolean).length;
      const naturalDur = wordCount > 0
        ? Math.max(paceConfig.minSec, Math.min(paceConfig.maxSec, parseFloat((wordCount / 2.5).toFixed(1))))
        : paceConfig.avgSec;

      let durationSec =
        typeof item.durationSec === "number" && item.durationSec >= 1.0
          ? Math.max(1.5, Math.min(10.0, item.durationSec))
          : typeof item.duration_sec === "number" && item.duration_sec >= 1.0
            ? Math.max(1.5, Math.min(10.0, item.duration_sec))
            : naturalDur;

      if (shot_type === 'MACRO_TEXTURE') {
        durationSec = Math.max(paceConfig.minSec, parseFloat((durationSec * 0.85).toFixed(1)));
      } else if (shot_type === 'WIDE_ESTABLISHING' || shot_type === 'ATMOSPHERIC_MOOD') {
        durationSec = Math.min(paceConfig.maxSec, parseFloat((durationSec * 1.15).toFixed(1)));
      }

      const b_roll_focus =
        typeof item.b_roll_focus === "string" && item.b_roll_focus.trim()
          ? item.b_roll_focus.trim()
          : typeof item.bRollFocus === "string" && item.bRollFocus.trim()
            ? item.bRollFocus.trim()
            : shot_type.replace('_', ' ').toLowerCase();

      return {
        narration,
        visual_prompt: visualPrompt,
        durationSec,
        shot_type,
        b_roll_focus,
      };
    });
  } catch {
    const lines = requirement.split(/(?<=[.!?\n])\s+/).filter((l) => l.trim().length > 3);
    const count = typeof options?.sceneCount === "number" && options.sceneCount > 0
      ? options.sceneCount
      : targetDurationSec && targetDurationSec > 0
        ? Math.max(1, Math.min(lines.length, Math.round(targetDurationSec / paceConfig.avgSec)))
        : Math.max(1, Math.min(25, Math.ceil(lines.length / 2)));
    const chunkSize = Math.max(1, Math.ceil(lines.length / count));

    return Array.from({ length: count }, (_, idx) => {
      const chunkText = lines.slice(idx * chunkSize, (idx + 1) * chunkSize).join(' ') || lines[idx] || `Visual Scene ${idx + 1}`;
      const shot_type = VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];
      const words = chunkText.split(/\s+/).filter(Boolean).length;
      const shotFactor = shot_type === 'MACRO_TEXTURE' ? 0.85 : shot_type === 'WIDE_ESTABLISHING' ? 1.25 : 1.0;
      const dur = Math.max(
        paceConfig.minSec,
        Math.min(paceConfig.maxSec, parseFloat(((Math.max(4, words) / 2.5) * shotFactor).toFixed(1)))
      );

      return {
        narration: chunkText,
        visual_prompt: `Cinematic ${shot_type.replace('_', ' ').toLowerCase()} movie still, photorealistic 8k, dramatic lighting: ${chunkText}`,
        durationSec: dur,
        shot_type,
        b_roll_focus: shot_type.replace('_', ' ').toLowerCase(),
      };
    });
  }
}

/**
 * 6. generateBRollPrompt
 * Re-imagines a scene's visual prompt from a specific B-Roll angle (Aerial, Macro, Cultural, Historical, etc.)
 */
export async function generateBRollPrompt(
  context: string,
  targetShotType: ShotType,
  apiKey?: string,
  stylePrompt?: string
): Promise<{ visual_prompt: string; b_roll_focus: string }> {
  const aiClient = getPollinationsClient(apiKey);

  const shotDescriptions: Record<ShotType, string> = {
    AERIAL_GEOMETRY: "Top-down 90° bird's-eye drone or satellite perspective capturing grand geometric patterns, natural contours, and vast topological scale of the environment",
    MACRO_TEXTURE: "Extreme tactile macro close-up revealing microscopic surface textures, organic details, and fine elements unique to this subject with shallow depth of field",
    CULTURAL_HUMAN: "Intimate cultural or anthropological documentary perspective showcasing native dwellers, artisans, explorers, or inhabitants interacting authentically with this world",
    HISTORICAL_HERITAGE: "Timeless archaeological, historical, or geological legacy perspective capturing ancient ruins, relics, petroglyphs, or weathered monuments connected to this subject",
    ATMOSPHERIC_MOOD: "Evocative atmospheric mood perspective capturing elemental weather, dramatic lighting shifts, fog, storms, dust, dusk silhouettes, or wildlife",
    WIDE_ESTABLISHING: "Expansive panoramic cinematic wide establishing shot showcasing the vast horizon and grand scale to anchor the viewer",
  };

  const systemInstruction = `You are a world-class documentary visual artist.
Convert the given scene context into a specific B-Roll visual prompt for an AI image generator (Flux/SDXL).
Target Shot Type: ${targetShotType} (${shotDescriptions[targetShotType]}).
${stylePrompt ? `Project Artistic Style Mandate: Strictly align camera framing, medium, and aesthetic details with the project visual style: "${stylePrompt.slice(0, 150)}..."` : 'Visual Style: Studio-grade, evocative, atmospheric lighting and textures.'}
Adapt the perspective organically to the subject's environment (e.g. desert, sea, mountain, forest, city, space, etc.).
Return ONLY a valid JSON object with:
- "visual_prompt": Studio-grade prompt detailing camera framing, subject action/elements, lighting, textures${stylePrompt ? '' : ', photorealistic 8k, masterwork'}.
- "b_roll_focus": Concise 3-6 word label of the specific focal motif.`;

  const userPrompt = `Context: "${context.trim()}"`;

  try {
    const response = await aiClient.chat.completions.create({
      model: "openai",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });
    const content = response.choices[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const cleanedJson = jsonMatch ? jsonMatch[1].trim() : content.trim();
      const parsed = JSON.parse(cleanedJson);
      if (parsed.visual_prompt) {
        return {
          visual_prompt: parsed.visual_prompt.trim(),
          b_roll_focus: parsed.b_roll_focus?.trim() || targetShotType.replace('_', ' ').toLowerCase(),
        };
      }
    }
  } catch (err) {
    console.warn("generateBRollPrompt fallback:", err);
  }

  // High quality fallback
  const cleanContext = context.slice(0, 100).trim();
  const styleSuffix = stylePrompt ? ` ${stylePrompt}` : '';
  const fallbackTemplates: Record<ShotType, { visual_prompt: string; b_roll_focus: string }> = {
    AERIAL_GEOMETRY: {
      visual_prompt: `Breathtaking 90-degree bird's-eye drone overhead shot capturing geometric contours, topological patterns, and sweeping environmental scale of: ${cleanContext}.${styleSuffix || ' Top-down cinematic photography, 8k resolution.'}`,
      b_roll_focus: "Overhead Drone Geometry",
    },
    MACRO_TEXTURE: {
      visual_prompt: `Extreme tactile macro close-up revealing intricate surface textures, micro details, and fine organic elements of: ${cleanContext}.${styleSuffix || ' Razor-sharp focus, shallow depth of field, 8k photorealistic.'}`,
      b_roll_focus: "Tactile Macro Details",
    },
    CULTURAL_HUMAN: {
      visual_prompt: `Intimate cinematic documentary shot of people, native dwellers, or travelers engaged in authentic practices related to: ${cleanContext}.${styleSuffix || ' Authentic cultural clothing, candid realism, evocative lighting.'}`,
      b_roll_focus: "Human Culture & Life",
    },
    HISTORICAL_HERITAGE: {
      visual_prompt: `Atmospheric historical documentary frame showcasing ancient architecture, weathered monuments, and archaeological relics related to: ${cleanContext}.${styleSuffix || ' Timeless chiaroscuro lighting, 35mm film look.'}`,
      b_roll_focus: "Ancient Heritage & History",
    },
    ATMOSPHERIC_MOOD: {
      visual_prompt: `Cinematic atmospheric composition capturing evocative weather, volumetric lighting, and dramatic mood transitions surrounding: ${cleanContext}.${styleSuffix || ' Poetic color grading, 8k.'}`,
      b_roll_focus: "Atmospheric Mood & Weather",
    },
    WIDE_ESTABLISHING: {
      visual_prompt: `Expansive panoramic cinematic wide establishing shot capturing the breathtaking horizon and vast environmental expanse of: ${cleanContext}.${styleSuffix || ' IMAX 70mm cinematography, dramatic sky.'}`,
      b_roll_focus: "Wide Establishing Vista",
    },
  };

  return fallbackTemplates[targetShotType];
}

/**
 * 7. generatePromptsForTimedSegments
 * Takes timed audio segments (with exact start and end times from Whisper or SRT)
 * and generates cinematic visual prompts and B-roll shot types for each scene
 * without altering the audio timing.
 */
export async function generatePromptsForTimedSegments(
  scenes: { sceneId: number; audioStartSec: number; audioEndSec: number; narrationLine: string }[],
  options?: {
    stylePrompt?: string;
    apiKey?: string;
    creativeContext?: string;
    onProgress?: (msg: string) => void;
  }
): Promise<{
  sceneId: number;
  audioStartSec: number;
  audioEndSec: number;
  narrationLine: string;
  visualPrompt: string;
  shotType: ShotType;
  bRollFocus: string;
}[]> {
  if (!scenes || scenes.length === 0) return [];

  const VALID_SHOT_TYPES: ShotType[] = [
    'AERIAL_GEOMETRY',
    'MACRO_TEXTURE',
    'CULTURAL_HUMAN',
    'HISTORICAL_HERITAGE',
    'ATMOSPHERIC_MOOD',
    'WIDE_ESTABLISHING',
  ];

  const aiClient = getPollinationsClient(options?.apiKey);
  const results: {
    sceneId: number;
    audioStartSec: number;
    audioEndSec: number;
    narrationLine: string;
    visualPrompt: string;
    shotType: ShotType;
    bRollFocus: string;
  }[] = [];

  // Batch process in chunks of 8 scenes to keep prompt size & response quality optimal
  const BATCH_SIZE = 8;
  for (let b = 0; b < scenes.length; b += BATCH_SIZE) {
    const batch = scenes.slice(b, b + BATCH_SIZE);
    const batchNum = Math.floor(b / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(scenes.length / BATCH_SIZE);

    options?.onProgress?.(`Generating cinematic visual prompts (Batch ${batchNum}/${totalBatches})…`);

    const systemPrompt = `You are an elite visual director for an AI film and documentary studio.
You are given a list of consecutive spoken narration lines from a real voiceover track, with their exact duration.
For each scene, craft an exceptional visual prompt for an AI image generator (Flux), pick a diverse shot_type, and provide a b_roll_focus.

AVAILABLE SHOT TYPES:
1. "AERIAL_GEOMETRY": Grand 90° top-down drone or orbital satellite view.
2. "MACRO_TEXTURE": Extreme tactile close-up of micro textures, organic details, or artifacts.
3. "CULTURAL_HUMAN": Authentic human life, native dwellers, artisans, or travelers.
4. "HISTORICAL_HERITAGE": Ancient monuments, relics, ruins, and deep archaeological memory.
5. "ATMOSPHERIC_MOOD": Dramatic weather, volumetric light beams, fog, or twilight mood.
6. "WIDE_ESTABLISHING": Majestic panoramic establishing vistas orienting the landscape.

MANDATE:
- Interleave different shot_types across scenes for dynamic pacing.
- visual_prompt must be studio-grade, specific, atmospheric, and cinematic${options?.stylePrompt ? ` adhering to: "${options.stylePrompt.slice(0, 120)}"` : ''}.
- Return ONLY a JSON array with objects matching:
  [ { "sceneId": number, "visual_prompt": string, "shot_type": string, "b_roll_focus": string }, ... ]`;

    const userContent = `Here are the scenes:
${JSON.stringify(
  batch.map((s) => ({
    sceneId: s.sceneId,
    durationSec: parseFloat((s.audioEndSec - s.audioStartSec).toFixed(1)),
    narration: s.narrationLine,
  })),
  null,
  2
)}${options?.creativeContext ? `\n\nOverall Creative Story Context: ${options.creativeContext.slice(0, 500)}` : ''}`;

    try {
      const response = await aiClient.chat.completions.create({
        model: "openai",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
      });

      const raw = response.choices[0]?.message?.content || "";
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const cleaned = jsonMatch ? jsonMatch[1].trim() : raw.trim();
      const parsed = JSON.parse(cleaned);

      const parsedMap = new Map<number, { visual_prompt: string; shot_type: string; b_roll_focus: string }>();
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.sceneId === "number") {
            parsedMap.set(item.sceneId, {
              visual_prompt: item.visual_prompt || item.visualPrompt || "",
              shot_type: item.shot_type || item.shotType || "",
              b_roll_focus: item.b_roll_focus || item.bRollFocus || "",
            });
          }
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const orig = batch[i];
        const match = parsedMap.get(orig.sceneId);
        const shotTypeRaw = (match?.shot_type || "") as ShotType;
        const shotType = VALID_SHOT_TYPES.includes(shotTypeRaw)
          ? shotTypeRaw
          : VALID_SHOT_TYPES[(orig.sceneId - 1) % VALID_SHOT_TYPES.length];

        const visualPrompt = match?.visual_prompt?.trim() ||
          `Cinematic documentary frame depicting: ${orig.narrationLine.slice(0, 100)}. Photorealistic 8k, 35mm lens, atmospheric volumetric lighting.`;

        const bRollFocus = match?.b_roll_focus?.trim() || shotType.replace('_', ' ').toLowerCase();

        results.push({
          sceneId: orig.sceneId,
          audioStartSec: orig.audioStartSec,
          audioEndSec: orig.audioEndSec,
          narrationLine: orig.narrationLine,
          visualPrompt,
          shotType,
          bRollFocus,
        });
      }
    } catch (batchErr) {
      console.warn(`Batch prompt generation error, using fallback prompts:`, batchErr);
      for (let i = 0; i < batch.length; i++) {
        const orig = batch[i];
        const shotType = VALID_SHOT_TYPES[(orig.sceneId - 1) % VALID_SHOT_TYPES.length];
        results.push({
          sceneId: orig.sceneId,
          audioStartSec: orig.audioStartSec,
          audioEndSec: orig.audioEndSec,
          narrationLine: orig.narrationLine,
          visualPrompt: `Cinematic frame capturing: ${orig.narrationLine.slice(0, 100)}. Photorealistic 8k, beautiful natural lighting, 35mm photography.`,
          shotType,
          bRollFocus: shotType.replace('_', ' ').toLowerCase(),
        });
      }
    }
  }

  return results;
}
