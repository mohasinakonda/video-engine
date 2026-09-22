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
 * 1b. callPollinationsText
 * Dispatches a chat completion prompt to Pollinations AI.
 * First tries gen.pollinations.ai/v1 if an API key is provided,
 * and automatically falls back to the 100% free text.pollinations.ai endpoint.
 */
export async function callPollinationsText(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    apiKey?: string;
    model?: string;
    temperature?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const apiKey = options?.apiKey || getStoredPollinationsKey();

  // 1. If key is provided and valid, try gen.pollinations.ai/v1
  if (apiKey && !apiKey.startsWith("AIza") && apiKey.toLowerCase() !== "pollinations") {
    try {
      const client = getPollinationsClient(apiKey);
      const res = await client.chat.completions.create({
        model: options?.model || "openai",
        messages,
        temperature: options?.temperature ?? 0.35,
      });
      const text = res.choices[0]?.message?.content;
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (err) {
      console.warn("gen.pollinations.ai chat completions failed, falling back to free text endpoint:", err);
    }
  }

  // 2. Direct free text endpoint (https://text.pollinations.ai/)
  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: options?.model || "openai",
        jsonMode: options?.jsonMode !== false,
        temperature: options?.temperature ?? 0.35,
      }),
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    }
  } catch (err) {
    console.warn("text.pollinations.ai POST failed:", err);
  }

  // 3. Fallback GET request if POST was blocked
  const userMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  if (userMsg) {
    try {
      const getRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userMsg.slice(0, 250))}`);
      if (getRes.ok) {
        const text = await getRes.text();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch {
      // ignore
    }
  }

  throw new Error("Pollinations text generation failed across all available endpoints.");
}

/**
 * Helper to safely extract an array of scene objects from LLM text output,
 * handling direct arrays, markdown code fences, and wrapped objects (e.g. { scenes: [...] }).
 */
export function parseScenesJson(rawText: string): Record<string, unknown>[] {
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.scenes)) return parsed.scenes;
      if (Array.isArray(parsed.output)) return parsed.output;
      if (Array.isArray(parsed.visual_scenes)) return parsed.visual_scenes;
      if (Array.isArray(parsed.data)) return parsed.data;
      const firstArr = Object.values(parsed).find((v) => Array.isArray(v));
      if (firstArr) return firstArr as Record<string, unknown>[];
      if (parsed.visual_prompt || parsed.visualPrompt || parsed.narration) {
        return [parsed as Record<string, unknown>];
      }
    }
  } catch {
    // 2. Regex fallback for nested array
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
  }

  throw new Error("Could not parse valid scenes JSON from LLM output.");
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
    apiKey?: string;
  }
): Promise<ScriptSceneBreakdown[]> {
  if (!script || !script.trim()) {
    throw new Error("Cannot break down an empty script.");
  }

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

  const systemInstruction = `You are an elite visual documentary director, scientific illustrator, and cinematography auteur (in the league of BBC Earth, National Geographic, and IMAX).
Your job is to parse a video narration script into a sequential list of cinematographically rich visual scenes.
${durationGuidance}

CRITICAL VISUAL RELEVANCE & ACCURACY RULES:
1. DIRECT SUBJECT & CARTOGRAPHIC RELEVANCE:
   - Visual prompts MUST depict exactly what the narration is describing at that exact moment.
   - When geographical entities, continents, maps, or global oceans are mentioned (e.g., Pangaea, Panthalassa ocean, modern 7 continents, Australia outback, Sahara desert):
     * The visual prompt MUST explicitly describe a realistic geological map, satellite orbit view from space, or cartographic diagram of that exact location.
     * Example: "Scientifically accurate 3D Earth globe satellite view of the prehistoric supercontinent Pangaea surrounded by the vast blue Panthalassa ocean, clear continental drift outlines, soft dawn lighting, 8k documentary still."
2. PALEONTOLOGICAL & CREATURE ANATOMICAL FIDELITY:
   - When the narration mentions prehistoric life or animals (e.g., Rhynchosaurs, Dicynodonts, giant amphibians, bipedal crocodile cousins, early small dinosaurs, mass extinction aftermath):
     * The visual prompt MUST accurately describe the animal's physical anatomy (beaks, armored scales, robust limbs, bipedal posture, skin textures) and its Triassic/ancient habitat.
     * Example: "Stout barrel-bodied prehistoric reptile Rhynchosaur with distinct curved beak and powerful chewing jaws, grazing on ancient ferns along a dusty Triassic flood plain, Walking with Dinosaurs BBC style, cinematic 8k."
3. RESOLVE METAPHORS (DO NOT TAKE FIGURATIVE SPEECH LITERALLY):
   - If the narration uses a comparison or metaphor (e.g., "like Arizona and Louisiana" or "like the quiet kid in the back of the classroom"):
     * DO NOT generate human classrooms, schools, modern cities, or alien planets.
     * Instead, visualize the actual scientific subject being discussed (e.g., contrasting arid red-rock canyons and humid coastal wetlands, or a timid primitive turkey-sized dinosaur lurking behind giant ferns in the shadow of huge reptiles).
4. UNIVERSAL B-ROLL SCALE VARIETY:
   - Cut dynamically across scales: WIDE_ESTABLISHING (panoramas), AERIAL_GEOMETRY (drone/satellite maps), MACRO_TEXTURE (tactile close-ups), ATMOSPHERIC_MOOD (storms/mirages), HISTORICAL_HERITAGE (deep geological time/fossils).
   - Never repeat the same shot_type twice consecutively.
5. STUDIO-GRADE PROMPT SPECIFICATION:
   - Each visual_prompt must be 35-65 words, detailing camera perspective, focal subject action, atmospheric lighting, and environment textures for an advanced image generator (Flux)${options?.stylePrompt ? ` aligned with style: "${options.stylePrompt.slice(0, 120)}..."` : ' (photorealistic 8k, masterwork, 35mm film look)'}.

CRITICAL PACING & VARIABLE DURATION RULES:
- Durations must vary dynamically based on spoken words (${paceConfig.minSec}s - ${paceConfig.maxSec}s).

For every scene, output:
- narration: The exact segment of script words read aloud during this scene.
- visual_prompt: Studio-grade prompt detailing subject, camera framing, lighting, textures.
- durationSec: Estimated duration in seconds (${paceConfig.minSec} to ${paceConfig.maxSec}).
- shot_type: One of "AERIAL_GEOMETRY", "MACRO_TEXTURE", "CULTURAL_HUMAN", "HISTORICAL_HERITAGE", "ATMOSPHERIC_MOOD", "WIDE_ESTABLISHING".
- b_roll_focus: Concise 3-6 word label of the visual focal motif.

CRITICAL: Return ONLY a valid JSON object with a "scenes" array:
{"scenes": [
  { "narration": "...", "visual_prompt": "...", "durationSec": 4.0, "shot_type": "WIDE_ESTABLISHING", "b_roll_focus": "..." }
]}`;

  const userPrompt = `Break down the following narration script into scenes with diverse, accurate visual perspectives${targetDurationSec && targetDurationSec > 0 ? ` spanning approximately ${Math.round(targetDurationSec)} seconds` : ''}:\n\n"""\n${script.trim()}\n"""`;

  try {
    const rawContent = await callPollinationsText(
      [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      {
        apiKey: options?.apiKey,
        temperature: 0.35,
        jsonMode: true,
      }
    );

    const parsedArray = parseScenesJson(rawContent);
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      throw new Error("No scenes extracted from LLM response");
    }

    return parsedArray.map((item: Record<string, unknown>, index: number) => {
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
  } catch (error) {
    console.warn("Pollinations scene breakdown error, using smart topic-aware fallback partition:", error);
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

      const lower = narration.toLowerCase();
      let contextualPrefix = `Cinematic ${shot_type.replace('_', ' ').toLowerCase()} documentary shot, photorealistic 8k, dramatic lighting:`;
      if (lower.includes("pangaea") || lower.includes("continent") || lower.includes("ocean")) {
        contextualPrefix = "Scientifically accurate 3D Earth globe satellite map showing prehistoric supercontinent Pangaea and Panthalassa ocean, continental drift outlines, 8k:";
      } else if (lower.includes("australia") || lower.includes("desert") || lower.includes("sahara")) {
        contextualPrefix = "Expansive aerial landscape of vast arid red desert sand dunes and heat haze, National Geographic documentary still, 8k:";
      } else if (lower.includes("rhynchosaur") || lower.includes("dicynodont") || lower.includes("dinosaur") || lower.includes("crocodile") || lower.includes("animal")) {
        contextualPrefix = "Paleontological reconstruction of prehistoric Triassic wildlife with accurate scales, beaks, and anatomy in ancient fern habitat, Walking with Dinosaurs style, 8k:";
      }

      return {
        narration,
        visual_prompt: `${contextualPrefix} ${narration.slice(0, 140)}`,
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
 * Splits long script text into natural semantic chunks (~60–90 words each),
 * respecting paragraph and sentence boundaries for optimal LLM context & zero token truncation.
 */
export function splitIntoPacingChunks(text: string, targetWords = 75): string[] {
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
 * Supports auto-batching for long scripts (e.g. 23+ minutes or multi-paragraph narrations).
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
  const isLongScript = !options?.sceneCount && (words > 85 || (options?.targetDurationSec && options.targetDurationSec > 40));

  // Multi-chunk batching for long scripts to prevent token truncation & enforce rich scene count
  if (isLongScript) {
    const batches = splitIntoPacingChunks(requirement, 75);
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

  const systemInstruction = `You are an elite visual documentary director, scientific illustrator, and cinematography auteur (in the league of BBC Earth, National Geographic, and IMAX).
Your task is to take a creative requirement, story, or script segment and break it down into sequential, cinematographically diverse visual scenes.
${countInstruction}
${targetDurationSec && targetDurationSec > 0 ? `Target total video duration is ~${Math.round(targetDurationSec)} seconds.` : ''}

CRITICAL VISUAL RELEVANCE & ACCURACY RULES:
1. DIRECT SUBJECT & CARTOGRAPHIC RELEVANCE:
   - Visual prompts MUST depict exactly what the narration is describing at that exact moment.
   - When geographical entities, continents, maps, or global oceans are mentioned (e.g., Pangaea, Panthalassa ocean, modern 7 continents, Australia outback, Sahara desert):
     * The visual prompt MUST explicitly describe a realistic geological map, satellite orbit view from space, or cartographic diagram of that exact location.
     * Example: "Scientifically accurate 3D Earth globe satellite view of prehistoric supercontinent Pangaea surrounded by the vast blue Panthalassa ocean, labelled continental drift outlines, soft dawn lighting, 8k documentary still."
2. PALEONTOLOGICAL & CREATURE ANATOMICAL FIDELITY:
   - When the narration mentions prehistoric life or animals (e.g., Rhynchosaurs, Dicynodonts, giant amphibians, bipedal crocodile cousins, early small dinosaurs, mass extinction aftermath):
     * The visual prompt MUST accurately describe the animal's physical anatomy (beaks, armored scales, robust limbs, bipedal posture, skin textures) and its Triassic/ancient habitat.
     * Example: "Stout barrel-bodied prehistoric reptile Rhynchosaur with distinct curved beak and powerful chewing jaws, grazing on ancient ferns along a dusty Triassic flood plain, Walking with Dinosaurs BBC style, cinematic 8k."
3. RESOLVE METAPHORS (DO NOT TAKE FIGURATIVE SPEECH LITERALLY):
   - If the narration uses a comparison or metaphor (e.g., "like Arizona and Louisiana" or "like the quiet kid in the back of the classroom"):
     * DO NOT generate human classrooms, schools, modern cities, or alien planets.
     * Instead, visualize the actual scientific subject being discussed (e.g., contrasting arid red-rock canyons and humid coastal wetlands, or a timid primitive turkey-sized dinosaur lurking behind giant ferns in the shadow of huge reptiles).
4. UNIVERSAL B-ROLL SCALE VARIETY:
   - Cut dynamically across scales: WIDE_ESTABLISHING (panoramas), AERIAL_GEOMETRY (drone/satellite maps), MACRO_TEXTURE (tactile close-ups), ATMOSPHERIC_MOOD (storms/mirages), HISTORICAL_HERITAGE (deep geological time/fossils).
   - Never repeat the same shot_type twice consecutively.
5. STUDIO-GRADE PROMPT SPECIFICATION:
   - Each visual_prompt must be 35-65 words, detailing camera perspective, focal subject action, atmospheric lighting, and environment textures for an advanced image generator (Flux)${options?.stylePrompt ? ` aligned with style: "${options.stylePrompt.slice(0, 120)}..."` : ' (photorealistic 8k, masterwork, 35mm film look)'}.

CRITICAL PACING & VARIABLE DURATION RULES:
- Durations must vary dynamically based on spoken words (${paceConfig.minSec}s - ${paceConfig.maxSec}s).

For every scene, output:
- narration: The exact segment of script words read aloud during this scene.
- visual_prompt: Studio-grade prompt detailing subject, camera framing, lighting, textures.
- durationSec: Estimated duration in seconds (${paceConfig.minSec} to ${paceConfig.maxSec}).
- shot_type: One of "AERIAL_GEOMETRY", "MACRO_TEXTURE", "CULTURAL_HUMAN", "HISTORICAL_HERITAGE", "ATMOSPHERIC_MOOD", "WIDE_ESTABLISHING".
- b_roll_focus: Concise 3-6 word label of the visual focal motif.

CRITICAL: Return ONLY a valid JSON object with a "scenes" array:
{"scenes": [
  { "narration": "...", "visual_prompt": "...", "durationSec": 4.0, "shot_type": "WIDE_ESTABLISHING", "b_roll_focus": "..." }
]}`;

  const userPrompt = `Break down this requirement into sequential cinematic visual scenes with diverse, accurate visual perspectives${targetDurationSec && targetDurationSec > 0 ? ` covering approximately ${Math.round(targetDurationSec)} seconds total` : ''}:\n\n"""\n${requirement.trim()}\n"""`;

  try {
    const rawContent = await callPollinationsText(
      [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      {
        apiKey: options?.apiKey,
        temperature: 0.35,
        jsonMode: true,
      }
    );

    const parsedArray = parseScenesJson(rawContent);
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      throw new Error("LLM output is not a non-empty JSON array of scenes.");
    }

    return parsedArray.map((item: Record<string, unknown>, index: number) => {
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
  } catch (err) {
    console.warn("Pollinations single breakdown error, using smart topic-aware fallback partition:", err);
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

      const lower = chunkText.toLowerCase();
      let contextualPrefix = `Cinematic ${shot_type.replace('_', ' ').toLowerCase()} documentary shot, photorealistic 8k, dramatic lighting:`;
      if (lower.includes("pangaea") || lower.includes("continent") || lower.includes("ocean")) {
        contextualPrefix = "Scientifically accurate 3D Earth globe satellite map showing prehistoric supercontinent Pangaea and Panthalassa ocean, continental drift outlines, 8k:";
      } else if (lower.includes("australia") || lower.includes("desert") || lower.includes("sahara")) {
        contextualPrefix = "Expansive aerial landscape of vast arid red desert sand dunes and heat haze, National Geographic documentary still, 8k:";
      } else if (lower.includes("rhynchosaur") || lower.includes("dicynodont") || lower.includes("dinosaur") || lower.includes("crocodile") || lower.includes("animal")) {
        contextualPrefix = "Paleontological reconstruction of prehistoric Triassic wildlife with accurate scales, beaks, and anatomy in ancient fern habitat, Walking with Dinosaurs style, 8k:";
      }

      return {
        narration: chunkText,
        visual_prompt: `${contextualPrefix} ${chunkText.slice(0, 140)}`,
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
  apiKey?: string
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
Adapt the perspective organically to the subject's environment (e.g. desert, sea, mountain, forest, city, space, etc.).
Return ONLY a valid JSON object with:
- "visual_prompt": Studio-grade prompt detailing camera framing, subject action/elements, lighting, textures, photorealistic 8k, masterwork.
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
  const fallbackTemplates: Record<ShotType, { visual_prompt: string; b_roll_focus: string }> = {
    AERIAL_GEOMETRY: {
      visual_prompt: `Breathtaking 90-degree bird's-eye drone overhead shot capturing geometric contours, topological patterns, and sweeping environmental scale of: ${cleanContext}. Top-down cinematic photography, 8k resolution, National Geographic style.`,
      b_roll_focus: "Overhead Drone Geometry",
    },
    MACRO_TEXTURE: {
      visual_prompt: `Extreme tactile macro close-up revealing intricate surface textures, micro details, and fine organic elements of: ${cleanContext}. Razor-sharp focus, shallow depth of field, 8k photorealistic.`,
      b_roll_focus: "Tactile Macro Details",
    },
    CULTURAL_HUMAN: {
      visual_prompt: `Intimate cinematic documentary shot of people, native dwellers, or travelers engaged in authentic practices related to: ${cleanContext}. Authentic cultural clothing, candid realism, evocative lighting.`,
      b_roll_focus: "Human Culture & Life",
    },
    HISTORICAL_HERITAGE: {
      visual_prompt: `Atmospheric historical documentary frame showcasing ancient architecture, weathered monuments, and archaeological relics related to: ${cleanContext}. Timeless chiaroscuro lighting, 35mm film look.`,
      b_roll_focus: "Ancient Heritage & History",
    },
    ATMOSPHERIC_MOOD: {
      visual_prompt: `Cinematic atmospheric composition capturing evocative weather, volumetric lighting, and dramatic mood transitions surrounding: ${cleanContext}. Poetic color grading, 8k.`,
      b_roll_focus: "Atmospheric Mood & Weather",
    },
    WIDE_ESTABLISHING: {
      visual_prompt: `Expansive panoramic cinematic wide establishing shot capturing the breathtaking horizon and vast environmental expanse of: ${cleanContext}. IMAX 70mm cinematography, dramatic sky.`,
      b_roll_focus: "Wide Establishing Vista",
    },
  };

  return fallbackTemplates[targetShotType];
}
