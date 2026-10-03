import type { PacingProfile, ShotType, CutPace, VisualSceneType, CameraMotionEffect } from '@/types';
import { getPollinationsClient, breakdownRequirementToImageScenes } from '@/lib/pollinations';

export interface SpokenSegment {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface TimedWord {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface PlannedVisualScene {
  sceneId: number;
  narration: string;
  visualPrompt: string;
  shotType?: ShotType;
  bRollFocus?: string;
  visualType?: VisualSceneType;
  cameraMotion?: CameraMotionEffect;
  durationSec: number | null;
}

export interface TimedSceneSegment {
  sceneId: number;
  audioStartSec: number;
  audioEndSec: number;
  durationSec?: number;
  narrationLine: string;
  shotType?: ShotType;
  bRollFocus?: string;
  visualPrompt?: string;
  cutPace?: CutPace;
  visualType?: VisualSceneType;
  cameraMotion?: CameraMotionEffect;
}

// ─── SRT Subtitle Parser ──────────────────────────────────────────────────────

/**
 * Converts HH:MM:SS,ms or HH:MM:SS.ms timestamp to total seconds
 */
function srtTimeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  return parseFloat(timeStr) || 0;
}

/**
 * Parses raw .SRT subtitle content into an array of SpokenSegment
 */
export function parseSrtContent(srtText: string): SpokenSegment[] {
  if (!srtText || !srtText.trim()) return [];

  // Normalize line endings
  const clean = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = clean.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  const segments: SpokenSegment[] = [];

  let idx = 0;
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Timecode line usually contains '-->'
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const [startStr, endStr] = timeLine.split('-->');
    if (!startStr || !endStr) continue;

    const startSec = srtTimeToSeconds(startStr);
    const endSec = srtTimeToSeconds(endStr);

    // Text lines are everything after the timecode line
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '') // remove HTML tags
      .trim();

    if (text && endSec > startSec) {
      idx++;
      segments.push({
        id: idx,
        start: parseFloat(startSec.toFixed(2)),
        end: parseFloat(endSec.toFixed(2)),
        text,
      });
    }
  }

  return segments;
}

// ─── Whisper Transcription ────────────────────────────────────────────────────

export interface TranscribeOptions {
  pollinationsApiKey?: string;
  groqApiKey?: string;
  language?: string;
  scriptPrompt?: string;
  onProgress?: (msg: string) => void;
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob in browser memory
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const numSamples = buffer.length;
  const sampleRate = buffer.sampleRate;
  const byteRate = sampleRate * numOfChan * 2;
  const blockAlign = numOfChan * 2;
  const dataSize = numSamples * numOfChan * 2;
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, intSample | 0, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Slices long audio (>45s) into 30s chunks using browser Web Audio API to prevent Whisper context hallucination loops
 */
async function sliceAudioInBrowser(
  audioBlob: Blob,
  chunkSec = 30
): Promise<{ blob: Blob; startOffset: number }[] | null> {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;

    if (duration <= 45) {
      await audioCtx.close().catch(() => {});
      return null;
    }

    const chunks: { blob: Blob; startOffset: number }[] = [];
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;

    for (let start = 0; start < duration; start += chunkSec) {
      const end = Math.min(duration, start + chunkSec);
      const sliceLength = Math.floor((end - start) * sampleRate);
      if (sliceLength <= 0) break;

      const sliceBuffer = audioCtx.createBuffer(numChannels, sliceLength, sampleRate);
      const startSample = Math.floor(start * sampleRate);
      for (let c = 0; c < numChannels; c++) {
        const srcChannel = audioBuffer.getChannelData(c);
        const dstChannel = sliceBuffer.getChannelData(c);
        dstChannel.set(srcChannel.subarray(startSample, startSample + sliceLength));
      }

      const wavBlob = audioBufferToWavBlob(sliceBuffer);
      chunks.push({ blob: wavBlob, startOffset: start });
    }

    await audioCtx.close().catch(() => {});
    return chunks;
  } catch (err) {
    console.warn('Browser audio slicing fallback:', err);
    return null;
  }
}

/**
 * Transcribes a single audio chunk (<=30s) with language and prompt anchoring
 */
async function transcribeSingleAudioChunk(
  audioFile: File | Blob,
  options?: TranscribeOptions
): Promise<{ fullText: string; segments: SpokenSegment[]; words: TimedWord[] }> {
  const formData = new FormData();
  const fileName = audioFile instanceof File ? audioFile.name : 'voiceover.wav';
  formData.append('file', audioFile, fileName);
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('language', options?.language || 'bn');
  if (options?.scriptPrompt) {
    formData.append('prompt', options.scriptPrompt.slice(0, 450));
  } else {
    formData.append('prompt', 'Accurate speech transcription with exact word timestamps.');
  }

  // Try 1: Internal API Route (/api/transcribe-audio) with server-side Groq/OpenAI/Pollinations
  try {
    const apiRes = await fetch('/api/transcribe-audio', {
      method: 'POST',
      body: formData,
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && (data.text || (Array.isArray(data.segments) && data.segments.length > 0))) {
        return normalizeWhisperResponse(data);
      }
    }
  } catch (apiErr) {
    console.warn('/api/transcribe-audio failed, falling back to direct endpoints:', apiErr);
  }

  // Try 2: Groq Whisper if groqApiKey is provided (ultra fast ~1s)
  if (options?.groqApiKey && options.groqApiKey.trim()) {
    try {
      formData.set('model', 'whisper-large-v3-turbo');
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.groqApiKey.trim()}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        return normalizeWhisperResponse(data);
      }
    } catch (groqErr) {
      console.warn('Groq transcription failed, falling back to Pollinations:', groqErr);
    }
  }

  // Try 3: Pollinations AI Whisper Endpoint
  const polKey = options?.pollinationsApiKey?.trim() || '';
  const headers: Record<string, string> = {};
  if (polKey) {
    headers['Authorization'] = `Bearer ${polKey}`;
  }

  formData.set('model', 'openai/whisper-large-v3');

  try {
    const res = await fetch('https://gen.pollinations.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return normalizeWhisperResponse(data);
    }

    const errText = await res.text().catch(() => '');
    let parsedErr = '';
    try {
      const json = JSON.parse(errText);
      parsedErr = json.error?.message || json.message || '';
    } catch {
      parsedErr = errText;
    }

    if (res.status === 404 || res.status === 500) {
      formData.set('model', 'community/NamanSoni78/whisper-large-v3-turbo');
      const retryRes = await fetch('https://gen.pollinations.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers,
        body: formData,
      });
      if (retryRes.ok) {
        const data = await retryRes.json();
        return normalizeWhisperResponse(data);
      }
    }

    throw new Error(parsedErr || `Whisper transcription failed with status ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Whisper Transcription Error: ${msg}`);
  }
}

/**
 * Transcribes audio via Pollinations AI Whisper (or Groq if key provided)
 * Automatically chunks audio >45s to avoid Whisper hallucination/loop voids,
 * and returns exact start/end timestamps for every spoken segment and word.
 */
export async function transcribeAudioWithWhisper(
  audioFile: File | Blob,
  options?: TranscribeOptions
): Promise<{ fullText: string; segments: SpokenSegment[]; words: TimedWord[] }> {
  options?.onProgress?.('Analyzing audio for precision Whisper transcription…');

  // If browser can slice into 30s chunks, transcribe chunk-by-chunk to prevent 30s void loops
  const chunks = await sliceAudioInBrowser(audioFile, 30);
  if (chunks && chunks.length > 1) {
    options?.onProgress?.(`Processing ${chunks.length} audio chunks for 100% timestamp precision…`);
    const allWords: TimedWord[] = [];
    const allSegments: SpokenSegment[] = [];
    let fullText = '';

    for (let i = 0; i < chunks.length; i++) {
      const { blob, startOffset } = chunks[i];
      options?.onProgress?.(
        `Transcribing voice chunk ${i + 1}/${chunks.length} (${Math.round(startOffset)}s - ${Math.round(startOffset + 30)}s)…`
      );
      const chunkResult = await transcribeSingleAudioChunk(blob, options);
      if (chunkResult.words) {
        for (const w of chunkResult.words) {
          allWords.push({
            word: w.word,
            start: parseFloat((w.start + startOffset).toFixed(3)),
            end: parseFloat((w.end + startOffset).toFixed(3)),
          });
        }
      }
      if (chunkResult.segments) {
        for (const seg of chunkResult.segments) {
          allSegments.push({
            id: allSegments.length + 1,
            start: parseFloat((seg.start + startOffset).toFixed(2)),
            end: parseFloat((seg.end + startOffset).toFixed(2)),
            text: seg.text,
          });
        }
      }
      if (chunkResult.fullText) {
        fullText += (fullText ? ' ' : '') + chunkResult.fullText;
      }
    }

    return { fullText, segments: allSegments, words: allWords };
  }

  // Single chunk transcription (for audio <= 45s)
  return transcribeSingleAudioChunk(audioFile, options);
}

/**
 * Normalizes OpenAI/Whisper verbose_json response into standardized SpokenSegment list
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeWhisperResponse(data: any): { fullText: string; segments: SpokenSegment[]; words: TimedWord[] } {
  const fullText: string = data.text || '';
  const rawSegments = Array.isArray(data.segments) ? data.segments : [];

  // Extract word-level timestamps
  const rawWords = Array.isArray(data.words) ? data.words : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const words: TimedWord[] = rawWords.map((w: any) => ({
    word: String(w.word || '').trim(),
    start: parseFloat(Number(w.start || 0).toFixed(3)),
    end: parseFloat(Number(w.end || 0).toFixed(3)),
  })).filter((w: TimedWord) => w.word.length > 0);

  if (rawSegments.length === 0 && fullText.trim()) {
    // If no segments returned, wrap full text as a single segment
    return {
      fullText,
      segments: [
        {
          id: 1,
          start: 0.0,
          end: Math.max(3.0, (data.duration as number) || 5.0),
          text: fullText.trim(),
        },
      ],
      words,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segments: SpokenSegment[] = rawSegments.map((s: any, idx: number) => ({
    id: idx + 1,
    start: parseFloat(Number(s.start || 0).toFixed(2)),
    end: parseFloat(Number(s.end || 0).toFixed(2)),
    text: String(s.text || '').trim(),
  })).filter((s: SpokenSegment) => s.text.length > 0);

  return { fullText, segments, words };
}

// ─── Build Sentence Segments from Word-Level Timestamps ───────────────────────

/**
 * Takes word-level timestamps from Whisper and groups them into sentence-level
 * SpokenSegments by splitting at sentence-ending punctuation (. ! ?).
 * Each sentence gets its real start/end from the first/last word timestamps.
 */
export function buildSentenceSegmentsFromWords(words: TimedWord[]): SpokenSegment[] {
  if (!words || words.length === 0) return [];

  const sentences: SpokenSegment[] = [];
  let currentWords: TimedWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    // Check if this word ends a sentence (supports Bengali dari '।', English '.!?', or speech pause > 350ms)
    const endsWithTerminal = /[.!?।]$/.test(w.word.trim());
    const hasPauseAfter = i < words.length - 1 && (words[i + 1].start - w.end >= 0.35);
    const hasCommaAndLength = /[,،]$/.test(w.word.trim()) && currentWords.length >= 4;
    const isLast = i === words.length - 1;

    if (endsWithTerminal || (hasPauseAfter && currentWords.length >= 3) || hasCommaAndLength || isLast) {
      if (currentWords.length > 0) {
        sentences.push({
          id: sentences.length + 1,
          start: currentWords[0].start,
          end: currentWords[currentWords.length - 1].end,
          text: currentWords.map((cw) => cw.word).join(' ').trim(),
        });
        currentWords = [];
      }
    }
  }

  return sentences;
}

// ─── Segment Clustering (Pacing Profile Aware) ────────────────────────────────

/**
 * Groups very short spoken segments into cinematic scene windows
 * based on pacingProfile, preserving exact start and end audio timecodes.
 */
export function clusterSegmentsIntoScenes(
  segments: SpokenSegment[],
  pacingProfile: PacingProfile = 'balanced',
  totalAudioDurationSec = 0
): TimedSceneSegment[] {
  if (!segments || segments.length === 0) return [];

  // Pacing configuration: dynamic narrative windows (tighter cuts for documentary & fast modes)
  const minSceneDurationSec: Record<PacingProfile, number> = {
    fast: 2.8,        // fast cuts (min 2.8s)
    transcript: 3.5,  // organic transcript cuts
    documentary: 3.8, // Vox hybrid documentary cuts (min 3.8s)
    balanced: 5.0,    // natural dynamic rhythm (min 5.0s)
    cinematic: 8.5,   // atmospheric immersive cuts (min 8.5s)
  };
  const minDur = minSceneDurationSec[pacingProfile] || 3.5;

  const clustered: TimedSceneSegment[] = [];
  let currentGroup: SpokenSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentGroup.push(seg);

    const groupStart = currentGroup[0].start;
    const groupEnd = seg.end;
    const currentDuration = groupEnd - groupStart;

    const isLastSegment = i === segments.length - 1;
    const endsWithTerminalPunctuation = /[.!?]$/.test(seg.text.trim());

    // Finalize scene if:
    // 1. Duration exceeds minimum target and ends on sentence boundary, OR
    // 2. Duration exceeds 1.8x minSceneDurationSec regardless, OR
    // 3. This is the last segment
    if (
      isLastSegment ||
      (currentDuration >= minDur && endsWithTerminalPunctuation) ||
      currentDuration >= minDur * 1.8
    ) {
      clustered.push({
        sceneId: clustered.length + 1,
        audioStartSec: parseFloat(groupStart.toFixed(1)),
        audioEndSec: parseFloat(groupEnd.toFixed(1)),
        narrationLine: currentGroup.map((s) => s.text).join(' ').trim(),
      });
      currentGroup = [];
    }
  }

  // Ensure scenes tile seamlessly and touch the end of the audio track
  if (clustered.length > 0 && totalAudioDurationSec > 0) {
    const lastScene = clustered[clustered.length - 1];
    if (lastScene.audioEndSec < totalAudioDurationSec) {
      lastScene.audioEndSec = parseFloat(totalAudioDurationSec.toFixed(1));
    }

    // Smooth any gaps between scenes (scene N start = scene N-1 end)
    for (let j = 1; j < clustered.length; j++) {
      if (clustered[j].audioStartSec !== clustered[j - 1].audioEndSec) {
        clustered[j].audioStartSec = clustered[j - 1].audioEndSec;
      }
    }
  }

  return clustered;
}

// ─── AI Director: Speech-to-Script Alignment & Dynamic Pacing ─────────────────

export interface DirectorOptions {
  userScript?: string;
  totalAudioDurationSec: number;
  targetSceneCount?: number;
  pacingProfile?: PacingProfile;
  stylePrompt?: string;
  apiKey?: string;
  onProgress?: (msg: string) => void;
  /** Word-level timestamps from Whisper for precise audio-scene alignment */
  words?: TimedWord[];
}

/**
 * Autonomous AI Director:
 * Merges Whisper audio timestamps and speech rhythm with the user's written script.
 * Analyzes speech tempo, pauses, and emotional narrative beats to autonomously decide:
 * - Scene cut points (Fast Cuts vs Normal vs Atmospheric Holds)
 * - Duration for each visual scene
 * - Studio-grade Flux visual prompts tailored to both the script and spoken narration
 * - Interleaved B-roll shot types and focus motifs
 */
/**
 * Breaks down script text into cohesive, grammatical and philosophical thought units.
 * Groups short dependent clauses (< 4 words) with their neighboring sentences
 * to produce natural, engaging visual scenes (~4.5s - 6.5s per thought).
 */
export function extractOrganicThoughtUnits(script: string, targetCount?: number): string[] {
  const rawSentences = script
    .split(/(?<=[.!?\n।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawSentences.length === 0) return [script];

  const groups: string[] = [];
  let cur: string[] = [];
  let curWordCount = 0;

  for (const s of rawSentences) {
    cur.push(s);
    curWordCount += s.split(/\s+/).filter(Boolean).length;
    if (curWordCount >= 7 || /[?!]$/.test(s) || /—$/.test(s)) {
      groups.push(cur.join(' '));
      cur = [];
      curWordCount = 0;
    }
  }
  if (cur.length > 0) {
    if (groups.length > 0 && curWordCount < 4) {
      groups[groups.length - 1] += ' ' + cur.join(' ');
    } else {
      groups.push(cur.join(' '));
    }
  }

  if (typeof targetCount === 'number' && targetCount > 0 && targetCount !== groups.length) {
    const finalScenes: string[] = [];
    for (let i = 0; i < targetCount; i++) {
      const startIdx = Math.floor((i * rawSentences.length) / targetCount);
      const endIdx = Math.floor(((i + 1) * rawSentences.length) / targetCount);
      const slice = rawSentences.slice(startIdx, Math.max(startIdx + 1, endIdx));
      finalScenes.push(slice.join(' '));
    }
    return finalScenes;
  }

  return groups;
}

/**
 * Helper to clean a word for phonetic/root matching (supports Bengali & English)
 */
export function cleanSpokenWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\u0980-\u09FF]/g, '')
    .trim();
}

// Backward-compatible alias
export const cleanBengaliWord = cleanSpokenWord;

/**
 * Helper to strip any appended visual commentary or dashes from narration
 */
export function extractSpokenNarrationLine(narration: string): string {
  if (!narration) return '';
  const clean = narration.split(/\s*(?:—|--|\s-\s)\s*/)[0];
  return clean.trim();
}

/**
 * Merges scenes shorter than minDurationSec (default 3.0s) into their adjacent
 * narrative neighbor so that no visual cuts away faster than human eye absorption.
 */
export function clusterShortScenes(
  scenes: TimedSceneSegment[],
  minDurationSec = 3.0,
  maxDurationSec = 7.5
): TimedSceneSegment[] {
  if (!scenes || scenes.length <= 1) return scenes;

  const getDur = (s: TimedSceneSegment): number =>
    typeof s.durationSec === 'number' && !isNaN(s.durationSec)
      ? s.durationSec
      : parseFloat((s.audioEndSec - s.audioStartSec).toFixed(1));

  const current = [...scenes];
  let changed = true;

  while (changed) {
    changed = false;
    let shortestIdx = -1;
    let shortestDur = Infinity;

    for (let i = 0; i < current.length; i++) {
      const d = getDur(current[i]);
      if (d < minDurationSec && d < shortestDur) {
        shortestDur = d;
        shortestIdx = i;
      }
    }

    if (shortestIdx === -1) break;

    const i = shortestIdx;
    const prev = i > 0 ? current[i - 1] : null;
    const next = i < current.length - 1 ? current[i + 1] : null;

    const prevCombined = prev ? getDur(prev) + getDur(current[i]) : Infinity;
    const nextCombined = next ? getDur(next) + getDur(current[i]) : Infinity;

    // Pick neighbor that creates a well-balanced scene <= maxDurationSec
    let mergeTargetIdx = -1;
    if (prev && next) {
      if (prevCombined <= maxDurationSec && nextCombined <= maxDurationSec) {
        mergeTargetIdx = prevCombined <= nextCombined ? i - 1 : i + 1;
      } else if (prevCombined <= maxDurationSec) {
        mergeTargetIdx = i - 1;
      } else if (nextCombined <= maxDurationSec) {
        mergeTargetIdx = i + 1;
      } else {
        mergeTargetIdx = prevCombined <= nextCombined ? i - 1 : i + 1;
      }
    } else if (prev) {
      mergeTargetIdx = i - 1;
    } else if (next) {
      mergeTargetIdx = i + 1;
    }

    if (mergeTargetIdx === -1) break;

    const lo = Math.min(i, mergeTargetIdx);
    const hi = Math.max(i, mergeTargetIdx);
    const mergedDur = parseFloat((current[hi].audioEndSec - current[lo].audioStartSec).toFixed(1));

    const mergedScene: TimedSceneSegment = {
      sceneId: current[lo].sceneId,
      audioStartSec: current[lo].audioStartSec,
      audioEndSec: current[hi].audioEndSec,
      durationSec: mergedDur,
      narrationLine: `${current[lo].narrationLine} ${current[hi].narrationLine}`.trim(),
      visualPrompt: current[lo].visualPrompt,
      shotType: getDur(current[lo]) >= getDur(current[hi]) ? current[lo].shotType : current[hi].shotType,
      bRollFocus: current[lo].bRollFocus || current[hi].bRollFocus,
      cutPace: mergedDur <= 3.2 ? 'FAST_CUT' : mergedDur >= 7.0 ? 'ATMOSPHERIC_HOLD' : 'NORMAL',
      visualType: current[lo].visualType === 'HERO_AI' || current[hi].visualType === 'HERO_AI' ? 'HERO_AI' : current[lo].visualType,
      cameraMotion: current[lo].cameraMotion,
    };

    current.splice(lo, 2, mergedScene);
    changed = true;
  }

  // Re-index scene IDs sequentially 1..N
  return current.map((s, idx) => ({
    ...s,
    sceneId: idx + 1,
  }));
}

/**
 * Step 2: Acoustic Alignment Engine
 * Matches each planned scene's narration against the real Whisper word timestamps.
 * Calculates exact audioStartSec, audioEndSec, and durationSec from acoustic reality.
 * Automatically enforces a minimum 3.0s duration per scene via narrative clustering.
 */
export function alignVisualPlanWithWhisperWords(
  plannedScenes: PlannedVisualScene[],
  whisperWords: TimedWord[],
  totalAudioSec: number,
  fallbackSegments?: SpokenSegment[],
  minSceneDurationSec = 3.0
): TimedSceneSegment[] {
  if (!plannedScenes || plannedScenes.length === 0) return [];

  const VALID_SHOT_TYPES: ShotType[] = [
    'AERIAL_GEOMETRY',
    'MACRO_TEXTURE',
    'CULTURAL_HUMAN',
    'HISTORICAL_HERITAGE',
    'ATMOSPHERIC_MOOD',
    'WIDE_ESTABLISHING',
  ];

  let prevEndSec = 0.0;
  let wordCursor = 0;
  const rawScenes: TimedSceneSegment[] = [];

  for (let idx = 0; idx < plannedScenes.length; idx++) {
    const scene = plannedScenes[idx];
    const isLastScene = idx === plannedScenes.length - 1;
    const spokenLine = extractSpokenNarrationLine(scene.narration) || scene.narration;
    const targetWords = spokenLine.split(/\s+/).map(cleanSpokenWord).filter(Boolean);

    let startSec = idx === 0 ? 0.0 : prevEndSec;
    let endSec = totalAudioSec;

    let matchedAcousticStart: number | null = null;
    let matchedAcousticEnd: number | null = null;
    let calculatedDur = 4.5;

    if (whisperWords && whisperWords.length > 0) {
      // Find matching words from whisperWords starting around wordCursor
      const matchedWords: TimedWord[] = [];
      let tempCursor = wordCursor;

      for (const tw of targetWords) {
        // Look ahead up to 12 words in transcript for phonetic/root match
        for (let look = 0; look < 12 && (tempCursor + look) < whisperWords.length; look++) {
          const cand = cleanSpokenWord(whisperWords[tempCursor + look].word);
          const isMatch =
            cand === tw ||
            (tw.length >= 3 && cand.startsWith(tw.slice(0, 3))) ||
            (cand.length >= 3 && tw.startsWith(cand.slice(0, 3))) ||
            (tw.length >= 4 && cand.length >= 4 && (cand.includes(tw.slice(0, 3)) || tw.includes(cand.slice(0, 3))));

          if (isMatch) {
            matchedWords.push(whisperWords[tempCursor + look]);
            tempCursor = tempCursor + look + 1;
            break;
          }
        }
      }

      if (matchedWords.length > 0) {
        wordCursor = tempCursor;
        matchedAcousticStart = matchedWords[0].start;
        matchedAcousticEnd = matchedWords[matchedWords.length - 1].end;

        // --- GAP DETECTION ---
        // If there's an acoustic gap >= 3.5s between prevEndSec and this scene's spoken words,
        // it means the AI plan skipped speech in the transcript. Synthesize gap scene(s).
        if (matchedAcousticStart - prevEndSec >= 3.5) {
          const gapWords = whisperWords.filter(
            (w) => w.start >= prevEndSec - 0.2 && w.end <= matchedAcousticStart! + 0.1
          );

          if (gapWords.length >= 3) {
            const gapDuration = matchedAcousticStart - prevEndSec;
            const numGapScenes = Math.max(1, Math.round(gapDuration / 5.5));
            const wordsPerGapScene = Math.ceil(gapWords.length / numGapScenes);

            for (let g = 0; g < numGapScenes; g++) {
              const slice = gapWords.slice(g * wordsPerGapScene, (g + 1) * wordsPerGapScene);
              if (slice.length === 0) continue;
              const gStart = g === 0 ? prevEndSec : slice[0].start;
              const gEnd = g === numGapScenes - 1 ? matchedAcousticStart : slice[slice.length - 1].end;
              const gDur = parseFloat((gEnd - gStart).toFixed(1));
              const gLine = slice.map((w) => w.word).join(' ').trim();

              rawScenes.push({
                sceneId: rawScenes.length + 1,
                audioStartSec: parseFloat(gStart.toFixed(1)),
                audioEndSec: parseFloat(gEnd.toFixed(1)),
                durationSec: gDur,
                narrationLine: gLine,
                visualPrompt: `${scene.visualPrompt} (Atmospheric narrative bridge: ${gLine.slice(0, 80)})`,
                shotType: VALID_SHOT_TYPES[rawScenes.length % VALID_SHOT_TYPES.length],
                bRollFocus: 'reflective transition',
                cutPace: gDur <= 3.2 ? 'FAST_CUT' : gDur >= 7.0 ? 'ATMOSPHERIC_HOLD' : 'NORMAL',
                visualType: 'STOCK_BROLL',
                cameraMotion: (['ZOOM_IN', 'ZOOM_OUT', 'PAN_LEFT', 'PAN_RIGHT'] as const)[rawScenes.length % 4],
              });
              prevEndSec = parseFloat(gEnd.toFixed(1));
            }
            startSec = prevEndSec;
          }
        }

        const spokenDurationSum = matchedWords.reduce(
          (sum, w) => sum + Math.max(0.12, w.end - w.start),
          0
        );
        const acousticSpan = Math.max(spokenDurationSum, matchedAcousticEnd - matchedAcousticStart);
        const missingWords = Math.max(0, targetWords.length - matchedWords.length);
        const estimatedMissingDur = missingWords * 0.35;
        const totalSpokenTime = acousticSpan + estimatedMissingDur;

        let breathPause = 0.2;
        if (wordCursor < whisperWords.length) {
          const nextStart = whisperWords[wordCursor].start;
          if (nextStart > matchedAcousticEnd && nextStart - matchedAcousticEnd <= 0.6) {
            breathPause = nextStart - matchedAcousticEnd;
          }
        }

        calculatedDur = Math.max(1.2, Math.min(7.5, totalSpokenTime + breathPause));
        endSec = Math.min(totalAudioSec, parseFloat((startSec + calculatedDur).toFixed(1)));
      } else {
        const estDur = Math.max(2.0, Math.min(6.0, targetWords.length * 0.38));
        endSec = Math.min(totalAudioSec, parseFloat((startSec + estDur).toFixed(1)));
      }
    } else if (fallbackSegments && fallbackSegments.length > 0) {
      const segDur = Math.max(2.0, Math.min(7.0, targetWords.length * 0.4));
      endSec = Math.min(totalAudioSec, parseFloat((startSec + segDur).toFixed(1)));
    } else {
      const dur = typeof scene.durationSec === 'number' && scene.durationSec > 0 ? scene.durationSec : 4.5;
      endSec = Math.min(totalAudioSec, parseFloat((startSec + dur).toFixed(1)));
    }

    // If it's the last planned scene and audio has remaining tail:
    if (isLastScene) {
      const remainingAudio = totalAudioSec - endSec;
      if (remainingAudio > 0 && remainingAudio <= 2.5 && (totalAudioSec - startSec) <= 7.5) {
        endSec = totalAudioSec;
      }
    }

    // Hard ceiling: No scene should ever exceed 8.0s
    if ((endSec - startSec) > 8.0) {
      endSec = parseFloat((startSec + 7.5).toFixed(1));
    }

    prevEndSec = endSec;
    const duration = parseFloat((endSec - startSec).toFixed(1));

    const shotType = VALID_SHOT_TYPES.includes(scene.shotType as ShotType)
      ? (scene.shotType as ShotType)
      : VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];

    const cutPace: CutPace = duration <= 3.2 ? 'FAST_CUT' : duration >= 7.0 ? 'ATMOSPHERIC_HOLD' : 'NORMAL';

    rawScenes.push({
      sceneId: rawScenes.length + 1,
      audioStartSec: parseFloat(startSec.toFixed(1)),
      audioEndSec: parseFloat(endSec.toFixed(1)),
      durationSec: duration,
      narrationLine: spokenLine,
      visualPrompt: scene.visualPrompt,
      shotType,
      bRollFocus: scene.bRollFocus || shotType.replace('_', ' ').toLowerCase(),
      cutPace,
      visualType: scene.visualType || ((idx % 5 === 0 || idx % 5 === 3) ? 'HERO_AI' : (idx % 5 === 4) ? 'MOTION_GRAPHIC' : 'STOCK_BROLL'),
      cameraMotion: scene.cameraMotion || (['ZOOM_IN', 'ZOOM_OUT', 'PAN_LEFT', 'PAN_RIGHT'] as const)[idx % 4],
    });
  }

  // If there is still lingering audio at the end (> 2.5s), add a graceful closing outro scene
  if (totalAudioSec - prevEndSec >= 2.5) {
    const outroDur = parseFloat((totalAudioSec - prevEndSec).toFixed(1));
    rawScenes.push({
      sceneId: rawScenes.length + 1,
      audioStartSec: parseFloat(prevEndSec.toFixed(1)),
      audioEndSec: parseFloat(totalAudioSec.toFixed(1)),
      durationSec: outroDur,
      narrationLine: '',
      visualPrompt: `${plannedScenes[plannedScenes.length - 1]?.visualPrompt || ''} (Closing fade and contemplative hold)`,
      shotType: 'WIDE_ESTABLISHING',
      bRollFocus: 'lingering horizon',
      cutPace: 'ATMOSPHERIC_HOLD',
      visualType: 'HERO_AI',
      cameraMotion: 'ZOOM_OUT',
    });
  }

  // Enforce minimum 3.0s duration per scene by merging micro-cuts
  return clusterShortScenes(rawScenes, minSceneDurationSec, 7.5);
}

/**
 * 2-Step Architecture:
 * Step 1: AI analyzes full narration script to create the visual plan (durationSec: null).
 * Step 2: Derives exact acoustic duration for each scene directly from Whisper word timestamps.
 */
export async function directScenesFromAudioAndScript(
  segments: SpokenSegment[],
  options: DirectorOptions
): Promise<TimedSceneSegment[]> {
  const effectiveScript = options.userScript?.trim() || segments.map((s) => s.text).join(' ').trim();
  const totalAudioSec = options.totalAudioDurationSec > 0 ? options.totalAudioDurationSec : 60;
  const wordsList = options.words || [];

  if (!effectiveScript) return [];

  // Step 1: AI Visual Planning (analyzes full script, sets durationSec: null)
  options.onProgress?.('Step 1: AI Director analyzing full narration script & creating visual plan…');
  const plannedBreakdown = await breakdownRequirementToImageScenes(effectiveScript, {
    sceneCount: options.targetSceneCount,
    stylePrompt: options.stylePrompt,
    apiKey: options.apiKey,
    pacingProfile: options.pacingProfile,
    onProgress: options.onProgress,
  });

  // Step 2: Acoustic Alignment from Whisper Word Timestamps
  const wordCount = wordsList.length;
  options.onProgress?.(
    wordCount > 0
      ? `Step 2: Extracting exact scene durations from ${wordCount} voice transcript words…`
      : 'Step 2: Aligning scene durations directly from voice transcript timestamps…'
  );

  const plannedScenes: PlannedVisualScene[] = plannedBreakdown.map((item, idx) => ({
    sceneId: idx + 1,
    narration: item.narration,
    visualPrompt: item.visual_prompt,
    shotType: item.shot_type,
    bRollFocus: item.b_roll_focus,
    visualType: item.visual_type,
    cameraMotion: item.camera_motion,
    durationSec: null, // As requested in Step 1: duration is null in the visual plan!
  }));

  const synchronizedScenes = alignVisualPlanWithWhisperWords(plannedScenes, wordsList, totalAudioSec, segments);
  options.onProgress?.(`Successfully synchronized ${synchronizedScenes.length} scenes with 100% exact voice transcript timing.`);
  return synchronizedScenes;
}
