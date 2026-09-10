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

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = 'gemini-2.0-flash';             // Free tier — script chunking & scene extraction
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';  // Free tier — audio generation
const IMAGE_MODEL = 'imagen-3.0-generate-002';      // Imagen 3 — image generation

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
  endpoint = 'generateContent'
): Promise<Response> {
  return fetch(`${BASE_URL}/models/${model}:${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── 1. Test API Key ──────────────────────────────────────────────────────────

export async function testApiKey(apiKey: string): Promise<TestKeyResult> {
  if (!apiKey.trim()) {
    return { ok: false, reason: 'invalid_key', message: 'API Key cannot be empty.' };
  }

  try {
    const res = await geminiPost(TEXT_MODEL, apiKey, {
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

  const res = await geminiPost(TEXT_MODEL, apiKey, {
    systemInstruction: { parts: [{ text: CHUNK_SYSTEM }] },
    contents: [{ parts: [{ text: script.trim() }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 32768 },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`Chunking failed: HTTP ${res.status} — ${json?.error?.message ?? ''}`);
  }

  const json = await res.json();
  const rawText: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip markdown code fences if the model wraps in ```json
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    const chunks = JSON.parse(cleaned) as string[];
    if (!Array.isArray(chunks)) throw new Error('Not an array');
    onProgress?.(`Script split into ${chunks.length} chunk(s).`);
    return chunks;
  } catch {
    // Fallback: naive word-count split
    onProgress?.('Semantic split failed, falling back to word-count split…');
    return naiveChunk(script, 420);
  }
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
  return chunks;
}

// ─── 3. TTS Audio Generation ──────────────────────────────────────────────────

export interface AudioGenerationResult {
  /** Base64-encoded WAV audio data */
  base64Audio: string;
  mimeType: string;
}

export async function generateAudio(
  apiKey: string,
  chunkText: string,
  preset: VoicePreset
): Promise<AudioGenerationResult> {
  const systemPrompt = buildDirectorPrompt(preset);

  const res = await geminiPost(TTS_MODEL, apiKey, {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: chunkText }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: preset.voiceCharacter,
          },
        },
      },
    },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg: string = json?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.[0];

  if (!part?.inlineData?.data) {
    throw new Error('No audio data in response. Check that your API key has TTS access.');
  }

  return {
    base64Audio: part.inlineData.data as string,
    mimeType: (part.inlineData.mimeType as string) ?? 'audio/wav',
  };
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
  const totalSec = totalAudioDurationMs / 1000;
  const totalScenes = Math.round(totalSec / 3.5);

  onProgress?.(`Extracting ${totalScenes} scenes from script (${Math.round(totalSec)}s audio)…`);

  const userPrompt = `Script (total audio duration: ${totalSec.toFixed(1)} seconds, target scenes: ${totalScenes}):

${script.trim()}`;

  const res = await geminiPost(TEXT_MODEL, apiKey, {
    systemInstruction: { parts: [{ text: SCENE_EXTRACTOR_SYSTEM }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 65536 },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`Scene extraction failed: HTTP ${res.status} — ${json?.error?.message ?? ''}`);
  }

  const json = await res.json();
  const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  let rawScenes: RawSceneData[] = [];
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    rawScenes = parsed;
  } catch {
    throw new Error('Scene extraction returned invalid JSON. Please try again.');
  }

  onProgress?.(`${rawScenes.length} scenes extracted. Assembling prompts…`);

  // Map to SceneItem, appending stylePrompt to each visual_prompt
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

// ─── 6. [Phase 2] Image Generation (Imagen 3) ────────────────────────────────

export interface ImageGenerationResult {
  /** Base64-encoded image data */
  base64Image: string;
  mimeType: string;
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  negativePrompt?: string
): Promise<ImageGenerationResult> {
  const body: Record<string, unknown> = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '16:9',
      ...(negativePrompt ? { negativePrompt } : {}),
    },
  };

  const res = await fetch(
    `${BASE_URL}/models/${IMAGE_MODEL}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg: string = json?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(`Image generation failed: ${msg}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const prediction = json?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No image data returned. Ensure your API key has Imagen 3 access.');
  }

  return {
    base64Image: prediction.bytesBase64Encoded as string,
    mimeType: prediction.mimeType ?? 'image/jpeg',
  };
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

/** Estimate audio duration from WAV header (returns ms) */
export function estimateWavDurationMs(data: Uint8Array): number {
  // WAV header: bytes 24–27 = sample rate, 28–31 = byte rate
  if (data.length < 44) return 0;
  const view = new DataView(data.buffer);
  const byteRate = view.getUint32(28, true);
  const dataSize = view.getUint32(40, true);
  if (byteRate === 0) return 0;
  return Math.round((dataSize / byteRate) * 1000);
}
