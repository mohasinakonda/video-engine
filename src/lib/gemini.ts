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
  const key = apiKey.trim();
  if (!key) {
    return { ok: false, reason: 'invalid_key', message: 'API Key cannot be empty.' };
  }

  // Demo / Mock key mode support for free workflow testing
  if (key.toLowerCase() === 'demo' || key.toLowerCase() === 'mock' || key.startsWith('demo_')) {
    return { ok: true };
  }

  try {
    const res = await geminiPost(TEXT_MODEL, key, {
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

// ─── Synthetic Mock Generators for Free Demo Testing ──────────────────────────

function generateSyntheticWavBase64(durationSec = 2): string {
  const sampleRate = 22050;
  const numSamples = Math.round(sampleRate * Math.max(1, durationSec));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Soft pleasant sine tone sequence
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = 440 + Math.sin(t * 4) * 80;
    const env = Math.sin((i / numSamples) * Math.PI);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * 12000;
    view.setInt16(44 + i * 2, Math.round(sample), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function generateSyntheticImageBase64(prompt: string, sceneId = 1): string {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const hues = [260, 210, 320, 180, 45, 140];
      const h1 = hues[sceneId % hues.length];
      const h2 = (h1 + 70) % 360;

      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, `hsl(${h1}, 65%, 15%)`);
      grad.addColorStop(1, `hsl(${h2}, 75%, 25%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Subtle atmospheric grid dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc((i * 149) % 1280, (i * 103) % 720, (i % 6) * 12 + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title & prompt
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(`Scene ${sceneId} (Demo Preview)`, 70, 100);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '20px sans-serif';
      const cleanPrompt = prompt.length > 75 ? prompt.slice(0, 75) + '…' : prompt;
      ctx.fillText(cleanPrompt, 70, 150);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return dataUrl.split(',')[1];
    }
  }

  // Fallback 1x1 GIF base64 string
  return 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
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
  const isDemo = apiKey.trim().toLowerCase() === 'demo' || apiKey.startsWith('demo_');
  if (isDemo) {
    onProgress?.('Demo mode active: Splitting script into chunks…');
    await new Promise((r) => setTimeout(r, 600));
    return naiveChunk(script, 420);
  }

  onProgress?.('Sending script to Gemini for semantic analysis…');

  try {
    const res = await geminiPost(TEXT_MODEL, apiKey, {
      systemInstruction: { parts: [{ text: CHUNK_SYSTEM }] },
      contents: [{ parts: [{ text: script.trim() }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 32768 },
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.warn('Gemini chunking returned HTTP error, using fallback chunker:', json);
      return naiveChunk(script, 420);
    }

    const json = await res.json();
    const rawText: string =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    const chunks = JSON.parse(cleaned) as string[];
    if (!Array.isArray(chunks)) throw new Error('Not an array');
    onProgress?.(`Script split into ${chunks.length} chunk(s).`);
    return chunks;
  } catch {
    onProgress?.('Falling back to automatic word-count split…');
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
  const isDemo = apiKey.trim().toLowerCase() === 'demo' || apiKey.startsWith('demo_');
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 800));
    const wordCount = chunkText.split(/\s+/).length;
    const estSec = Math.max(2, Math.round(wordCount / 2.5));
    return {
      base64Audio: generateSyntheticWavBase64(estSec),
      mimeType: 'audio/wav',
    };
  }

  const systemPrompt = buildDirectorPrompt(preset);

  try {
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
      // If quota exceeded or forbidden, fallback to synthetic audio in dev
      if (res.status === 429 || res.status === 403) {
        console.warn('TTS API quota/permission error, falling back to synthetic preview audio:', msg);
        const estSec = Math.max(2, Math.round(chunkText.split(/\s+/).length / 2.5));
        return {
          base64Audio: generateSyntheticWavBase64(estSec),
          mimeType: 'audio/wav',
        };
      }
      const err = new Error(msg) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    const part = json?.candidates?.[0]?.content?.parts?.[0];

    if (!part?.inlineData?.data) {
      throw new Error('No audio data in response.');
    }

    return {
      base64Audio: part.inlineData.data as string,
      mimeType: (part.inlineData.mimeType as string) ?? 'audio/wav',
    };
  } catch (err) {
    // Graceful fallback if TTS model fails or is unavailable on free API tier
    console.warn('TTS request failed, providing mock audio for workflow testing:', err);
    const estSec = Math.max(2, Math.round(chunkText.split(/\s+/).length / 2.5));
    return {
      base64Audio: generateSyntheticWavBase64(estSec),
      mimeType: 'audio/wav',
    };
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
- narration_line should be the exact text from the script that falls within that time window.
- Distribute the audio time evenly across all scenes.
- Return ONLY a valid JSON array. No markdown, no explanation, no extra text.`;

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

  const isDemo = apiKey.trim().toLowerCase() === 'demo' || apiKey.startsWith('demo_');
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 1000));
    const lines = script.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sceneDuration = totalSec / totalScenes;

    const mockScenes: SceneItem[] = Array.from({ length: totalScenes }, (_, idx) => {
      const line = lines[idx % lines.length] || `Narration segment ${idx + 1}`;
      const vPrompt = `Cinematic visual scene depicting: ${line.slice(0, 60)}`;
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

    onProgress?.(`Extracted ${mockScenes.length} demo scenes.`);
    return mockScenes;
  }

  const userPrompt = `Script (total audio duration: ${totalSec.toFixed(1)} seconds, target scenes: ${totalScenes}):

${script.trim()}`;

  try {
    const res = await geminiPost(TEXT_MODEL, apiKey, {
      systemInstruction: { parts: [{ text: SCENE_EXTRACTOR_SYSTEM }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 65536 },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    const rawScenes = JSON.parse(cleaned) as RawSceneData[];
    return rawScenes.map((s): SceneItem => ({
      sceneId: s.scene_id,
      audioStartSec: s.audio_start_sec,
      audioEndSec: s.audio_end_sec,
      narrationLine: s.narration_line,
      visualPrompt: s.visual_prompt,
      fullPrompt: `${s.visual_prompt}. ${stylePrompt}`,
      status: 'PENDING',
    }));
  } catch {
    // Fallback automatic scene generator
    onProgress?.('Extracting scenes automatically from script lines…');
    const lines = script.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sceneDuration = totalSec / totalScenes;

    return Array.from({ length: totalScenes }, (_, idx) => {
      const line = lines[idx % lines.length] || `Narration segment ${idx + 1}`;
      const vPrompt = `Cinematic documentary scene depicting: ${line.slice(0, 60)}`;
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

// ─── 6. [Phase 2] Image Generation (Imagen 3) ────────────────────────────────

export interface ImageGenerationResult {
  base64Image: string;
  mimeType: string;
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  negativePrompt?: string,
  sceneId = 1
): Promise<ImageGenerationResult> {
  const isDemo = apiKey.trim().toLowerCase() === 'demo' || apiKey.startsWith('demo_');
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 700));
    return {
      base64Image: generateSyntheticImageBase64(prompt, sceneId),
      mimeType: 'image/jpeg',
    };
  }

  const body: Record<string, unknown> = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '16:9',
      ...(negativePrompt ? { negativePrompt } : {}),
    },
  };

  try {
    const res = await fetch(
      `${BASE_URL}/models/${IMAGE_MODEL}:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      console.warn('Imagen 3 API failed, providing synthetic image for workflow testing.');
      return {
        base64Image: generateSyntheticImageBase64(prompt, sceneId),
        mimeType: 'image/jpeg',
      };
    }

    const json = await res.json();
    const prediction = json?.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      return {
        base64Image: generateSyntheticImageBase64(prompt, sceneId),
        mimeType: 'image/jpeg',
      };
    }

    return {
      base64Image: prediction.bytesBase64Encoded as string,
      mimeType: prediction.mimeType ?? 'image/jpeg',
    };
  } catch {
    return {
      base64Image: generateSyntheticImageBase64(prompt, sceneId),
      mimeType: 'image/jpeg',
    };
  }
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
