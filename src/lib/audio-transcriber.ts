import type { PacingProfile, ShotType, CutPace } from '@/types';
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

export interface TimedSceneSegment {
  sceneId: number;
  audioStartSec: number;
  audioEndSec: number;
  narrationLine: string;
  shotType?: ShotType;
  bRollFocus?: string;
  visualPrompt?: string;
  cutPace?: CutPace;
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
  onProgress?: (msg: string) => void;
}

/**
 * Transcribes audio via Pollinations AI Whisper (or Groq if key provided)
 * and returns exact start/end timestamps for every spoken segment.
 */
export async function transcribeAudioWithWhisper(
  audioFile: File | Blob,
  options?: TranscribeOptions
): Promise<{ fullText: string; segments: SpokenSegment[]; words: TimedWord[] }> {
  options?.onProgress?.('Preparing audio for Whisper transcription…');

  const formData = new FormData();
  // Ensure audio has a recognized filename
  const fileName = audioFile instanceof File ? audioFile.name : 'voiceover.mp3';
  formData.append('file', audioFile, fileName);
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('prompt', 'You are a transcription assistant. Please provide accurate transcriptions of the audio file. please give me timestamp and segment based on scene')

  // Try 1: Groq Whisper if groqApiKey is provided (ultra fast ~1s)
  if (options?.groqApiKey && options.groqApiKey.trim()) {
    try {
      options?.onProgress?.('Transcribing via Groq Whisper Turbo…');
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

  // Try 2: Pollinations AI Whisper Endpoint
  options?.onProgress?.('Uploading to Pollinations AI Whisper…');
  const polKey = options?.pollinationsApiKey?.trim() || '';

  const headers: Record<string, string> = {};
  if (polKey) {
    headers['Authorization'] = `Bearer ${polKey}`;
  }

  // Pollinations models: 'openai/whisper-large-v3' or 'community/NamanSoni78/whisper-large-v3-turbo'
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

    // If model wasn't ready, try community turbo model
    if (res.status === 404 || res.status === 500) {
      options?.onProgress?.('Trying secondary Whisper model…');
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

    // Check if this word ends a sentence
    const endsWithTerminal = /[.!?]$/.test(w.word.trim());
    const isLast = i === words.length - 1;

    if (endsWithTerminal || isLast) {
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

  // Pacing configuration
  const minSceneDurationSec = {
    fast: 2.0,      // fast cuts (min 2.0s)
    balanced: 3.2,  // natural dynamic rhythm (min 3.2s)
    cinematic: 4.8, // atmospheric slow cuts (min 4.8s)
  }[pacingProfile];

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
      (currentDuration >= minSceneDurationSec && endsWithTerminalPunctuation) ||
      currentDuration >= minSceneDurationSec * 1.8
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
export async function directScenesFromAudioAndScript(
  segments: SpokenSegment[],
  options: DirectorOptions
): Promise<TimedSceneSegment[]> {
  const VALID_SHOT_TYPES: ShotType[] = [
    'AERIAL_GEOMETRY',
    'MACRO_TEXTURE',
    'CULTURAL_HUMAN',
    'HISTORICAL_HERITAGE',
    'ATMOSPHERIC_MOOD',
    'WIDE_ESTABLISHING',
  ];

  const pacing = options.pacingProfile || 'balanced';
  const effectiveScript = options.userScript?.trim() || segments.map((s) => s.text).join(' ').trim();

  // ── Word-level alignment: build real-timed sentence segments from Whisper words ──
  // When we have word-level timestamps, use them to create precise sentence segments
  // regardless of whether a script is provided. This ensures all scene timings come
  // from the actual audio, not fabricated durations.
  const hasWordTimestamps = options.words && options.words.length > 0;

  if (hasWordTimestamps) {
    options.onProgress?.('Building sentence-level segments from word timestamps…');
    const sentenceSegments = buildSentenceSegmentsFromWords(options.words!);
    console.log(`[AudioSync] Built ${sentenceSegments.length} sentence segments from ${options.words!.length} words`);

    if (sentenceSegments.length > 0) {
      // Cluster sentences into scenes using real audio timestamps
      options.onProgress?.('Clustering sentences into scenes using real audio timing…');
      const candidateScenes = clusterSegmentsIntoScenes(
        sentenceSegments,
        pacing,
        options.totalAudioDurationSec
      );
      console.log(`[AudioSync] Clustered into ${candidateScenes.length} scenes with real timestamps`);

      // Replace segments with the real-timed sentence segments
      // so the AI Director batch below uses them with real timestamps
      segments = sentenceSegments;

      // Fall through to the AI Director batch below (lines starting at "Fallback")
      // which will add visual prompts while keeping the real timestamps
    }
  }

  // If NO word timestamps AND a script is provided (or Whisper returned very few segments),
  // use the script-only path as fallback (with proportional scaling for timing).
  if (!hasWordTimestamps && effectiveScript && (options.userScript?.trim() || segments.length <= 3)) {
    options.onProgress?.('No word timestamps available — extracting scenes from script text…');
    const breakdown = await breakdownRequirementToImageScenes(effectiveScript, {
      targetDurationSec: options.totalAudioDurationSec,
      stylePrompt: options.stylePrompt,
      apiKey: options.apiKey,
      pacingProfile: options.pacingProfile,
      onProgress: options.onProgress,
    });

    options.onProgress?.(`Scaling ${breakdown.length} scenes to fit audio duration…`);

    // Proportional scaling fallback (only used when we have no word timestamps)
    const rawTotal = breakdown.reduce(
      (sum, item) => sum + (typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0),
      0
    );
    const scale = rawTotal > 0 ? options.totalAudioDurationSec / rawTotal : 1;

    let cumSec = 0;
    const finalScenes: TimedSceneSegment[] = breakdown.map((item, idx) => {
      const rawDur = typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0;
      const dur = rawDur * scale;
      const start = cumSec;
      const end = idx === breakdown.length - 1 ? options.totalAudioDurationSec : cumSec + dur;
      cumSec = end;

      const shotType = VALID_SHOT_TYPES.includes(item.shot_type as ShotType)
        ? (item.shot_type as ShotType)
        : VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];

      return {
        sceneId: idx + 1,
        audioStartSec: parseFloat(start.toFixed(1)),
        audioEndSec: parseFloat(end.toFixed(1)),
        narrationLine: item.narration,
        visualPrompt: item.visual_prompt,
        shotType,
        bRollFocus: item.b_roll_focus || shotType.replace('_', ' ').toLowerCase(),
        cutPace: 'NORMAL' as CutPace,
      };
    });

    return finalScenes;
  }

  // Fallback: If only audio was provided and Whisper returned multiple rich segments
  if (!segments || segments.length === 0) return [];

  // 1. Acoustic tempo & pause analysis
  options.onProgress?.('Analyzing voice tempo, pauses, and speech velocity…');
  const candidateScenes = clusterSegmentsIntoScenes(
    segments,
    pacing,
    options.totalAudioDurationSec
  );

  options.onProgress?.('AI Director aligning narrative beats with audio…');

  const aiClient = getPollinationsClient(options.apiKey);
  const results: TimedSceneSegment[] = [];
  const BATCH_SIZE = 8;

  for (let b = 0; b < candidateScenes.length; b += BATCH_SIZE) {
    const batch = candidateScenes.slice(b, b + BATCH_SIZE);
    const batchNum = Math.floor(b / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidateScenes.length / BATCH_SIZE);

    options.onProgress?.(`AI Director making cut & camera decisions (Batch ${batchNum}/${totalBatches})…`);

    const systemPrompt = `You are an elite, award-winning Visual Film Director and Master Video Editor.
You are given timed speech scenes extracted from a real voiceover recording (with exact audioStartSec and audioEndSec timestamps), along with the author's overall script.

YOUR DIRECTORIAL MANDATE:
For every scene, you must autonomously decide:
1. "cutPace":
   - "FAST_CUT" (1.5s - 2.5s duration): Used during rapid speech bursts, intense action beats, shocking reveals, or punchy details. Best paired with MACRO_TEXTURE or intimate dynamic cuts.
   - "NORMAL" (2.8s - 4.5s duration): Used for steady storytelling, character dialogue, human connection, cultural rituals. Best paired with CULTURAL_HUMAN or HISTORICAL_HERITAGE.
   - "ATMOSPHERIC_HOLD" (4.5s - 7.5s duration): Used for dramatic pauses, sweeping world-building, silence, or contemplation. Best paired with WIDE_ESTABLISHING or AERIAL_GEOMETRY.

2. "shotType": One of "AERIAL_GEOMETRY", "MACRO_TEXTURE", "CULTURAL_HUMAN", "HISTORICAL_HERITAGE", "ATMOSPHERIC_MOOD", "WIDE_ESTABLISHING". Interleave different perspectives for rich cinematic variety.
3. "bRollFocus": A concise 3-7 word motif description.
4. "visualPrompt": A studio-grade, breathtakingly detailed prompt for the Flux image generator. Incorporate the author's rich literary nuances and visual metaphors from the script${options.stylePrompt ? `, strictly adhering to visual style: "${options.stylePrompt.slice(0, 140)}"` : ' (cinematic 8k, 35mm lens, masterwork composition)'}.

CRITICAL:
- Keep the exact audioStartSec and audioEndSec given.
- Return ONLY a valid JSON array matching:
[
  {
    "sceneId": number,
    "cutPace": "FAST_CUT" | "NORMAL" | "ATMOSPHERIC_HOLD",
    "shotType": string,
    "bRollFocus": string,
    "visualPrompt": string
  }
]`;

    const userContent = `Here are the candidate scenes with audio durations:
${JSON.stringify(
      batch.map((s) => ({
        sceneId: s.sceneId,
        durationSec: parseFloat((s.audioEndSec - s.audioStartSec).toFixed(1)),
        narration: s.narrationLine,
      })),
      null,
      2
    )}

${options.userScript ? `Original Written Author Script:\n"""\n${options.userScript.slice(0, 2000)}\n"""` : ''}`;

    try {
      const response = await aiClient.chat.completions.create({
        model: 'openai',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
      });

      const raw = response.choices[0]?.message?.content || '';
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const cleaned = jsonMatch ? jsonMatch[1].trim() : raw.trim();
      const parsed = JSON.parse(cleaned);

      const parsedMap = new Map<
        number,
        { cutPace?: CutPace; shotType?: string; bRollFocus?: string; visualPrompt?: string }
      >();

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.sceneId === 'number') {
            parsedMap.set(item.sceneId, {
              cutPace: item.cutPace,
              shotType: item.shotType || item.shot_type,
              bRollFocus: item.bRollFocus || item.b_roll_focus,
              visualPrompt: item.visualPrompt || item.visual_prompt,
            });
          }
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const orig = batch[i];
        const match = parsedMap.get(orig.sceneId);
        const duration = orig.audioEndSec - orig.audioStartSec;

        // Determine cutPace if not provided
        let cutPace: CutPace = match?.cutPace || 'NORMAL';
        if (!match?.cutPace) {
          if (duration <= 2.5) cutPace = 'FAST_CUT';
          else if (duration >= 5.0) cutPace = 'ATMOSPHERIC_HOLD';
          else cutPace = 'NORMAL';
        }

        const shotTypeRaw = (match?.shotType || '') as ShotType;
        const shotType: ShotType = VALID_SHOT_TYPES.includes(shotTypeRaw)
          ? shotTypeRaw
          : cutPace === 'FAST_CUT'
            ? 'MACRO_TEXTURE'
            : cutPace === 'ATMOSPHERIC_HOLD'
              ? 'WIDE_ESTABLISHING'
              : VALID_SHOT_TYPES[(orig.sceneId - 1) % VALID_SHOT_TYPES.length];

        const bRollFocus = match?.bRollFocus?.trim() || shotType.replace('_', ' ').toLowerCase();

        const visualPrompt =
          match?.visualPrompt?.trim() ||
          `Cinematic documentary frame capturing: ${orig.narrationLine.slice(0, 100)}. Photorealistic 8k, evocative atmospheric lighting, 35mm lens.`;

        results.push({
          sceneId: orig.sceneId,
          audioStartSec: orig.audioStartSec,
          audioEndSec: orig.audioEndSec,
          narrationLine: orig.narrationLine,
          visualPrompt,
          shotType,
          bRollFocus,
          cutPace,
        });
      }
    } catch (err) {
      console.warn('Batch AI Director fallback:', err);
      for (let i = 0; i < batch.length; i++) {
        const orig = batch[i];
        const duration = orig.audioEndSec - orig.audioStartSec;
        const cutPace: CutPace = duration <= 2.5 ? 'FAST_CUT' : duration >= 5.0 ? 'ATMOSPHERIC_HOLD' : 'NORMAL';
        const shotType = cutPace === 'FAST_CUT' ? 'MACRO_TEXTURE' : cutPace === 'ATMOSPHERIC_HOLD' ? 'WIDE_ESTABLISHING' : VALID_SHOT_TYPES[(orig.sceneId - 1) % VALID_SHOT_TYPES.length];

        results.push({
          sceneId: orig.sceneId,
          audioStartSec: orig.audioStartSec,
          audioEndSec: orig.audioEndSec,
          narrationLine: orig.narrationLine,
          visualPrompt: `Cinematic frame capturing: ${orig.narrationLine.slice(0, 100)}. Photorealistic 8k, beautiful natural lighting.`,
          shotType,
          bRollFocus: shotType.replace('_', ' ').toLowerCase(),
          cutPace,
        });
      }
    }
  }

  return results;
}
