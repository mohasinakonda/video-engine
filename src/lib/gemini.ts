/**
 * gemini.ts — AI Engine (Powered 100% by Pollinations AI)
 *
 * Provides:
 *  1. Connection test (Pollinations AI status)
 *  2. Semantic script chunking via Pollinations text & natural paragraph boundaries
 *  3. Voice audio generation via Pollinations Audio TTS
 *  4. Preview audio generation for voice presets
 *  5. Script-to-Scene extraction with visual prompts via Pollinations AI
 *  6. Image generation via Pollinations AI (FLUX, Z-Image, DreamShaper, etc.)
 */

import type { VoicePreset, SceneItem } from '@/types';
import {
  generateVoiceChunk,
  generateSceneImage,
  breakdownScriptToScenes,
  getPollinationsClient,
  type ScriptSceneBreakdown,
} from '@/lib/pollinations';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TEXT_MODEL = 'pollinations-text'; // Script chunking & scene extraction
export const TTS_MODEL = 'pollinations-audio'; // Voice generation
export const IMAGE_MODEL = 'flux'; // Primary image generation engine

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeminiError {
  code: number;
  message: string;
  status: string;
}

export type TestKeyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_key' | 'quota_exceeded' | 'network_error'; message: string };

export interface AudioGenerationResult {
  base64Audio: string;
  mimeType: string;
}

export interface ImageGenerationResult {
  base64Image: string;
  mimeType: string;
}

export interface RawSceneData {
  scene_id: number;
  audio_start_sec: number;
  audio_end_sec: number;
  narration_line: string;
  visual_prompt: string;
}

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
  const key = (apiKey || '').trim();
  if (!key) {
    // Pollinations AI is free and requires no API key by default
    return { ok: true };
  }

  try {
    const client = getPollinationsClient(key);
    const res = await client.chat.completions.create({
      model: 'openai',
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 5,
    });
    if (res.choices?.[0]?.message?.content) {
      return { ok: true };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      return { ok: false, reason: 'invalid_key', message: 'Invalid Pollinations API Key. Check enter.pollinations.ai/keys' };
    }
    // Don't block user on network hiccups for free tier
    return { ok: true };
  }
}

// ─── 2. Semantic Script Chunking (Pollinations AI) ──────────────────────────

export async function chunkScript(
  apiKey: string,
  script: string,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  onProgress?.('Analyzing script structure with Pollinations AI…');

  const trimmed = script.trim();
  if (!trimmed) return [];

  // Try Pollinations LLM if user provided key or client is available
  try {
    const client = getPollinationsClient(apiKey);
    const response = await client.chat.completions.create({
      model: 'openai',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional script editor. Split the provided narration script into natural narration chunks (~350–450 words each). Never split in the middle of a sentence. Return ONLY a valid JSON array of strings.',
        },
        { role: 'user', content: trimmed },
      ],
      temperature: 0.2,
    });

    const content = response.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const cleaned = jsonMatch ? jsonMatch[1].trim() : content.trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        onProgress?.(`Script split into ${parsed.length} semantic chunk(s).`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Pollinations LLM chunking skipped, using smart boundary chunker:', err);
  }

  // Safe fallback chunker: Splits on paragraph and sentence boundaries near 400 words
  onProgress?.('Splitting script on natural sentence boundaries…');
  return naiveChunk(trimmed, 400);
}

/** Fallback chunker that splits on paragraph boundaries near target word count */
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

// ─── 3. TTS Audio Generation (Pollinations AI) ───────────────────────────────

export async function generateAudio(
  apiKey: string,
  chunkText: string,
  preset: VoicePreset
): Promise<AudioGenerationResult> {
  const voice = mapToPollinationsVoice(preset.voiceCharacter);

  try {
    const audioBuffer = await generateVoiceChunk(chunkText, voice, apiKey);
    return {
      base64Audio: arrayBufferToBase64(audioBuffer),
      mimeType: 'audio/mp3',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Pollinations Audio generation failed: ${msg}`);
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

// ─── 5. Script-to-Scene Breakdown (Pollinations AI) ─────────────────────────

export async function extractScenes(
  apiKey: string,
  script: string,
  totalAudioDurationMs: number,
  stylePrompt: string,
  onProgress?: (msg: string) => void
): Promise<SceneItem[]> {
  const totalSec = totalAudioDurationMs > 0 ? totalAudioDurationMs / 1000 : 30;
  const targetScenes = Math.max(1, Math.round(totalSec / 3.5));

  onProgress?.(`Extracting visual scenes via Pollinations AI…`);

  try {
    const client = getPollinationsClient(apiKey);
    const breakdown = await breakdownScriptToScenes(script, client);

    let cumulativeSec = 0;
    const items = breakdown.map((item: ScriptSceneBreakdown, idx: number): SceneItem => {
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

    if (items.length > 0) {
      onProgress?.(`${items.length} scenes extracted.`);
      return items;
    }
  } catch (err) {
    console.warn('Pollinations scene breakdown error, using sentence boundary partition:', err);
  }

  // Graceful sentence partition
  const lines = script.split(/(?<=[.!?])\s+/).filter(Boolean);
  const sceneDuration = totalSec / targetScenes;

  return Array.from({ length: targetScenes }, (_, idx) => {
    const line = lines[idx % lines.length] || `Scene ${idx + 1}`;
    const vPrompt = `Cinematic documentary scene showing: ${line.slice(0, 80)}`;
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

// ─── 6. Image Generation (Pollinations AI) ──────────────────────────────────

export async function generateImage(
  apiKey: string,
  prompt: string,
  negativePrompt?: string,
  options?: { model?: string; width?: number; height?: number; seed?: number }
): Promise<ImageGenerationResult> {
  const imageBuffer = await generateSceneImage(prompt, undefined, options?.seed, {
    negativePrompt,
    model: options?.model,
    width: options?.width,
    height: options?.height,
    apiKey,
  });

  return {
    base64Image: arrayBufferToBase64(imageBuffer),
    mimeType: 'image/jpeg',
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

/** Convert ArrayBuffer to Base64 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
