import type { PacingProfile, ShotType, CutPace } from '@/types';
import { getPollinationsClient, breakdownRequirementToImageScenes } from '@/lib/pollinations';

export interface SpokenSegment {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
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
): Promise<{ fullText: string; segments: SpokenSegment[] }> {
  options?.onProgress?.('Preparing audio for Whisper transcription…');

  const formData = new FormData();
  // Ensure audio has a recognized filename
  const fileName = audioFile instanceof File ? audioFile.name : 'voiceover.mp3';
  formData.append('file', audioFile, fileName);
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0');

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
function normalizeWhisperResponse(data: any): { fullText: string; segments: SpokenSegment[] } {
  const fullText: string = data.text || '';
  const rawSegments = Array.isArray(data.segments) ? data.segments : [];

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
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segments: SpokenSegment[] = rawSegments.map((s: any, idx: number) => ({
    id: idx + 1,
    start: parseFloat(Number(s.start || 0).toFixed(2)),
    end: parseFloat(Number(s.end || 0).toFixed(2)),
    text: String(s.text || '').trim(),
  })).filter((s: SpokenSegment) => s.text.length > 0);

  return { fullText, segments };
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

  // If a script is provided (or if Whisper returned very few segments e.g. <= 3),
  // the script is the authoritative source for story scenes!
  if (effectiveScript && (options.userScript?.trim() || segments.length <= 3)) {
    options.onProgress?.('Extracting full story scenes from script…');
    const breakdown = await breakdownRequirementToImageScenes(effectiveScript, {
      targetDurationSec: options.totalAudioDurationSec,
      stylePrompt: options.stylePrompt,
      apiKey: options.apiKey,
      pacingProfile: options.pacingProfile,
      onProgress: options.onProgress,
    });

    options.onProgress?.(`AI Director evaluating dynamic pacing across all ${breakdown.length} scenes…`);

    const ACTION_KEYWORDS = /\b(fast|rapid|sudden|suddenly|clash|strike|run|rush|escape|shock|burst|intense|sharp|battle|action|explosion|panic)\b/i;
    const ATMOSPHERIC_KEYWORDS = /\b(vast|horizon|endless|ancient|ruins|centuries|calm|quiet|breeze|fog|mist|mountain|desert|ocean|sunset|twilight|stars|silence|peace)\b/i;

    const weightedScenes = breakdown.map((item, idx) => {
      const text = item.narration || '';
      const rawShot = item.shot_type;

      let cutPace: CutPace = 'NORMAL';
      let weight = typeof item.durationSec === 'number' && item.durationSec > 0 ? item.durationSec : 4.0;

      if (rawShot === 'MACRO_TEXTURE' || ACTION_KEYWORDS.test(text) || text.split(/\s+/).filter(Boolean).length <= 7) {
        cutPace = 'FAST_CUT';
        weight = Math.max(1.8, weight * 0.7);
      } else if (
        rawShot === 'WIDE_ESTABLISHING' ||
        rawShot === 'ATMOSPHERIC_MOOD' ||
        ATMOSPHERIC_KEYWORDS.test(text) ||
        text.split(/\s+/).filter(Boolean).length >= 22
      ) {
        cutPace = 'ATMOSPHERIC_HOLD';
        weight = Math.max(4.8, weight * 1.35);
      } else {
        cutPace = 'NORMAL';
      }

      return {
        item,
        cutPace,
        weight,
      };
    });

    const totalWeight = weightedScenes.reduce((sum, s) => sum + s.weight, 0);
    const scale = totalWeight > 0 ? options.totalAudioDurationSec / totalWeight : 1;

    let cumSec = 0;
    const finalScenes: TimedSceneSegment[] = weightedScenes.map((ws, idx) => {
      const dur = ws.weight * scale;
      const start = cumSec;
      const end = idx === weightedScenes.length - 1 ? options.totalAudioDurationSec : cumSec + dur;
      cumSec = end;

      const shotType = VALID_SHOT_TYPES.includes(ws.item.shot_type as ShotType)
        ? (ws.item.shot_type as ShotType)
        : ws.cutPace === 'FAST_CUT'
        ? 'MACRO_TEXTURE'
        : ws.cutPace === 'ATMOSPHERIC_HOLD'
        ? 'WIDE_ESTABLISHING'
        : VALID_SHOT_TYPES[idx % VALID_SHOT_TYPES.length];

      return {
        sceneId: idx + 1,
        audioStartSec: parseFloat(start.toFixed(1)),
        audioEndSec: parseFloat(end.toFixed(1)),
        narrationLine: ws.item.narration,
        visualPrompt: ws.item.visual_prompt,
        shotType,
        bRollFocus: ws.item.b_roll_focus || shotType.replace('_', ' ').toLowerCase(),
        cutPace: ws.cutPace,
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
