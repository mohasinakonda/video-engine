/**
 * Client-side audio processing & WAV normalization for voice cloning.
 * Uses native Web Audio API (OfflineAudioContext) to decode any user audio format (MP3, WAV, M4A, OGG)
 * and resample it to 16-bit mono PCM WAV (24kHz for DeepInfra voice cloning, 16kHz for Whisper).
 */

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes Float32Array PCM audio samples into a standard 16-bit mono RIFF WAV Blob.
 */
export function encodeMonoWav(samples: Float32Array, sampleRate = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio samples (clamp float32 to int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Converts a Blob to a base64 string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.replace(/^data:[^;]+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes, downmixes to mono, resamples to 24kHz, and trims audio file to maxDurationSeconds.
 */
export async function processAudioFileForCloning(
  file: File,
  maxDurationSeconds = 12
): Promise<{
  wavBlob: Blob;
  base64: string;
  duration: number;
  previewUrl: string;
}> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const actualDuration = Math.min(decodedBuffer.duration, maxDurationSeconds);
    const targetSampleRate = 24000;
    const targetFrames = Math.max(1, Math.floor(actualDuration * targetSampleRate));

    // High quality resampling via OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(1, targetFrames, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const monoSamples = renderedBuffer.getChannelData(0);

    const wavBlob = encodeMonoWav(monoSamples, targetSampleRate);
    const base64 = await blobToBase64(wavBlob);
    const previewUrl = URL.createObjectURL(wavBlob);

    return {
      wavBlob,
      base64,
      duration: actualDuration,
      previewUrl,
    };
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Decodes any audio file to mono samples at `sampleRate` (16 kHz is what Whisper works at).
 * The context's sample rate makes decodeAudioData resample, so the full-rate audio is never held.
 */
export async function decodeToMono(file: Blob, sampleRate = 16000): Promise<Float32Array> {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass({ sampleRate });
  try {
    const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
    }
    return mono;
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Splits mono samples into pieces of at most `maxSec`, cutting each one in the quietest
 * 0.25 s window of its last `searchSec` so no word is cut in half. Returns [start, end) sample ranges.
 */
export function splitAtSilence(samples: Float32Array, sampleRate: number, maxSec: number, searchSec = 15): [number, number][] {
  const maxLen = Math.floor(maxSec * sampleRate);
  const win = Math.floor(0.25 * sampleRate);
  const ranges: [number, number][] = [];
  let start = 0;
  while (samples.length - start > maxLen) {
    const hardEnd = start + maxLen;
    let cut = hardEnd;
    let quietest = Infinity;
    for (let w = Math.max(start + win, hardEnd - Math.floor(searchSec * sampleRate)); w + win <= hardEnd; w += Math.floor(win / 2)) {
      let energy = 0;
      for (let i = w; i < w + win; i++) energy += samples[i] * samples[i];
      if (energy < quietest) {
        quietest = energy;
        cut = w + Math.floor(win / 2);
      }
    }
    ranges.push([start, cut]);
    start = cut;
  }
  ranges.push([start, samples.length]);
  return ranges;
}
