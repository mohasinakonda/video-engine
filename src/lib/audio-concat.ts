/**
 * audio-concat.ts
 *
 * Combine per-chunk TTS audio into one playable file.
 *
 * Frame-based formats (MP3/Opus) concatenate cleanly as raw bytes.
 * WAV is a RIFF container: one header declares the total data length, so
 * appending whole WAV files end-to-end yields an invalid file — players stop
 * after the first chunk or reject it outright. For WAV we therefore strip
 * each chunk's header, concatenate the PCM payloads, and rebuild one
 * correct header.
 */

function isWav(bytes: Uint8Array): boolean {
  return (
    bytes.length > 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45 // E
  );
}

interface ParsedWav {
  /** Full "fmt " chunk including its 8-byte header. */
  fmtChunk: Uint8Array;
  /** Raw PCM payload (all "data" chunks concatenated). */
  pcm: Uint8Array;
}

function readU32LE(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, true);
}

function parseWav(bytes: Uint8Array): ParsedWav | null {
  try {
    let fmtChunk: Uint8Array | null = null;
    const pcmParts: Uint8Array[] = [];
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const id = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      const size = readU32LE(bytes, offset + 4);
      const dataStart = offset + 8;
      const dataEnd = dataStart + size;
      if (dataEnd > bytes.length) break;
      if (id === 'fmt ') fmtChunk = bytes.slice(offset, dataEnd);
      else if (id === 'data') pcmParts.push(bytes.slice(dataStart, dataEnd));
      offset = dataEnd + (size % 2); // chunks are word-aligned
    }
    if (!fmtChunk || pcmParts.length === 0) return null;
    const total = pcmParts.reduce((n, p) => n + p.length, 0);
    const pcm = new Uint8Array(total);
    let at = 0;
    for (const p of pcmParts) {
      pcm.set(p, at);
      at += p.length;
    }
    return { fmtChunk, pcm };
  } catch {
    return null;
  }
}

/**
 * Computes root-mean-square (RMS) energy of 16-bit PCM audio samples.
 */
function computePcmRms(pcm: Uint8Array): number {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const totalSamples = Math.floor(pcm.byteLength / 2);
  if (totalSamples === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < totalSamples; i++) {
    const s = view.getInt16(i * 2, true);
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / totalSamples);
}

/**
 * Gently levels the volume of a chunk towards target RMS to eliminate sudden loudness surges.
 * Clamps gain adjustment between 0.70x and 1.30x for transparent, distortion-free scaling.
 */
function matchPcmLevel(pcm: Uint8Array, targetRms: number): Uint8Array {
  if (targetRms <= 0 || pcm.byteLength < 4) return pcm;
  const currentRms = computePcmRms(pcm);
  if (currentRms <= 0) return pcm;

  const ratio = targetRms / currentRms;
  // If volume is already within ~8%, leave untouched
  if (ratio >= 0.92 && ratio <= 1.08) return pcm;

  const gain = Math.max(0.70, Math.min(1.30, ratio));
  const copy = new Uint8Array(pcm);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  const totalSamples = Math.floor(pcm.byteLength / 2);

  for (let i = 0; i < totalSamples; i++) {
    const sample = view.getInt16(i * 2, true);
    const scaled = Math.round(sample * gain);
    view.setInt16(i * 2, Math.max(-32768, Math.min(32767, scaled)), true);
  }

  return copy;
}

/**
 * Generates an inter-chunk natural respiratory pause (220ms) with inaudible
 * comfort-room dither (~ -78 dBFS) to prevent abrupt zero-digital-silence jump cuts.
 */
function createInterChunkPause(sampleRate = 24000, durationSec = 0.22): Uint8Array {
  const sampleCount = Math.floor(sampleRate * durationSec);
  const bytes = new Uint8Array(sampleCount * 2);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < sampleCount; i++) {
    // Subtle inaudible dither (-4 to +4 in 16-bit PCM) eliminates sterile digital gate cutoff
    const dither = Math.floor((Math.random() - 0.5) * 8);
    view.setInt16(i * 2, dither, true);
  }

  return bytes;
}

/**
 * Applies soft-knee quarter-sine envelopes to eliminate vocoder onset transient spikes
 * and provide gentle sentence tail decrescendo without clipping speech consonants.
 */
function smoothJunctions(
  pcm: Uint8Array,
  isFirst: boolean,
  isLast: boolean,
  sampleRate = 24000
): Uint8Array {
  // 35ms soft-knee attack tamer for continuation chunks (tames vocoder startup bursts)
  const fadeInSec = 0.035;
  const fadeInSamples = Math.max(16, Math.floor(sampleRate * fadeInSec));

  // 15ms gentle tail decrescendo for leading chunks
  const fadeOutSec = 0.015;
  const fadeOutSamples = Math.max(16, Math.floor(sampleRate * fadeOutSec));

  const totalSamples = Math.floor(pcm.byteLength / 2);
  if (totalSamples < (fadeInSamples + fadeOutSamples)) return pcm;

  const copy = new Uint8Array(pcm);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);

  // Soft-knee onset fade-in at start of continuation chunks
  if (!isFirst) {
    for (let i = 0; i < fadeInSamples; i++) {
      // Quarter-sine smooth envelope: gentle launch, no pop
      const factor = Math.sin((i / fadeInSamples) * (Math.PI / 2));
      const s = view.getInt16(i * 2, true);
      view.setInt16(i * 2, Math.round(s * factor), true);
    }
  }

  // Smooth fade-out at end of leading chunks
  if (!isLast) {
    for (let i = 0; i < fadeOutSamples; i++) {
      const factor = Math.sin(((fadeOutSamples - i) / fadeOutSamples) * (Math.PI / 2));
      const offset = (totalSamples - fadeOutSamples + i) * 2;
      const s = view.getInt16(offset, true);
      view.setInt16(offset, Math.round(s * factor), true);
    }
  }

  return copy;
}

/**
 * Master loudness normalization: raises (or lowers) the whole file so its
 * peak hits TARGET_PEAK_DB (-3 dBFS). Chunk-level RMS matching keeps chunks
 * consistent with each other, but if every chunk is quiet the entire file
 * stays quiet (measured -13.9 dB peak in the wild) — this fixes that.
 * Upward gain is capped at +12 dB so near-silent/noise-floor audio is never
 * blown up; silent input is left untouched.
 */
const TARGET_PEAK_DB = -3.0;
const MAX_UPWARD_GAIN_DB = 12.0;

function normalizeMasterPeak(pcm: Uint8Array): void {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const totalSamples = Math.floor(pcm.byteLength / 2);
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const abs = Math.abs(view.getInt16(i * 2, true));
    if (abs > peak) peak = abs;
  }
  if (peak <= 0) return; // silent — nothing to normalize

  const peakDb = 20 * Math.log10(peak / 32768);
  let gainDb = TARGET_PEAK_DB - peakDb;
  if (gainDb > MAX_UPWARD_GAIN_DB) gainDb = MAX_UPWARD_GAIN_DB;
  const gain = Math.pow(10, gainDb / 20);
  if (gain >= 0.999 && gain <= 1.001) return; // already on target

  for (let i = 0; i < totalSamples; i++) {
    const s = view.getInt16(i * 2, true);
    view.setInt16(i * 2, Math.round(Math.max(-32768, Math.min(32767, s * gain))), true);
  }
}

/**
 * Rebuild a valid WAV Blob from a fmt chunk + PCM payload.
 */
function buildWavBlob(fmtChunk: Uint8Array, pcm: Uint8Array): Blob {
  const totalPcm = pcm.byteLength;
  const out = new Uint8Array(12 + fmtChunk.length + 8 + totalPcm);
  const view = new DataView(out.buffer);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  view.setUint32(4, 4 + fmtChunk.length + 8 + totalPcm, true); // file size - 8
  out.set([0x57, 0x41, 0x56, 0x45], 8); // 'WAVE'
  out.set(fmtChunk, 12);
  const dataHeaderAt = 12 + fmtChunk.length;
  out.set([0x64, 0x61, 0x74, 0x61], dataHeaderAt); // 'data'
  view.setUint32(dataHeaderAt + 4, totalPcm, true);
  out.set(pcm, dataHeaderAt + 8);
  return new Blob([out], { type: 'audio/wav' });
}
/**
 * Transparent soft-knee master peak limiter: Prevents sudden phonetic transient bursts
 * from jarring the listener while leaving 100% of vocal dynamic range untouched.
 */
function applyMasterSoftLimiter(pcm: Uint8Array): void {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const totalSamples = Math.floor(pcm.byteLength / 2);
  const THRESHOLD = 28000; // ~ -1.3 dBFS
  const CEILING_HEADROOM = 32767 - THRESHOLD; // 4767

  for (let i = 0; i < totalSamples; i++) {
    const s = view.getInt16(i * 2, true);
    const abs = Math.abs(s);
    if (abs > THRESHOLD) {
      const excess = abs - THRESHOLD;
      // Hyperbolic tangent soft knee
      const compressed = THRESHOLD + CEILING_HEADROOM * Math.tanh(excess / CEILING_HEADROOM);
      view.setInt16(i * 2, Math.round(Math.sign(s) * compressed), true);
    }
  }
}

/**
 * Combine chunk audio parts into a single seamless, playable Blob.
 * Performs RMS level matching, 220ms natural inter-chunk respiratory pauses,
 * 35ms soft-knee onset transient taming, master loudness normalization to
 * -3 dBFS peak, and transparent master peak limiting.
 */
export function concatenateAudioParts(parts: Uint8Array[], mimeType: string): Blob {
  if (parts.length === 0) return new Blob([], { type: mimeType });
  if (parts.length === 1 && isWav(parts[0])) {
    // Single chunk (the common case with 5k-char single-pass models):
    // still normalize master loudness so quiet generations are audible.
    const parsed = parseWav(parts[0]);
    if (parsed) {
      normalizeMasterPeak(parsed.pcm);
      applyMasterSoftLimiter(parsed.pcm);
      return buildWavBlob(parsed.fmtChunk, parsed.pcm);
    }
    return new Blob(parts as BlobPart[], { type: mimeType });
  }
  if (!isWav(parts[0])) {
    return new Blob(parts as BlobPart[], { type: mimeType });
  }

  const parsed = parts.map(parseWav);
  if (parsed.some((p) => p === null)) {
    // Unparseable WAV — fall back to naive concat rather than failing.
    return new Blob(parts as BlobPart[], { type: mimeType });
  }
  const wavs = parsed as ParsedWav[];
  const fmtChunk = wavs[0].fmtChunk;

  let sampleRate = 24000;
  if (fmtChunk.length >= 16) {
    sampleRate = readU32LE(fmtChunk, 12) || 24000;
  }

  // Master anchor RMS from Chunk 0
  const anchorRms = computePcmRms(wavs[0].pcm);

  // Level volume across chunks and smooth junctions seamlessly
  const processedPcmChunks: Uint8Array[] = wavs.map((w, idx) => {
    const leveled = idx === 0 ? w.pcm : matchPcmLevel(w.pcm, anchorRms);
    return smoothJunctions(leveled, idx === 0, idx === wavs.length - 1, sampleRate);
  });

  // Assemble with natural 220ms inter-chunk respiratory pauses between adjacent chunks
  const assembledParts: Uint8Array[] = [];
  for (let i = 0; i < processedPcmChunks.length; i++) {
    assembledParts.push(processedPcmChunks[i]);
    if (i < processedPcmChunks.length - 1) {
      assembledParts.push(createInterChunkPause(sampleRate, 0.22));
    }
  }

  const totalPcm = assembledParts.reduce((n, p) => n + p.length, 0);
  const pcm = new Uint8Array(totalPcm);
  let at = 0;
  for (const p of assembledParts) {
    pcm.set(p, at);
    at += p.length;
  }

  // Final master pass: loudness normalization, then transparent soft-knee peak limiting
  normalizeMasterPeak(pcm);
  applyMasterSoftLimiter(pcm);

  return buildWavBlob(fmtChunk, pcm);
}
