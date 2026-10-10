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
 * Combine chunk audio parts into a single playable Blob.
 * WAV inputs get a rebuilt RIFF header; anything else is concatenated
 * as raw frames (correct for MP3/Opus).
 */
export function concatenateAudioParts(parts: Uint8Array[], mimeType: string): Blob {
  if (parts.length === 0) return new Blob([], { type: mimeType });
  if (parts.length === 1 || !isWav(parts[0])) {
    return new Blob(parts as BlobPart[], { type: mimeType });
  }

  const parsed = parts.map(parseWav);
  if (parsed.some((p) => p === null)) {
    // Unparseable WAV — fall back to naive concat rather than failing.
    return new Blob(parts as BlobPart[], { type: mimeType });
  }
  const wavs = parsed as ParsedWav[];
  const fmtChunk = wavs[0].fmtChunk;
  const totalPcm = wavs.reduce((n, w) => n + w.pcm.length, 0);
  const pcm = new Uint8Array(totalPcm);
  let at = 0;
  for (const w of wavs) {
    pcm.set(w.pcm, at);
    at += w.pcm.length;
  }

  // Layout: RIFF header (12) + fmt chunk + data header (8) + PCM.
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
