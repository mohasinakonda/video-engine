/**
 * gemini.ts — Google Gemini API client
 *
 * Handles:
 *  1. Connection test (validates API key + quota)
 *  2. Semantic script chunking (~380–450 words per chunk, sentence-safe)
 *  3. Multimodal TTS audio generation (returns base64 WAV data)
 *  4. Preview audio generation for voice presets
 *  5. [Phase 2] Script-to-Scene breakdown (Gemini scene extractor)
 *  6. [Phase 2] Image generation via Imagen 3 API
 */

import type { VoicePreset, SceneItem } from '@/types';
import {
  generateVoiceChunk,
  generateSceneImage,
  breakdownScriptToScenes,
  type ScriptSceneBreakdown,
} from '@/lib/pollinations';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const TEXT_MODEL = 'gemini-3.6-flash'; // Split narration & scene extraction
const TEXT_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
export const TTS_MODEL = 'gemini-2.5-pro-preview-tts'; // Voice generation
const TTS_MODELS = [
  'gemini-2.5-pro-preview-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-3.1-flash-tts-preview',
];
export const IMAGE_MODEL = 'nano-banana-2'; // Image generation (nano-banana-2 / gemini-3.1-flash-image)
const IMAGE_MODELS = [
  'nano-banana-2',
  'gemini-3.1-flash-image',
  'imagen-3.0-generate-002',
  'imagen-3.0-generate-001',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeminiError {
  code: number;
  message: string;
  status: string;
}

export type TestKeyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_key' | 'quota_exceeded' | 'network_error'; message: string };

// ─── Director System Prompt Builder ──────────────────────────────────────────

export function buildDirectorPrompt(preset: VoicePreset): string {
  const scene = preset.scene.trim() || 'Studio setting';
  const context = preset.sampleContext.trim() || 'Natural pacing';

  return `Role: Professional Voice Actor
Director Instructions:
- Scene: ${scene}
- Context & Delivery Style: ${context}
- Voice Persona: ${preset.voiceCharacter}
- Speaking Pace: ${preset.pace}x
- Accent: ${preset.accent}

Execution:
Enter the scene naturally adhering to the Scene and Context provided.
Read the provided script strictly as written. Do not add introductory remarks, greetings, or meta commentary.`;
}

// ─── Fetch Helper ─────────────────────────────────────────────────────────────

async function geminiPost(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
  endpoint = 'generateContent',
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE_URL}/models/${model}:${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function geminiTextPost(
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  let lastRes: Response | null = null;
  for (const model of TEXT_MODELS) {
    try {
      const res = await geminiPost(model, apiKey, body);
      if (res.ok) return res;
      lastRes = res;
      // If 404 (model not found), try next model
      if (res.status !== 404) {
        return res;
      }
    } catch {
      // try next model
    }
  }
  return (
    lastRes ||
    new Response(JSON.stringify({ error: { message: 'All text models failed' } }), {
      status: 404,
    })
  );
}

// ─── Pollinations Helpers ─────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function mapToPollinationsVoice(voice: string): string {
  const v = (voice || '').toLowerCase();
  if (v.includes('fenrir') || v.includes('charon') || v.includes('deep')) return 'onyx';
  if (v.includes('aoede') || v.includes('kore') || v.includes('female')) return 'nova';
  if (v.includes('puck')) return 'echo';
  if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(v)) return v;
  return 'alloy';
}

// ─── 1. Test API Key ──────────────────────────────────────────────────────────

export async function testApiKey(apiKey: string): Promise<TestKeyResult> {
  const key = apiKey.trim();
  if (!key) {
    return { ok: false, reason: 'invalid_key', message: 'API Key cannot be empty.' };
  }

  try {
    const res = await geminiTextPost(key, {
      contents: [{ parts: [{ text: 'Say "OK" in one word.' }] }],
      generationConfig: { maxOutputTokens: 8 },
    });

    if (res.ok) return { ok: true };

    const json = await res.json().catch(() => ({}));
    const errMsg: string = json?.error?.message ?? '';

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'invalid_key', message: `Invalid Key: ${errMsg}` };
    }
    if (res.status === 429) {
      return { ok: false, reason: 'quota_exceeded', message: `Quota Exceeded (429): ${errMsg}` };
    }

    return { ok: false, reason: 'network_error', message: `HTTP ${res.status}: ${errMsg}` };
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 2. Semantic Script Chunking ──────────────────────────────────────────────

const CHUNK_SYSTEM = `You are a professional script editor.
Your task is to split the given narration script into semantic chunks.

Rules:
- Each chunk must be approximately 380–450 words.
- NEVER split in the middle of a sentence or paragraph. Always end at a natural boundary.
- If the script is shorter than 380 words, return it as a single chunk.
- Return ONLY a valid JSON array of strings. Each string is one chunk.
- Do not include any explanation, markdown formatting, or extra text.`;

export async function chunkScript(
  apiKey: string,
  script: string,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  onProgress?.('Sending script to Gemini for semantic analysis…');

  try {
    const res = await geminiTextPost(apiKey, {
      systemInstruction: { parts: [{ text: CHUNK_SYSTEM }] },
      contents: [{ parts: [{ text: script.trim() }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 32768 },
    });

    if (res.ok) {
      const json = await res.json();
      const rawText: string =
        json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

      const chunks = JSON.parse(cleaned) as string[];
      if (Array.isArray(chunks) && chunks.length > 0) {
        onProgress?.(`Script split into ${chunks.length} chunk(s).`);
        return chunks;
      }
    }
  } catch (err) {
    console.warn('Gemini chunking failed, using smart word-boundary chunker:', err);
  }

  // Safe fallback chunker
  onProgress?.('Falling back to word-boundary script chunker…');
  return naiveChunk(script, 420);
}

/** Fallback chunker that splits on paragraph boundaries near the target word count */
function naiveChunk(script: string, targetWords: number): string[] {
  const paragraphs = script.split(/\n\s*\n/).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (wordCount + words > targetWords && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [];
      wordCount = 0;
    }
    current.push(para);
    wordCount += words;
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  if (chunks.length === 0 && script.trim()) chunks.push(script.trim());
  return chunks;
}

// ─── 3. TTS Audio Generation ──────────────────────────────────────────────────

export interface AudioGenerationResult {
  base64Audio: string;
  mimeType: string;
}

export async function generateAudio(
  apiKey: string,
  chunkText: string,
  preset: VoicePreset
): Promise<AudioGenerationResult> {
  const systemPrompt = buildDirectorPrompt(preset);
  const voiceName = (preset.voiceCharacter || 'Aoede').trim();
  let lastError = '';

  // Try Google Gemini TTS first if apiKey provided
  if (apiKey && apiKey.trim().length > 0) {
    const cleanKey = apiKey.trim();
    const promptText = systemPrompt
      ? `${systemPrompt}\n\nPlease speak the following script verbatim without adding any introduction or outro:\n${chunkText.trim()}`
      : chunkText.trim();

    for (const model of TTS_MODELS) {
      try {
        const res = await geminiPost(
          model,
          cleanKey,
          {
            contents: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
            },
          },
          'generateContent',
          18000
        );

        if (res.ok) {
          const json = await res.json();
          const candidates = json?.candidates || [];
          for (const cand of candidates) {
            const parts = cand?.content?.parts || [];
            for (const part of parts) {
              if (part?.inlineData?.data) {
                const rawBytes = base64ToUint8Array(part.inlineData.data as string);
                const wavBytes = pcmToWav(rawBytes, 24000);
                return {
                  base64Audio: arrayBufferToBase64(wavBytes),
                  mimeType: 'audio/wav',
                };
              }
            }
          }
          console.warn(`Gemini TTS model ${model} responded 200 but returned no inline audio data`);
        } else {
          const errJson = await res.json().catch(() => ({}));
          const errMsg: string = errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
          console.warn(`Gemini TTS model ${model} returned ${res.status}:`, errMsg);
          lastError = errMsg;

          if (res.status === 400 && errMsg.toLowerCase().includes('api key')) {
            throw new Error(`Invalid Gemini API Key: ${errMsg}`);
          }
          if (res.status === 429) {
            throw new Error(`Gemini API Quota Exceeded (429): ${errMsg}`);
          }
        }
      } catch (err) {
        if (err instanceof Error && (err.message.includes('Invalid Gemini API Key') || err.message.includes('Quota Exceeded'))) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Gemini TTS model ${model} fetch failed:`, msg);
        lastError = msg;
      }
    }
  }

  // Fallback: Free Pollinations / Web TTS
  // IMPORTANT: Do NOT pass the Gemini API key (AIza...) to Pollinations!
  try {
    const pollinationsVoice = mapToPollinationsVoice(preset.voiceCharacter);
    const audioBuffer = await generateVoiceChunk(chunkText, pollinationsVoice);
    return {
      base64Audio: arrayBufferToBase64(audioBuffer),
      mimeType: 'audio/mp3',
    };
  } catch (fallbackErr) {
    const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    if (lastError) {
      throw new Error(`Gemini Voice generation failed: ${lastError} (Fallback error: ${fallbackMsg})`);
    }
    throw new Error(`Audio generation failed: ${fallbackMsg}`);
  }
}

// ─── 4. Preview Audio Generation ─────────────────────────────────────────────

const PREVIEW_TEXT =
  'Welcome to AI Video Studio. This is a preview of your selected voice and delivery settings.';

export async function generatePreviewAudio(
  apiKey: string,
  preset: VoicePreset
): Promise<AudioGenerationResult> {
  return generateAudio(apiKey, PREVIEW_TEXT, preset);
}

// ─── 5. [Phase 2] Script-to-Scene Breakdown ──────────────────────────────────

const SCENE_EXTRACTOR_SYSTEM = `You are a professional video director and script analyst.
Your task is to break a narration script into visual scenes for a documentary video.

Rules:
- Each scene should represent approximately 3–4 seconds of narration.
- Create exactly the number of scenes specified by the totalScenes parameter.
- For each scene, provide a rich visual description (visual_prompt) that can be used to generate an AI image.
- The visual_prompt should be specific, vivid, and cinematically descriptive (composition, lighting, subject, atmosphere).
- narration_line should be the exact text from the script that falls within that time window.
- Distribute the audio time evenly across all scenes.
- Return ONLY a valid JSON array. No markdown, no explanation, no extra text.

Output format (JSON array):
[
  {
    "scene_id": 1,
    "audio_start_sec": 0.0,
    "audio_end_sec": 3.5,
    "narration_line": "exact narration text for this scene",
    "visual_prompt": "vivid visual description for image generation"
  }
]`;

export interface RawSceneData {
  scene_id: number;
  audio_start_sec: number;
  audio_end_sec: number;
  narration_line: string;
  visual_prompt: string;
}

export async function extractScenes(
  apiKey: string,
  script: string,
  totalAudioDurationMs: number,
  stylePrompt: string,
  onProgress?: (msg: string) => void
): Promise<SceneItem[]> {
  const totalSec = totalAudioDurationMs > 0 ? totalAudioDurationMs / 1000 : 30;
  const totalScenes = Math.max(1, Math.round(totalSec / 3.5));

  onProgress?.(`Extracting ${totalScenes} scenes from script (${Math.round(totalSec)}s audio)…`);

  const userPrompt = `Script (total audio duration: ${totalSec.toFixed(1)} seconds, target scenes: ${totalScenes}):

${script.trim()}`;

  // Try Google Gemini 3.6 Flash first
  try {
    const res = await geminiTextPost(apiKey, {
      systemInstruction: { parts: [{ text: SCENE_EXTRACTOR_SYSTEM }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 65536 },
    });

    if (res.ok) {
      const json = await res.json();
      const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

      const rawScenes = JSON.parse(cleaned) as RawSceneData[];
      if (Array.isArray(rawScenes) && rawScenes.length > 0) {
        onProgress?.(`${rawScenes.length} scenes extracted. Assembling prompts…`);
        return rawScenes.map((s): SceneItem => ({
          sceneId: s.scene_id,
          audioStartSec: s.audio_start_sec,
          audioEndSec: s.audio_end_sec,
          narrationLine: s.narration_line,
          visualPrompt: s.visual_prompt,
          fullPrompt: `${s.visual_prompt}. ${stylePrompt}`,
          status: 'PENDING',
        }));
      }
    }
  } catch (err) {
    console.warn('Google scene breakdown failed. Trying free Pollinations model:', err);
  }

  // Free Pollinations breakdown fallback
  try {
    onProgress?.('Extracting scenes via free AI model…');
    const breakdown = await breakdownScriptToScenes(script);
    let cumulativeSec = 0;
    return breakdown.map((item: ScriptSceneBreakdown, idx: number): SceneItem => {
      const start = cumulativeSec;
      const end = cumulativeSec + item.durationSec;
      cumulativeSec = end;
      return {
        sceneId: idx + 1,
        audioStartSec: parseFloat(start.toFixed(1)),
        audioEndSec: parseFloat(end.toFixed(1)),
        narrationLine: item.narration,
        visualPrompt: item.visual_prompt,
        fullPrompt: `${item.visual_prompt}. ${stylePrompt}`,
        status: 'PENDING',
      };
    });
  } catch (fallbackErr) {
    console.warn('Pollinations scene breakdown fallback error, using sentence boundary partition:', fallbackErr);
    const lines = script.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sceneDuration = totalSec / totalScenes;

    return Array.from({ length: totalScenes }, (_, idx) => {
      const line = lines[idx % lines.length] || `Scene ${idx + 1}`;
      const vPrompt = `Cinematic documentary scene showing: ${line.slice(0, 60)}`;
      return {
        sceneId: idx + 1,
        audioStartSec: parseFloat((idx * sceneDuration).toFixed(1)),
        audioEndSec: parseFloat(((idx + 1) * sceneDuration).toFixed(1)),
        narrationLine: line,
        visualPrompt: vPrompt,
        fullPrompt: `${vPrompt}. ${stylePrompt}`,
        status: 'PENDING',
      };
    });
  }
}

// ─── 6. [Phase 2] Image Generation (nano-banana-2 & Fallbacks) ───────────────

export interface ImageGenerationResult {
  base64Image: string;
  mimeType: string;
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  negativePrompt?: string,
  options?: { model?: string; width?: number; height?: number; seed?: number }
): Promise<ImageGenerationResult> {
  // 1. Primary: Pollinations AI (Docs: https://gen.pollinations.ai/docs#tag/image/GET/image/{prompt})
  try {
    const imageBuffer = await generateSceneImage(prompt, undefined, options?.seed, {
      negativePrompt,
      model: options?.model,
      width: options?.width,
      height: options?.height,
    });
    return {
      base64Image: arrayBufferToBase64(imageBuffer),
      mimeType: 'image/jpeg',
    };
  } catch (pollinationsErr) {
    console.warn('Pollinations image generation error, trying Gemini fallback:', pollinationsErr);
  }

  const fullPrompt = negativePrompt
    ? `${prompt}. Avoid: ${negativePrompt}`
    : prompt;

  // 2. Fallback: Gemini Native Image Models (nano-banana-2, gemini-3.1-flash-image) and Imagen 3
  if (apiKey && apiKey.trim().length > 0) {
    const cleanKey = apiKey.trim();

    for (const model of IMAGE_MODELS) {
      try {
        if (model.startsWith('imagen-')) {
          // Imagen 3 predict endpoint
          const body: Record<string, unknown> = {
            instances: [{ prompt: fullPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '16:9',
              ...(negativePrompt ? { negativePrompt } : {}),
            },
          };

          const res = await fetch(
            `${BASE_URL}/models/${model}:predict?key=${cleanKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          );

          if (res.ok) {
            const json = await res.json();
            const prediction = json?.predictions?.[0];
            if (prediction?.bytesBase64Encoded) {
              return {
                base64Image: prediction.bytesBase64Encoded as string,
                mimeType: prediction.mimeType ?? 'image/jpeg',
              };
            }
          }
        } else {
          // nano-banana-2 / gemini-3.1-flash-image via generateContent with responseModalities: ["IMAGE"]
          const body: Record<string, unknown> = {
            contents: [
              {
                parts: [{ text: fullPrompt }],
              },
            ],
            generationConfig: {
              responseModalities: ['IMAGE'],
            },
          };

          const res = await geminiPost(model, cleanKey, body, 'generateContent');

          if (res.ok) {
            const json = await res.json();
            const part = json?.candidates?.[0]?.content?.parts?.[0];
            if (part?.inlineData?.data) {
              return {
                base64Image: part.inlineData.data as string,
                mimeType: (part.inlineData.mimeType as string) ?? 'image/jpeg',
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Gemini image model ${model} error:`, err);
      }
    }
  }

  throw new Error('Image generation failed across both Pollinations and Gemini providers.');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Decode base64 audio string to a browser Blob URL for playback */
export function base64ToBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/** Decode base64 audio to Uint8Array for writing to disk */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Estimate audio duration from WAV header or MP3 bytes (returns ms) */
export function estimateWavDurationMs(data: Uint8Array): number {
  if (data.length < 44) return 0;

  // Check for valid WAV container ("RIFF" ... "WAVE")
  const isWav =
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45;

  if (isWav) {
    try {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const byteRate = view.getUint32(28, true);
      const dataSize = view.getUint32(40, true);
      if (byteRate > 0 && dataSize > 0) {
        return Math.round((dataSize / byteRate) * 1000);
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for MP3 / compressed audio (estimate at standard 128 kbps = 16 bytes/ms)
  const estimatedMs = Math.round((data.length / 16000) * 1000);
  return estimatedMs > 0 ? estimatedMs : 3000;
}

/**
 * Wraps raw 24kHz 16-bit mono PCM data in a standard 44-byte RIFF/WAVE header.
 * If data already contains a RIFF header, it is returned unchanged.
 */
export function pcmToWav(
  pcmData: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Uint8Array {
  if (
    pcmData.length >= 44 &&
    pcmData[0] === 0x52 && pcmData[1] === 0x49 && pcmData[2] === 0x46 && pcmData[3] === 0x46
  ) {
    return pcmData;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeAscii(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');

  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmData, 44);
  return wavBytes;
}
