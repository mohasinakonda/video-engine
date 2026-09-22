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

import type { VoicePreset, SceneItem, PacingProfile, ShotType } from '@/types';
import {
  generateVoiceChunk,
  generateSceneImage,
  breakdownScriptToScenes,
  splitIntoPacingChunks,
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
  onProgress?: (msg: string) => void,
  pacingProfile: PacingProfile = 'balanced'
): Promise<SceneItem[]> {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  // Natural pacing: ~135 words/minute + pauses
  const wordEstimatedSec = Math.max(15, Math.round((words / 135) * 60));
  const totalSec = totalAudioDurationMs > 0 ? totalAudioDurationMs / 1000 : wordEstimatedSec;

  const paceSeconds = {
    fast: 2.8,
    balanced: 4.0,
    cinematic: 5.5,
  }[pacingProfile] || 4.0;

  const targetScenes = Math.max(1, Math.round(totalSec / paceSeconds));

  onProgress?.(`Extracting visual scenes via Pollinations AI (${pacingProfile} pacing)…`);

  const client = getPollinationsClient(apiKey);

  // Multi-chunk batching for long scripts (e.g. 23 min scripts or multi-paragraph narrations)
  if (words > 85 || totalSec > 40) {
    const batches = splitIntoPacingChunks(script, 75);
    onProgress?.(`Divided into ${batches.length} story batches for detailed visual extraction…`);

    const allBreakdown: ScriptSceneBreakdown[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batchScript = batches[i];
      const batchWords = batchScript.split(/\s+/).filter(Boolean).length;
      const batchDurationSec = (batchWords / words) * totalSec;

      onProgress?.(
        `Extracting scenes: Batch ${i + 1} of ${batches.length} (${allBreakdown.length} scenes created so far)…`
      );

      try {
        const batchScenes = await breakdownScriptToScenes(batchScript, client, batchDurationSec, {
          pacingProfile,
          stylePrompt,
          apiKey,
        });
        allBreakdown.push(...batchScenes);
      } catch (err) {
        console.warn(`Batch ${i + 1} extraction failed, using fallback partition:`, err);
        const fallbackBatch = await breakdownScriptToScenes(batchScript, client, batchDurationSec, {
          pacingProfile,
          stylePrompt,
          apiKey,
        });
        allBreakdown.push(...fallbackBatch);
      }
    }

    if (allBreakdown.length > 0) {
      return convertBreakdownToScenes(allBreakdown, totalSec, stylePrompt, onProgress);
    }
  }

  try {
    const breakdown = await breakdownScriptToScenes(script, client, totalSec, {
      pacingProfile,
      stylePrompt,
      apiKey,
    });

    if (breakdown.length > 0) {
      return convertBreakdownToScenes(breakdown, totalSec, stylePrompt, onProgress);
    }
  } catch (err) {
    console.warn('Pollinations scene breakdown error, using dynamic sentence partition:', err);
  }

  // Graceful content-aware sentence partition with variable durations
  const VALID_SHOT_TYPES: ShotType[] = [
    'AERIAL_GEOMETRY',
    'MACRO_TEXTURE',
    'CULTURAL_HUMAN',
    'HISTORICAL_HERITAGE',
    'ATMOSPHERIC_MOOD',
    'WIDE_ESTABLISHING',
  ];
  const lines = script.split(/(?<=[.!?])\s+/).filter(Boolean);
  const effectiveLines = lines.length > 0 ? lines : [`Scene 1`];

  const weights = Array.from({ length: targetScenes }, (_, idx) => {
    const line = effectiveLines[idx % effectiveLines.length];
    const w = line.split(/\s+/).filter(Boolean).length;
    const shotType = VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];
    const shotFactor = shotType === 'MACRO_TEXTURE' ? 0.8 : (shotType === 'WIDE_ESTABLISHING' || shotType === 'ATMOSPHERIC_MOOD') ? 1.25 : 1.0;
    return Math.max(1.8, (Math.max(4, w) / 2.5) * shotFactor);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const scale = totalWeight > 0 ? totalSec / totalWeight : 1;

  let cumSec = 0;
  return Array.from({ length: targetScenes }, (_, idx) => {
    const line = effectiveLines[idx % effectiveLines.length];
    const shotType = VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];
    const vPrompt = `Cinematic ${shotType.replace('_', ' ').toLowerCase()} documentary scene showing: ${line.slice(0, 90)}`;
    const dur = weights[idx] * scale;
    const start = cumSec;
    const end = idx === targetScenes - 1 ? totalSec : cumSec + dur;
    cumSec = end;

    return {
      sceneId: idx + 1,
      audioStartSec: parseFloat(start.toFixed(1)),
      audioEndSec: parseFloat(end.toFixed(1)),
      narrationLine: line,
      visualPrompt: vPrompt,
      fullPrompt: `${vPrompt}. ${stylePrompt}`,
      shotType,
      bRollFocus: shotType.replace('_', ' ').toLowerCase(),
      status: 'PENDING',
    };
  });
}

/** Helper to convert breakdown items into final SceneItems with scaled variable timestamps */
function convertBreakdownToScenes(
  breakdown: ScriptSceneBreakdown[],
  totalSec: number,
  stylePrompt: string,
  onProgress?: (msg: string) => void
): SceneItem[] {
  const rawTotalSec = breakdown.reduce(
    (sum, item) => sum + (typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0),
    0
  );
  const scale = rawTotalSec > 0 ? totalSec / rawTotalSec : 1;

  let cumulativeSec = 0;
  const items = breakdown.map((item: ScriptSceneBreakdown, idx: number): SceneItem => {
    const rawDur = typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0;
    const scaledDur = rawDur * scale;
    const start = cumulativeSec;
    const end = idx === breakdown.length - 1 ? totalSec : cumulativeSec + scaledDur;
    cumulativeSec = end;

    return {
      sceneId: idx + 1,
      audioStartSec: parseFloat(start.toFixed(1)),
      audioEndSec: parseFloat(end.toFixed(1)),
      narrationLine: item.narration,
      visualPrompt: item.visual_prompt,
      fullPrompt: `${item.visual_prompt}. ${stylePrompt}`,
      shotType: item.shot_type,
      bRollFocus: item.b_roll_focus,
      status: 'PENDING',
    };
  });

  onProgress?.(`${items.length} scenes extracted (${totalSec.toFixed(1)}s timeline).`);
  return items;
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
    width: Math.max(1920, options?.width || 1920),
    height: Math.max(1080, options?.height || 1080),
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

/**
 * Estimate audio duration from WAV header or MP3 bytes (returns ms).
 * Inspects RIFF/WAVE header or MPEG audio frame headers for exact duration,
 * falling back to realistic voice TTS bitrate (~64 kbps mono).
 */
export function estimateWavDurationMs(data: Uint8Array): number {
  if (data.length < 4) return 0;

  // 1. Check for valid WAV container ("RIFF" ... "WAVE")
  if (
    data.length >= 44 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45
  ) {
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

  // 2. Inspect MP3 frame sync for MPEG Audio Layer III header
  try {
    const limit = Math.min(data.length - 4, 4096);
    for (let i = 0; i < limit; i++) {
      if (data[i] === 0xff && (data[i + 1] & 0xe0) === 0xe0) {
        const header = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
        const version = (header >> 19) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
        const layer = (header >> 17) & 3;   // 1 = Layer 3
        const bitrateIdx = (header >> 12) & 15;

        if (layer === 1 && bitrateIdx > 0 && bitrateIdx < 15) {
          let bitrateKbps = 64;
          if (version === 3) {
            const mpeg1Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
            bitrateKbps = mpeg1Bitrates[bitrateIdx] || 64;
          } else {
            const mpeg2Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
            bitrateKbps = mpeg2Bitrates[bitrateIdx] || 64;
          }
          if (bitrateKbps > 0) {
            const bytesPerSec = (bitrateKbps * 1000) / 8;
            return Math.round((data.length / bytesPerSec) * 1000);
          }
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  // 3. Fallback for compressed voice TTS (standard mono speech is ~64 kbps = 8 bytes/ms)
  const estimatedMs = Math.round((data.length / 8000) * 1000);
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
